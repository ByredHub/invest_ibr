import type { Prisma } from "@prisma/client";
import { computeCounters, selectBefore, type Counters, type OperationType } from "@/lib/ledger";

export interface SnapshotAsset {
  id: string;
  name: string;
  ticker: string;
  quantity: string;
  unitPriceKop: number;
  totalKop: number;
  fileId: string;
  purchasedAt: string;
}

export interface SnapshotOperation {
  id: string;
  type: OperationType;
  amountKop: number;
  effectiveDate: string;
  title: string | null;
  ticker: string | null;
  fileId: string | null;
}

export interface SnapshotIncomeRow {
  month: string;
  amountKop: number;
}

export interface ReportSnapshot {
  version: 1;
  label: string;
  periodEnd: string;
  generatedAt: string;
  investor: { id: string; fullName: string };
  counters: Counters;
  assets: SnapshotAsset[];
  income: SnapshotIncomeRow[];
  operations: SnapshotOperation[];
}

export function parseSnapshot(json: string): ReportSnapshot {
  return JSON.parse(json) as ReportSnapshot;
}

export async function buildSnapshot(
  tx: Prisma.TransactionClient,
  user: { id: string; fullName: string },
  period: { label: string; end: Date },
  now: Date,
): Promise<ReportSnapshot> {
  const { end } = period;
  const [allOps, allAssets] = await Promise.all([
    tx.operation.findMany({
      where: { userId: user.id },
      orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
      include: { asset: true },
    }),
    tx.asset.findMany({ where: { userId: user.id }, orderBy: { purchasedAt: "desc" } }),
  ]);

  const ops = selectBefore(allOps, (o) => o.effectiveDate, end);
  const assets = selectBefore(allAssets, (a) => a.purchasedAt, end);

  const byMonth = new Map<string, number>();
  for (const o of ops) {
    if (o.type !== "INCOME") continue;
    const m = o.effectiveDate.toISOString().slice(0, 7);
    byMonth.set(m, (byMonth.get(m) ?? 0) + o.amountKop);
  }

  return {
    version: 1,
    label: period.label,
    periodEnd: end.toISOString(),
    generatedAt: now.toISOString(),
    investor: { id: user.id, fullName: user.fullName },
    counters: computeCounters(ops.map((o) => ({ type: o.type as OperationType, amountKop: o.amountKop }))),
    assets: assets.map((a) => ({
      id: a.id,
      name: a.name,
      ticker: a.ticker,
      quantity: a.quantity,
      unitPriceKop: a.unitPriceKop,
      totalKop: a.totalKop,
      fileId: a.fileId,
      purchasedAt: a.purchasedAt.toISOString(),
    })),
    income: [...byMonth.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([month, amountKop]) => ({ month, amountKop })),
    operations: ops.map((o) => ({
      id: o.id,
      type: o.type as OperationType,
      amountKop: o.amountKop,
      effectiveDate: o.effectiveDate.toISOString(),
      title: o.asset?.name ?? null,
      ticker: o.asset?.ticker ?? null,
      fileId: o.asset?.fileId ?? null,
    })),
  };
}
