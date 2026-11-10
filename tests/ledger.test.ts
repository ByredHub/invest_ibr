import { describe, expect, it } from "vitest";
import {
  addMonthsUTC,
  assertPeriodOpen,
  computeCounters,
  isPeriodLocked,
  parseDay,
  parseMonth,
  parseRubToKop,
  periodKey,
  periodKeyOf,
  periodRange,
  periodSeqOf,
  purchaseTotalKop,
  availableForPayout,
  selectBefore,
  snapshotAsOf,
  type LedgerOp,
} from "@/lib/ledger";

const rub = (n: number) => Math.round(n * 100);

describe("computeCounters", () => {
  it("Иванов: пополнение 190 000, покупка 100 000, доход 2 500", () => {
    const ops: LedgerOp[] = [{ type: "DEPOSIT", amountKop: rub(190_000) }];
    ops.push({ type: "PURCHASE", amountKop: rub(100_000) });
    expect(computeCounters(ops)).toEqual({
      totalKop: rub(190_000),
      investedKop: rub(100_000),
      balanceKop: rub(90_000),
      incomeKop: 0,
      paidOutKop: 0,
    });
    ops.push({ type: "INCOME", amountKop: rub(2_500) });
    expect(computeCounters(ops)).toEqual({
      totalKop: rub(192_500),
      investedKop: rub(100_000),
      balanceKop: rub(92_500),
      incomeKop: rub(2_500),
      paidOutKop: 0,
    });
  });

  it("перенос из остатка во вложено уменьшает остаток, не меняя общую сумму", () => {
    const c = computeCounters([
      { type: "DEPOSIT", amountKop: rub(50_000) },
      { type: "TRANSFER", amountKop: rub(20_000) },
    ]);
    expect(c).toEqual({ totalKop: rub(50_000), investedKop: rub(20_000), balanceKop: rub(30_000), incomeKop: 0, paidOutKop: 0 });
  });

  it("допускает отрицательный остаток", () => {
    const c = computeCounters([
      { type: "DEPOSIT", amountKop: rub(10_000) },
      { type: "PURCHASE", amountKop: rub(15_000) },
    ]);
    expect(c.balanceKop).toBe(-rub(5_000));
  });

  it("пустой журнал даёт нули", () => {
    expect(computeCounters([])).toEqual({ totalKop: 0, investedKop: 0, balanceKop: 0, incomeKop: 0, paidOutKop: 0 });
  });
});

describe("purchaseTotalKop", () => {
  it("целое количество", () => {
    expect(purchaseTotalKop("10", 1_000_000)).toBe(10_000_000);
  });
  it("дробное количество округляется до копейки (half up)", () => {
    expect(purchaseTotalKop("0.5", 101)).toBe(51);
    expect(purchaseTotalKop("1.333", 100)).toBe(133);
    expect(purchaseTotalKop("2,5", 333)).toBe(833);
  });
  it("без ошибок плавающей точки", () => {
    expect(purchaseTotalKop("0.1", 30)).toBe(3);
    expect(purchaseTotalKop("3", 3333333)).toBe(9_999_999);
  });
  it("отклоняет некорректные значения", () => {
    expect(purchaseTotalKop("0", 100)).toBeNull();
    expect(purchaseTotalKop("-1", 100)).toBeNull();
    expect(purchaseTotalKop("abc", 100)).toBeNull();
    expect(purchaseTotalKop("1", 0)).toBeNull();
  });
});

describe("parseRubToKop", () => {
  it("разбирает рубли и копейки", () => {
    expect(parseRubToKop("190 000")).toBe(19_000_000);
    expect(parseRubToKop("2500,5")).toBe(250_050);
    expect(parseRubToKop("0")).toBeNull();
    expect(parseRubToKop("1.234")).toBeNull();
  });
});

describe("персональные периоды", () => {
  const anchor = parseDay("2026-08-10")!;
  it("периоды по 3 месяца от якоря", () => {
    expect(periodSeqOf(parseDay("2026-08-10")!, anchor)).toBe(1);
    expect(periodSeqOf(parseDay("2026-11-09")!, anchor)).toBe(1);
    expect(periodSeqOf(parseDay("2026-11-10")!, anchor)).toBe(2);
    expect(periodSeqOf(parseDay("2027-05-10")!, anchor)).toBe(4);
    expect(periodSeqOf(parseDay("2026-08-09")!, anchor)).toBe(0);
    expect(periodKeyOf(parseDay("2026-11-10")!, anchor)).toBe("P2");
    expect(periodKey(3)).toBe("P3");
  });
  it("границы периода и переход через 31-е число", () => {
    const r = periodRange(anchor, 2);
    expect(r.start.toISOString()).toBe("2026-11-10T00:00:00.000Z");
    expect(r.end.toISOString()).toBe("2027-02-10T00:00:00.000Z");
    expect(addMonthsUTC(parseDay("2026-01-31")!, 1).toISOString()).toBe("2026-02-28T00:00:00.000Z");
  });
  it("закрытый период отклоняет операции", () => {
    const locked = [1];
    expect(isPeriodLocked(parseDay("2026-09-30")!, anchor, locked)).toBe(true);
    expect(isPeriodLocked(parseDay("2026-11-10")!, anchor, locked)).toBe(false);
    expect(isPeriodLocked(parseDay("2026-08-09")!, anchor, locked)).toBe(false);
    expect(() => assertPeriodOpen(parseDay("2026-08-10")!, anchor, locked)).toThrow(/закрыт/);
    expect(() => assertPeriodOpen(parseMonth("2026-12")!, anchor, locked)).not.toThrow();
  });
  it("парсинг дат", () => {
    expect(parseDay("2026-02-30")).toBeNull();
    expect(parseMonth("2026-13")).toBeNull();
  });
});

describe("срез снимка периода", () => {
  const end = periodRange(parseDay("2026-08-10")!, 1).end;
  const ops = [
    { id: "a", date: parseDay("2026-11-09")! },
    { id: "b", date: parseDay("2026-11-10")! },
    { id: "c", date: parseDay("2026-08-20")! },
    { id: "d", date: parseMonth("2026-12")! },
  ];
  it("исключает операции после конца периода", () => {
    expect(selectBefore(ops, (o) => o.date, end).map((o) => o.id)).toEqual(["a", "c"]);
  });
  it("дата «данные на»: конец периода или момент формирования", () => {
    expect(snapshotAsOf(end, new Date("2026-11-24T10:00:00Z")).toISOString()).toBe("2026-11-09T00:00:00.000Z");
    const runningEnd = periodRange(parseDay("2026-08-10")!, 2).end;
    expect(snapshotAsOf(runningEnd, new Date("2026-11-24T10:00:00Z")).toISOString()).toBe("2026-11-24T10:00:00.000Z");
  });
});

describe("вывод дохода", () => {
  const ops: LedgerOp[] = [
    { type: "DEPOSIT", amountKop: rub(190_000), quarterKey: "2026-Q3" },
    { type: "INCOME", amountKop: rub(10_000), quarterKey: "2026-Q3" },
    { type: "INCOME", amountKop: rub(4_000), quarterKey: "2026-Q4" },
  ];
  it("выплата уменьшает общую сумму и остаток, доход валовый", () => {
    const c = computeCounters([...ops, { type: "WITHDRAWAL", amountKop: rub(6_000), quarterKey: "2026-Q4" }]);
    expect(c).toEqual({ totalKop: rub(198_000), investedKop: 0, balanceKop: rub(198_000), incomeKop: rub(14_000), paidOutKop: rub(6_000) });
  });
  it("сценарий Иванова не меняется", () => {
    const c = computeCounters([
      { type: "DEPOSIT", amountKop: rub(190_000) },
      { type: "PURCHASE", amountKop: rub(100_000) },
      { type: "INCOME", amountKop: rub(2_500) },
    ]);
    expect([c.totalKop, c.investedKop, c.balanceKop, c.incomeKop, c.paidOutKop]).toEqual([rub(192_500), rub(100_000), rub(92_500), rub(2_500), 0]);
  });
  it("доступно только из открытых кварталов", () => {
    expect(availableForPayout(ops, [], 0)).toBe(0);
    expect(availableForPayout(ops, ["2026-Q3"], 0)).toBe(rub(10_000));
  });
  it("накапливается по открытым кварталам", () => {
    expect(availableForPayout(ops, ["2026-Q3", "2026-Q4"], 0)).toBe(rub(14_000));
  });
  it("вычитает выплаты и заявки в ожидании, не уходит в минус", () => {
    const withdrawn = [...ops, { type: "WITHDRAWAL" as const, amountKop: rub(6_000), quarterKey: "2026-Q4" }];
    expect(availableForPayout(withdrawn, ["2026-Q3", "2026-Q4"], 0)).toBe(rub(8_000));
    expect(availableForPayout(withdrawn, ["2026-Q3", "2026-Q4"], rub(3_000))).toBe(rub(5_000));
    expect(availableForPayout(withdrawn, ["2026-Q3"], rub(50_000))).toBe(0);
  });
});
