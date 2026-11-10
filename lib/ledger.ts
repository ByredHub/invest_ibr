export type OperationType = "DEPOSIT" | "TRANSFER" | "PURCHASE" | "INCOME" | "WITHDRAWAL";

export interface LedgerOp {
  type: OperationType;
  amountKop: number;
  quarterKey?: string;
}

export interface Counters {
  totalKop: number;
  investedKop: number;
  balanceKop: number;
  incomeKop: number;
  paidOutKop: number;
}

export function computeCounters(ops: readonly LedgerOp[]): Counters {
  let deposits = 0;
  let income = 0;
  let invested = 0;
  let paidOut = 0;
  for (const op of ops) {
    switch (op.type) {
      case "DEPOSIT":
        deposits += op.amountKop;
        break;
      case "INCOME":
        income += op.amountKop;
        break;
      case "WITHDRAWAL":
        paidOut += op.amountKop;
        break;
      case "TRANSFER":
      case "PURCHASE":
        invested += op.amountKop;
        break;
    }
  }
  const totalKop = deposits + income - paidOut;
  return { totalKop, investedKop: invested, balanceKop: totalKop - invested, incomeKop: income, paidOutKop: paidOut };
}

/** Income of opened quarters not yet withdrawn nor reserved by a pending request; never negative. */
export function availableForPayout(ops: readonly LedgerOp[], openedQuarterKeys: Iterable<string>, pendingKop: number): number {
  const opened = new Set(openedQuarterKeys);
  let income = 0;
  let withdrawn = 0;
  for (const op of ops) {
    if (op.type === "INCOME" && op.quarterKey && opened.has(op.quarterKey)) income += op.amountKop;
    else if (op.type === "WITHDRAWAL") withdrawn += op.amountKop;
  }
  return Math.max(0, income - withdrawn - pendingKop);
}

const QTY_SCALE = 6;
const QTY_RE = /^\d{1,12}(?:[.,]\d{1,6})?$/;

/** Parses a positive decimal quantity into an integer scaled by 1e6. Returns null if invalid or zero. */
export function parseQuantity(input: string): bigint | null {
  const s = input.trim().replace(/\s/g, "");
  if (!QTY_RE.test(s)) return null;
  const [int, frac = ""] = s.replace(",", ".").split(".");
  const scaled = BigInt(int) * 10n ** BigInt(QTY_SCALE) + BigInt(frac.padEnd(QTY_SCALE, "0"));
  return scaled > 0n ? scaled : null;
}

/** Parses a rub amount ("1 234,56") into integer kopecks. Returns null if invalid or <= 0. */
export function parseRubToKop(input: string): number | null {
  const s = input.replace(/руб\.?|rub|₽|р\./gi, "").replace(/[\s\u00a0\u202f]/g, "");
  if (!/^\d{1,12}(?:[.,]\d{1,2})?$/.test(s)) return null;
  const [int, frac = ""] = s.replace(",", ".").split(".");
  const kop = Number(BigInt(int) * 100n + BigInt(frac.padEnd(2, "0")));
  if (!Number.isSafeInteger(kop) || kop <= 0) return null;
  return kop;
}

/** round(quantity × unitPrice), half up, no floating point. */
export function purchaseTotalKop(quantity: string, unitPriceKop: number): number | null {
  const q = parseQuantity(quantity);
  if (q === null || !Number.isInteger(unitPriceKop) || unitPriceKop <= 0) return null;
  const scale = 10n ** BigInt(QTY_SCALE);
  const raw = q * BigInt(unitPriceKop);
  const total = Number((raw + scale / 2n) / scale);
  return Number.isSafeInteger(total) && total > 0 ? total : null;
}

export function normalizeQuantity(quantity: string): string | null {
  const q = parseQuantity(quantity);
  if (q === null) return null;
  const scale = 10n ** BigInt(QTY_SCALE);
  const int = q / scale;
  const frac = (q % scale).toString().padStart(QTY_SCALE, "0").replace(/0+$/, "");
  return frac ? `${int}.${frac}` : `${int}`;
}

/** Adds n months (UTC), clamping the day to the last day of the target month. */
export function addMonthsUTC(d: Date, n: number): Date {
  const day = d.getUTCDate();
  const res = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, day));
  if (res.getUTCDate() !== day) res.setUTCDate(0);
  return res;
}

// Персональные отчётные периоды: по 3 месяца от periodAnchor инвестора (дата первого взноса).

/** Inclusive start, exclusive end (UTC) of the investor's personal period seq (1-based). */
export function periodRange(anchor: Date, seq: number): { start: Date; end: Date } {
  return { start: addMonthsUTC(anchor, 3 * (seq - 1)), end: addMonthsUTC(anchor, 3 * seq) };
}

/** Personal period number for a date relative to the anchor; 0 if the date precedes the anchor. */
export function periodSeqOf(date: Date, anchor: Date): number {
  if (date < anchor) return 0;
  let seq = 1;
  while (periodRange(anchor, seq).end <= date) seq++;
  return seq;
}

/** "P3" — key stored in Operation.quarterKey. */
export function periodKey(seq: number): string {
  return `P${seq}`;
}

export function periodKeyOf(date: Date, anchor: Date): string {
  return periodKey(periodSeqOf(date, anchor));
}

export function periodSeqFromKey(key: string): number | null {
  const m = /^P(\d+)$/.exec(key);
  return m ? Number(m[1]) : null;
}

export function isPeriodLocked(date: Date, anchor: Date, lockedSeqs: Iterable<number>): boolean {
  const seq = periodSeqOf(date, anchor);
  if (seq === 0) return false;
  for (const s of lockedSeqs) if (s === seq) return true;
  return false;
}

export class QuarterLockedError extends Error {}

/** Throws a user-facing message if the date falls into a locked personal period. */
export function assertPeriodOpen(date: Date, anchor: Date, lockedSeqs: Iterable<number>): void {
  if (isPeriodLocked(date, anchor, lockedSeqs)) {
    throw new QuarterLockedError(`Период ${periodSeqOf(date, anchor)} закрыт — операции с этой датой недоступны`);
  }
}

/** "YYYY-MM" -> first day of month (UTC), or null. */
export function parseMonth(value: string): Date | null {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
  return m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1)) : null;
}

/** "YYYY-MM-DD" -> date at UTC midnight, or null. */
export function parseDay(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]) ? d : null;
}

/** Items dated strictly before `end` (exclusive quarter end). */
export function selectBefore<T>(items: readonly T[], dateOf: (item: T) => Date, end: Date): T[] {
  return items.filter((i) => dateOf(i) < end);
}

/** Date a snapshot is "as of": period's last day, or the generation moment if the period is still running. */
export function snapshotAsOf(periodEnd: Date, generatedAt: Date): Date {
  const lastDay = new Date(periodEnd.getTime() - 86_400_000);
  return lastDay < generatedAt ? lastDay : generatedAt;
}
