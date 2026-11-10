import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { availableForPayout, periodKey, type LedgerOp, type OperationType } from "@/lib/ledger";
import { formatRub } from "@/lib/format";
import { audit, addOperation, periodLabel } from "@/lib/service";

type Tx = Prisma.TransactionClient;

export async function availableFor(tx: Tx, userId: string): Promise<{ available: number; pending: number }> {
  const [ops, opened, pending] = await Promise.all([
    tx.operation.findMany({ where: { userId }, select: { type: true, amountKop: true, quarterKey: true } }),
    tx.investorQuarter.findMany({ where: { userId, payoutOpenedAt: { not: null } }, select: { seq: true } }),
    tx.withdrawalRequest.aggregate({ where: { userId, status: "PENDING" }, _sum: { amountKop: true } }),
  ]);
  const pendingKop = pending._sum.amountKop ?? 0;
  const list: LedgerOp[] = ops.map((o) => ({ type: o.type as OperationType, amountKop: o.amountKop, quarterKey: o.quarterKey }));
  return { available: availableForPayout(list, opened.map((q) => periodKey(q.seq)), pendingKop), pending: pendingKop };
}

export async function openPayout(actorId: string, quarterId: string) {
  return db.$transaction(async (tx) => {
    const q = await tx.investorQuarter.findUnique({ where: { id: quarterId }, include: { user: true } });
    if (!q) throw new ApiError(404, "Период не найден");
    const label = periodLabel(q.seq, q.startAt, q.endAt);
    if (q.payoutOpenedAt) throw new ApiError(409, `Вывод дохода за ${label} уже открыт`);
    await tx.investorQuarter.update({ where: { id: quarterId }, data: { payoutOpenedAt: new Date(), payoutOpenedById: actorId } });
    const { available } = await availableFor(tx, q.userId);
    let notified = 0;
    if (available > 0) {
      await tx.notification.create({
        data: {
          userId: q.userId,
          title: "Доступен вывод дохода",
          body: `Доступно к выводу: ${formatRub(available)}. Нажмите «Вывести» в личном кабинете.`,
        },
      });
      notified = 1;
    }
    await audit(tx, actorId, "PAYOUT_OPENED", q.userId, { quarterId, seq: q.seq, notified });
    return { notified, label };
  });
}

export async function requestWithdrawal(userId: string) {
  return db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== "INVESTOR") throw new ApiError(403, "Недостаточно прав");
    if (user.status !== "ACTIVE") throw new ApiError(403, "Вывод доступен только активным инвесторам");
    const existing = await tx.withdrawalRequest.findFirst({ where: { userId, status: "PENDING" } });
    if (existing) throw new ApiError(409, "У вас уже есть заявка на рассмотрении");
    const { available } = await availableFor(tx, userId);
    if (available <= 0) throw new ApiError(400, "Нет средств, доступных к выводу");
    const req = await tx.withdrawalRequest.create({ data: { userId, amountKop: available } });
    await audit(tx, userId, "WITHDRAWAL_REQUESTED", userId, { amountKop: available, requestId: req.id });
    return req;
  });
}

export async function payRequest(actorId: string, requestId: string) {
  return db.$transaction(async (tx) => {
    const req = await tx.withdrawalRequest.findUnique({ where: { id: requestId } });
    if (!req) throw new ApiError(404, "Заявка не найдена");
    if (req.status !== "PENDING") throw new ApiError(409, "Заявка уже обработана");
    const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");
    const op = await addOperation(tx, actorId, req.userId, "WITHDRAWAL", req.amountKop, today, { requestId: req.id });
    await tx.withdrawalRequest.update({
      where: { id: req.id },
      data: { status: "PAID", decidedAt: new Date(), decidedById: actorId, operationId: op.id },
    });
    await tx.notification.create({
      data: {
        userId: req.userId,
        title: "Выплата проведена",
        body: `Выплата ${formatRub(req.amountKop)} проведена.`,
      },
    });
    return { quarterKey: op.quarterKey };
  });
}

export async function rejectRequest(actorId: string, requestId: string, reason: string) {
  return db.$transaction(async (tx) => {
    const req = await tx.withdrawalRequest.findUnique({ where: { id: requestId } });
    if (!req) throw new ApiError(404, "Заявка не найдена");
    if (req.status !== "PENDING") throw new ApiError(409, "Заявка уже обработана");
    await tx.withdrawalRequest.update({
      where: { id: req.id },
      data: { status: "REJECTED", decidedAt: new Date(), decidedById: actorId, rejectReason: reason },
    });
    await tx.notification.create({
      data: {
        userId: req.userId,
        title: "Заявка на вывод отклонена",
        body: `Заявка на ${formatRub(req.amountKop)} отклонена. Причина: ${reason}`,
      },
    });
    await audit(tx, actorId, "WITHDRAWAL_REJECTED", req.userId, { amountKop: req.amountKop, requestId: req.id, reason });
  });
}
