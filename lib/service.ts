import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { hashPassword } from "@/lib/auth";
import {
  assertPeriodOpen,
  periodRange,
  periodSeqOf,
  periodKey,
  type OperationType,
} from "@/lib/ledger";
import { buildSnapshot } from "@/lib/snapshot";
import { formatDate, formatMonth, formatRub } from "@/lib/format";

type Tx = Prisma.TransactionClient;

export const MAX_KOP = 2_000_000_000;

export async function audit(
  tx: Tx,
  actorId: string,
  action: string,
  clientId: string | null,
  details: Record<string, unknown> = {},
) {
  await tx.auditLog.create({ data: { actorId, clientId, action, details: JSON.stringify(details) } });
}

async function lockedSeqs(tx: Tx, userId: string): Promise<number[]> {
  return (await tx.investorQuarter.findMany({ where: { userId }, select: { seq: true } })).map((q) => q.seq);
}

async function requireInvestor(tx: Tx, id: string) {
  const u = await tx.user.findUnique({ where: { id } });
  if (!u || u.role !== "INVESTOR") throw new ApiError(404, "Инвестор не найден");
  return u;
}

/** Подпись периода для уведомлений и отчётов: «Квартал 2 (10.11.2026 — 09.02.2027)». */
export function periodLabel(seq: number, startAt: Date, endAt: Date): string {
  const lastDay = new Date(endAt.getTime() - 86_400_000);
  return `Квартал ${seq} (${formatDate(startAt)} — ${formatDate(lastDay)})`;
}

export async function createInvestor(
  actorId: string,
  input: { fullName: string; phone: string; password: string; initialDepositKop?: number; date: Date },
) {
  return db.$transaction(async (tx) => {
    if (await tx.user.findUnique({ where: { phone: input.phone } })) {
      throw new ApiError(409, "Пользователь с таким телефоном уже существует");
    }
    const user = await tx.user.create({
      data: {
        role: "INVESTOR",
        fullName: input.fullName,
        phone: input.phone,
        passwordHash: await hashPassword(input.password),
      },
    });
    await audit(tx, actorId, "INVESTOR_CREATED", user.id, { fullName: user.fullName });
    if (input.initialDepositKop) {
      await addOperation(tx, actorId, user.id, "DEPOSIT", input.initialDepositKop, input.date, { initial: true });
    }
    return user;
  });
}

export async function addOperation(
  tx: Tx,
  actorId: string,
  userId: string,
  type: OperationType,
  amountKop: number,
  date: Date,
  extra: { assetId?: string; note?: string; [k: string]: unknown } = {},
) {
  const { assetId, ...details } = extra;
  const user = await tx.user.findUnique({ where: { id: userId } });
  if (!user) throw new ApiError(404, "Инвестор не найден");

  let anchor = user.periodAnchor;
  if (!anchor) {
    if (type !== "DEPOSIT") throw new ApiError(400, "Сначала внесите первое пополнение — от его даты считаются отчётные периоды");
    anchor = date;
    await tx.user.update({ where: { id: userId }, data: { periodAnchor: anchor } });
  }
  assertPeriodOpen(date, anchor, await lockedSeqs(tx, userId));

  const op = await tx.operation.create({
    data: {
      userId,
      type,
      amountKop,
      effectiveDate: date,
      quarterKey: periodKey(periodSeqOf(date, anchor)),
      assetId,
      createdById: actorId,
    },
  });
  await audit(tx, actorId, type, userId, { amountKop, date: date.toISOString().slice(0, 10), operationId: op.id, ...details });
  return op;
}

export async function simpleOperation(
  actorId: string,
  userId: string,
  type: "DEPOSIT" | "TRANSFER" | "INCOME",
  amountKop: number,
  date: Date,
) {
  return db.$transaction(async (tx) => {
    await requireInvestor(tx, userId);
    const op = await addOperation(tx, actorId, userId, type, amountKop, date);
    if (type === "INCOME") {
      await tx.notification.create({
        data: {
          userId,
          title: `Начислен доход за ${formatMonth(date.toISOString().slice(0, 7))}: ${formatRub(amountKop, { sign: true })}`,
          body: "Доход отражён в вашем портфеле.",
        },
      });
    }
    return op;
  });
}

export async function purchaseAsset(
  actorId: string,
  userId: string,
  input: { name: string; ticker: string; quantity: string; unitPriceKop: number; totalKop: number; file: { storedAs: string; mime: string; size: number }; date: Date },
) {
  return db.$transaction(async (tx) => {
    await requireInvestor(tx, userId);
    const file = await tx.fileUpload.create({ data: { ownerId: userId, ...input.file } });
    const asset = await tx.asset.create({
      data: {
        userId,
        name: input.name,
        ticker: input.ticker,
        quantity: input.quantity,
        unitPriceKop: input.unitPriceKop,
        totalKop: input.totalKop,
        fileId: file.id,
        purchasedAt: input.date,
      },
    });
    await addOperation(tx, actorId, userId, "PURCHASE", input.totalKop, input.date, {
      assetId: asset.id,
      title: input.name,
      ticker: input.ticker,
      quantity: input.quantity,
      unitPriceKop: input.unitPriceKop,
      fileId: file.id,
    });
    return asset;
  });
}

export async function resetPassword(actorId: string, userId: string, password: string) {
  const hash = await hashPassword(password);
  return db.$transaction(async (tx) => {
    await requireInvestor(tx, userId);
    await tx.user.update({ where: { id: userId }, data: { passwordHash: hash } });
    await audit(tx, actorId, "PASSWORD_RESET", userId);
  });
}

export async function setStatus(actorId: string, userId: string, status: string) {
  return db.$transaction(async (tx) => {
    const u = await requireInvestor(tx, userId);
    await tx.user.update({ where: { id: userId }, data: { status } });
    await audit(tx, actorId, "STATUS_CHANGED", userId, { from: u.status, to: status });
  });
}

/** Закрывает один период инвестора внутри транзакции. Возвращает созданный InvestorQuarter или null, если закрывать нечего. */
async function closePeriodTx(tx: Tx, actorId: string, user: { id: string; fullName: string; periodAnchor: Date | null }, seq: number, now: Date) {
  const anchor = user.periodAnchor;
  if (!anchor) throw new ApiError(400, "У инвестора ещё не было пополнений — периоды не начались");
  const { start, end } = periodRange(anchor, seq);
  if (start > now) throw new ApiError(400, "Нельзя закрыть период, который ещё не начался");
  const label = periodLabel(seq, start, end);
  if (await tx.investorQuarter.findUnique({ where: { userId_seq: { userId: user.id, seq } } })) {
    throw new ApiError(409, `Период ${seq} уже закрыт — отчёт был сформирован ранее`);
  }

  const quarter = await tx.investorQuarter.create({
    data: { userId: user.id, seq, startAt: start, endAt: end, lockedById: actorId },
  });
  const snapshot = await buildSnapshot(tx, user, { label, end }, now);
  const token = randomBytes(24).toString("base64url");
  const r = await tx.report.create({
    data: { userId: user.id, investorQuarterId: quarter.id, token, snapshot: JSON.stringify(snapshot) },
  });
  await tx.notification.create({
    data: {
      userId: user.id,
      title: `Отчёт за ${label} доступен`,
      body: `Отчётный период закрыт. Ваш инвестиционный отчёт опубликован в личном кабинете.`,
      reportId: r.id,
    },
  });
  await audit(tx, actorId, "QUARTER_LOCKED", user.id, { seq, startAt: start.toISOString(), endAt: end.toISOString() });
  return quarter;
}

/** Следующий закрываемый период инвестора: самый ранний начавшийся и ещё не закрытый. */
function nextClosableSeq(anchor: Date, locked: number[], now: Date): number | null {
  const current = periodSeqOf(now, anchor);
  for (let seq = 1; seq <= current; seq++) {
    if (!locked.includes(seq)) return seq;
  }
  return null;
}

/** Закрывает очередной период конкретного инвестора (или указанный seq). */
export async function closeInvestorPeriod(actorId: string, userId: string, seq?: number) {
  return db.$transaction(async (tx) => {
    const user = await requireInvestor(tx, userId);
    if (!user.periodAnchor) throw new ApiError(400, "У инвестора ещё не было пополнений — периоды не начались");
    const target = seq ?? nextClosableSeq(user.periodAnchor, await lockedSeqs(tx, userId), new Date());
    if (target === null) throw new ApiError(400, "Все начавшиеся периоды уже закрыты");
    const q = await closePeriodTx(tx, actorId, user, target, new Date());
    return { quarterId: q!.id, seq: target, label: periodLabel(target, q!.startAt, q!.endAt) };
  }, { timeout: 60_000 });
}

/** Массово закрывает у всех активных инвесторов все периоды, которые уже завершились. */
export async function closeExpiredPeriods(actorId: string) {
  const now = new Date();
  const investors = await db.user.findMany({
    where: { role: "INVESTOR", status: "ACTIVE", periodAnchor: { not: null } },
    orderBy: { fullName: "asc" },
  });
  let closed = 0;
  const details: { userId: string; seq: number }[] = [];
  for (const inv of investors) {
    await db.$transaction(async (tx) => {
      const anchor = inv.periodAnchor!;
      const locked = await lockedSeqs(tx, inv.id);
      for (let seq = 1; periodRange(anchor, seq).end <= now; seq++) {
        if (locked.includes(seq)) continue;
        await closePeriodTx(tx, actorId, inv, seq, now);
        closed++;
        details.push({ userId: inv.id, seq });
      }
    }, { timeout: 60_000 });
  }
  return { closed, details };
}

export async function assertOpenDate(userId: string, date: Date) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || !user.periodAnchor) return;
  assertPeriodOpen(date, user.periodAnchor, await lockedSeqs(db, userId));
}
