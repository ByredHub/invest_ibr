import Link from "next/link";
import { ArrowRight, Activity, HandCoins } from "lucide-react";
import { listAudit, listInvestorPeriods, listInvestors, pendingPayoutPeriods, pendingWithdrawalCount, sumCounters } from "@/lib/queries";
import { formatDate } from "@/lib/format";
import { PageHeader, Stat } from "@/components/parts";
import { AuditList } from "@/components/audit-list";
import { EmptyState } from "@/components/ui/field";
import { QuarterHero } from "@/components/quarter-hero";
import { PayoutQuarters } from "@/components/payout-actions";

export const metadata = { title: "Обзор" };

const fmtRange = (start: Date, end: Date) => `${formatDate(start)} — ${formatDate(new Date(end.getTime() - 86_400_000))}`;

export default async function AdminDashboard() {
  const [investors, periods, audit, pending, pendingPayout] = await Promise.all([
    listInvestors(),
    listInvestorPeriods(),
    listAudit({ take: 7 }),
    pendingWithdrawalCount(),
    pendingPayoutPeriods(),
  ]);
  const sum = sumCounters(investors);
  const active = investors.filter((i) => i.status === "ACTIVE");

  return (
    <>
      <PageHeader title="Обзор" subtitle={`Инвесторов: ${investors.length}, активных: ${active.length}`} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Всего на счетах" kop={sum.totalKop} help="Взносы и доход всех инвесторов за вычетом уже выплаченного." />
        <Stat label="Вложено в активы" kop={sum.investedKop} help="Покупки активов и переносы из свободных денег во вложения." />
        <Stat label="Свободные деньги" kop={sum.balanceKop} tone={sum.balanceKop < 0 ? "brick" : "ink"} help="Ещё не вложенные деньги по всем инвесторам." />
        <Stat label="Заработано" kop={sum.incomeKop} tone="teal" help="Весь начисленный доход по всем инвесторам." />
      </div>

      <div className="mt-6">
        <QuarterHero
          compact
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
      </div>

      {pending > 0 && (
        <Link href="/admin/payouts" className="mt-6 flex items-center justify-between gap-3 rounded-card border border-tiffany/40 bg-tiffany-50 px-5 py-3.5 text-sm transition-colors hover:bg-tiffany-100">
          <span className="flex items-center gap-3">
            <HandCoins size={18} className="text-tiffany-700" />
            <span className="font-medium">Заявок на вывод ожидает решения: {pending}</span>
          </span>
          <ArrowRight size={16} className="text-tiffany-700" />
        </Link>
      )}

      {pendingPayout.length > 0 && (
        <div className="mt-6">
          <PayoutQuarters
            compact
            quarters={pendingPayout.slice(0, 3).map((q) => ({
              id: q.id,
              investor: q.fullName,
              label: q.label,
              lockedAt: q.lockedAt.toISOString(),
              payoutOpenedAt: null,
            }))}
          />
        </div>
      )}

      <section className="card mt-6 overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-[15px] font-semibold tracking-tight">Последние действия</h2>
          <Link href="/admin/history" className="inline-flex items-center gap-1 text-[13px] font-medium text-tiffany-700 transition-colors hover:text-ink">
            Вся история <ArrowRight size={14} />
          </Link>
        </div>
        <AuditList
          items={audit.items}
          empty={<EmptyState icon={<Activity size={18} />} title="Пока нет действий" text="Здесь появятся пополнения, покупки и другие операции." />}
        />
      </section>
    </>
  );
}
