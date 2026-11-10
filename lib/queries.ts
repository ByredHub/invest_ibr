import { db } from "@/lib/db";
import { computeCounters, periodRange, periodSeqOf, type Counters, type OperationType } from "@/lib/ledger";
import { periodLabel } from "@/lib/service";

export interface InvestorRow {
  id: string;
  fullName: string;
  phone: string;
  status: string;
  createdAt: Date;
  counters: Counters;
  rank: number | null;
}

export async function listInvestors(): Promise<InvestorRow[]> {
  const [users, ops] = await Promise.all([
    db.user.findMany({ where: { role: "INVESTOR" }, orderBy: { fullName: "asc" } }),
    db.operation.findMany({ select: { userId: true, type: true, amountKop: true } }),
  ]);
  const byUser = new Map<string, { type: OperationType; amountKop: number }[]>();
  for (const o of ops) {
    const arr = byUser.get(o.userId) ?? [];
    arr.push({ type: o.type as OperationType, amountKop: o.amountKop });
    byUser.set(o.userId, arr);
  }
  const rows = users.map((u) => ({
    id: u.id,
    fullName: u.fullName,
    phone: u.phone,
    status: u.status,
    createdAt: u.createdAt,
    counters: computeCounters(byUser.get(u.id) ?? []),
    rank: null as number | null,
  }));
  [...rows]
    .filter((r) => r.counters.incomeKop > 0)
    .sort((a, b) => b.counters.incomeKop - a.counters.incomeKop)
    .slice(0, 3)
    .forEach((r, i) => {
      r.rank = i + 1;
    });
  return rows;
}

export function sumCounters(rows: { counters: Counters }[]): Counters {
  return rows.reduce<Counters>(
    (a, r) => ({
      totalKop: a.totalKop + r.counters.totalKop,
      investedKop: a.investedKop + r.counters.investedKop,
      balanceKop: a.balanceKop + r.counters.balanceKop,
      incomeKop: a.incomeKop + r.counters.incomeKop,
      paidOutKop: a.paidOutKop + r.counters.paidOutKop,
    }),
    { totalKop: 0, investedKop: 0, balanceKop: 0, incomeKop: 0, paidOutKop: 0 },
  );
}

export async function getInvestorDetail(id: string) {
  const user = await db.user.findFirst({ where: { id, role: "INVESTOR" } });
  if (!user) return null;
  const [ops, assets, reports, logs, withdrawals] = await Promise.all([
    db.operation.findMany({
      where: { userId: id },
      orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
      include: { asset: true },
    }),
    db.asset.findMany({ where: { userId: id }, orderBy: { purchasedAt: "desc" } }),
    db.report.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, include: { quarter: { select: { seq: true, startAt: true, endAt: true } } } }),
    db.auditLog.findMany({ where: { clientId: id }, orderBy: { createdAt: "desc" }, take: 200 }),
    db.withdrawalRequest.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" } }),
  ]);
  return {
    user,
    ops,
    assets,
    reports,
    logs,
    withdrawals,
    counters: computeCounters(ops.map((o) => ({ type: o.type as OperationType, amountKop: o.amountKop }))),
  };
}

export interface AuditItem {
  id: string;
  action: string;
  createdAt: Date;
  actorName: string;
  clientId: string | null;
  clientName: string | null;
  details: Record<string, unknown>;
}

export async function listAudit(opts: { take: number; skip?: number }): Promise<{ items: AuditItem[]; total: number }> {
  const [logs, total, users] = await Promise.all([
    db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: opts.take, skip: opts.skip ?? 0 }),
    db.auditLog.count(),
    db.user.findMany({ select: { id: true, fullName: true } }),
  ]);
  const names = new Map(users.map((u) => [u.id, u.fullName]));
  return {
    total,
    items: logs.map((l) => ({
      id: l.id,
      action: l.action,
      createdAt: l.createdAt,
      actorName: names.get(l.actorId) ?? "—",
      clientId: l.clientId,
      clientName: l.clientId ? (names.get(l.clientId) ?? null) : null,
      details: safeJson(l.details),
    })),
  };
}

function safeJson(s: string): Record<string, unknown> {
  try {
    return JSON.parse(s) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export interface InvestorPeriodView {
  userId: string;
  fullName: string;
  status: string;
  anchor: Date;
  currentSeq: number;
  currentStart: Date;
  currentEnd: Date;
  expiredCount: number; // завершившиеся и ещё не закрытые периоды
  quarters: {
    id: string;
    seq: number;
    startAt: Date;
    endAt: Date;
    lockedAt: Date;
    payoutOpenedAt: Date | null;
    label: string;
  }[];
}

/** Инвесторы с персональными периодами: текущий период и история закрытых. */
export async function listInvestorPeriods(): Promise<InvestorPeriodView[]> {
  const now = new Date();
  const investors = await db.user.findMany({
    where: { role: "INVESTOR", periodAnchor: { not: null } },
    orderBy: { fullName: "asc" },
    include: { quarters: { orderBy: { seq: "desc" } } },
  });
  return investors.map((u) => {
    const anchor = u.periodAnchor!;
    const currentSeq = periodSeqOf(now, anchor);
    const { start, end } = periodRange(anchor, Math.max(currentSeq, 1));
    const lockedSeqs = new Set(u.quarters.map((q) => q.seq));
    let expired = 0;
    for (let seq = 1; periodRange(anchor, seq).end <= now; seq++) if (!lockedSeqs.has(seq)) expired++;
    return {
      userId: u.id,
      fullName: u.fullName,
      status: u.status,
      anchor,
      currentSeq,
      currentStart: start,
      currentEnd: end,
      expiredCount: expired,
      quarters: u.quarters.map((q) => ({
        id: q.id,
        seq: q.seq,
        startAt: q.startAt,
        endAt: q.endAt,
        lockedAt: q.lockedAt,
        payoutOpenedAt: q.payoutOpenedAt,
        label: periodLabel(q.seq, q.startAt, q.endAt),
      })),
    };
  });
}

/** Закрытые периоды всех инвесторов, новые первыми — для блока «Вывод дохода». */
export async function listLockedPeriods() {
  const qs = await db.investorQuarter.findMany({
    orderBy: { lockedAt: "desc" },
    include: { user: { select: { id: true, fullName: true } } },
  });
  return qs.map((q) => ({
    id: q.id,
    userId: q.userId,
    fullName: q.user.fullName,
    seq: q.seq,
    label: periodLabel(q.seq, q.startAt, q.endAt),
    lockedAt: q.lockedAt,
    payoutOpenedAt: q.payoutOpenedAt,
  }));
}

export async function listReportLinks() {
  const reports = await db.report.findMany({
    orderBy: [{ createdAt: "desc" }],
    include: {
      user: { select: { id: true, fullName: true, phone: true } },
      quarter: { select: { seq: true, startAt: true, endAt: true } },
    },
    take: 300,
  });
  return reports.map((r) => ({
    id: r.id,
    token: r.token,
    label: periodLabel(r.quarter.seq, r.quarter.startAt, r.quarter.endAt),
    createdAt: r.createdAt,
    user: r.user,
  }));
}

export function pendingWithdrawalCount() {
  return db.withdrawalRequest.count({ where: { status: "PENDING" } });
}

export interface WithdrawalRow {
  id: string;
  userId: string;
  fullName: string;
  amountKop: number;
  status: string;
  createdAt: Date;
  decidedAt: Date | null;
  rejectReason: string | null;
  balanceKop: number;
}

export async function listWithdrawals(kind: "pending" | "processed"): Promise<WithdrawalRow[]> {
  const reqs = await db.withdrawalRequest.findMany({
    where: kind === "pending" ? { status: "PENDING" } : { status: { not: "PENDING" } },
    orderBy: kind === "pending" ? { createdAt: "asc" } : { decidedAt: "desc" },
    include: { user: { select: { id: true, fullName: true } } },
    take: 200,
  });
  const ids = [...new Set(reqs.map((r) => r.userId))];
  const ops = await db.operation.findMany({ where: { userId: { in: ids } }, select: { userId: true, type: true, amountKop: true } });
  const byUser = new Map<string, { type: OperationType; amountKop: number }[]>();
  for (const o of ops) {
    const a = byUser.get(o.userId) ?? [];
    a.push({ type: o.type as OperationType, amountKop: o.amountKop });
    byUser.set(o.userId, a);
  }
  return reqs.map((r) => ({
    id: r.id,
    userId: r.userId,
    fullName: r.user.fullName,
    amountKop: r.amountKop,
    status: r.status,
    createdAt: r.createdAt,
    decidedAt: r.decidedAt,
    rejectReason: r.rejectReason,
    balanceKop: computeCounters(byUser.get(r.userId) ?? []).balanceKop,
  }));
}

export async function pendingPayoutPeriods() {
  const qs = await db.investorQuarter.findMany({
    where: { payoutOpenedAt: null },
    orderBy: { lockedAt: "desc" },
    include: { user: { select: { id: true, fullName: true } } },
    take: 20,
  });
  return qs.map((q) => ({
    id: q.id,
    userId: q.userId,
    fullName: q.user.fullName,
    label: periodLabel(q.seq, q.startAt, q.endAt),
    lockedAt: q.lockedAt,
  }));
}
