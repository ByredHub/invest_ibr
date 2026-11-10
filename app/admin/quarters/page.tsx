import { listInvestorPeriods, listInvestors, listLockedPeriods, listReportLinks } from "@/lib/queries";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/parts";
import { QuarterHero } from "@/components/quarter-hero";
import { PayoutQuarters } from "@/components/payout-actions";
import { ReportLinks } from "@/components/report-links";

export const metadata = { title: "Отчётные периоды" };

const fmtRange = (start: Date, end: Date) => `${formatDate(start)} — ${formatDate(new Date(end.getTime() - 86_400_000))}`;

export default async function QuartersPage() {
  const [investors, periods, links, locked] = await Promise.all([listInvestors(), listInvestorPeriods(), listReportLinks(), listLockedPeriods()]);
  const active = investors.filter((i) => i.status === "ACTIVE");

  const byInvestor = new Map<string, typeof links>();
  for (const l of links) {
    const arr = byInvestor.get(l.user.id) ?? [];
    arr.push(l);
    byInvestor.set(l.user.id, arr);
  }

  return (
    <>
      <PageHeader title="Отчётные периоды" subtitle="У каждого инвестора свой квартал — 3 месяца от даты первого взноса" />
      <QuarterHero
        activeInvestors={active.length}
        aumKop={active.reduce((s, i) => s + i.counters.totalKop, 0)}
        investors={periods.map((p) => ({
          userId: p.userId,
          fullName: p.fullName,
          status: p.status,
          anchor: p.anchor.toISOString(),
          currentSeq: p.currentSeq,
          currentRange: fmtRange(p.currentStart, p.currentEnd),
          expiredCount: p.expiredCount,
          closedCount: p.quarters.length,
          lastClosedAt: p.quarters[0]?.lockedAt.toISOString() ?? null,
        }))}
      />

      <div className="mt-6">
        <PayoutQuarters
          quarters={locked.map((l) => ({
            id: l.id,
            investor: l.fullName,
            label: l.label,
            lockedAt: l.lockedAt.toISOString(),
            payoutOpenedAt: l.payoutOpenedAt?.toISOString() ?? null,
          }))}
        />
      </div>

      {byInvestor.size === 0 ? (
        <section className="card mt-6">
          <ReportLinks rows={[]} />
        </section>
      ) : (
        [...byInvestor.entries()].map(([userId, rows]) => (
          <section key={userId} className="card mt-6 overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 className="text-[15px] font-semibold tracking-tight">Ссылки на отчёты · {rows[0].user.fullName}</h2>
              <span className="text-xs text-muted">{rows.length} шт.</span>
            </div>
            <ReportLinks
              rows={rows.map((l) => ({ id: l.id, token: l.token, label: l.label, createdAt: l.createdAt.toISOString(), investor: { id: l.user.id, fullName: l.user.fullName } }))}
            />
          </section>
        ))
      )}
    </>
  );
}
