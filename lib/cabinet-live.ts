import { db } from "@/lib/db";
import { computeCounters, periodRange, periodSeqOf, type Counters, type OperationType } from "@/lib/ledger";
import { availableFor } from "@/lib/payout";
import { periodLabel } from "@/lib/service";
import { formatDate } from "@/lib/format";

export interface LiveAsset {
  id: string;
  name: string;
  ticker: string;
  quantity: string;
  unitPriceKop: number;
  totalKop: number;
  fileId: string;
  purchasedAt: string;
}

export interface LiveRequest {
  id: string;
  amountKop: number;
  status: string;
  createdAt: string;
  decidedAt: string | null;
  rejectReason: string | null;
}

export interface LiveData {
  counters: Counters;
  assets: LiveAsset[];
  income: { month: string; amountKop: number; lastAt: string }[];
  monthKey: string;
  monthIncomeKop: number;
  periodLabel: string | null;
  periodIncomeKop: number;
  available: number;
  pendingKop: number;
  payoutOpen: boolean;
  requests: LiveRequest[];
  active: boolean;
  reports: { token: string; label: string; createdAt: string }[];
}

export async function loadLiveData(userId: string, status: string): Promise<LiveData> {
  const now = new Date();
  const [user, ops, assets, requests, reports, openedCount] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { periodAnchor: true } }),
    db.operation.findMany({ where: { userId }, orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }] }),
    db.asset.findMany({ where: { userId }, orderBy: { purchasedAt: "desc" } }),
    db.withdrawalRequest.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 20 }),
    db.report.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { token: true, createdAt: true, quarter: { select: { seq: true, startAt: true, endAt: true } } },
    }),
    db.investorQuarter.count({ where: { userId, payoutOpenedAt: { not: null } } }),
  ]);
  const { available, pending } = await availableFor(db, userId);
  const monthKey = now.toISOString().slice(0, 7);

  const anchor = user?.periodAnchor ?? null;
  const currentSeq = anchor ? Math.max(periodSeqOf(now, anchor), 1) : null;
  const currentRange = anchor && currentSeq ? periodRange(anchor, currentSeq) : null;
  const currentLabel =
    anchor && currentSeq && currentRange
      ? `Квартал ${currentSeq} (${formatDate(currentRange.start)} — ${formatDate(new Date(currentRange.end.getTime() - 86_400_000))})`
      : null;

  const byMonth = new Map<string, { amountKop: number; lastAt: Date }>();
  let monthIncome = 0;
  let periodIncome = 0;
  for (const o of ops) {
    if (o.type !== "INCOME") continue;
    const m = o.effectiveDate.toISOString().slice(0, 7);
    const cur = byMonth.get(m);
    byMonth.set(m, { amountKop: (cur?.amountKop ?? 0) + o.amountKop, lastAt: !cur || o.createdAt > cur.lastAt ? o.createdAt : cur.lastAt });
    if (m === monthKey) monthIncome += o.amountKop;
    if (anchor && currentSeq && periodSeqOf(o.effectiveDate, anchor) === currentSeq) periodIncome += o.amountKop;
  }

  return {
    counters: computeCounters(ops.map((o) => ({ type: o.type as OperationType, amountKop: o.amountKop }))),
    assets: assets.map((a) => ({
      id: a.id, name: a.name, ticker: a.ticker, quantity: a.quantity, unitPriceKop: a.unitPriceKop,
      totalKop: a.totalKop, fileId: a.fileId, purchasedAt: a.purchasedAt.toISOString(),
    })),
    income: [...byMonth.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([month, v]) => ({ month, amountKop: v.amountKop, lastAt: v.lastAt.toISOString() })),
    monthKey,
    monthIncomeKop: monthIncome,
    periodLabel: currentLabel,
    periodIncomeKop: periodIncome,
    available,
    pendingKop: pending,
    payoutOpen: openedCount > 0,
    requests: requests.map((r) => ({
      id: r.id, amountKop: r.amountKop, status: r.status, createdAt: r.createdAt.toISOString(),
      decidedAt: r.decidedAt?.toISOString() ?? null, rejectReason: r.rejectReason,
    })),
    active: status === "ACTIVE",
    reports: reports.map((r) => ({
      token: r.token,
      label: periodLabel(r.quarter.seq, r.quarter.startAt, r.quarter.endAt),
      createdAt: r.createdAt.toISOString(),
    })),
  };
}
