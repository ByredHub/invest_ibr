import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Coins, History, ListOrdered } from "lucide-react";
import { getInvestorDetail, type AuditItem } from "@/lib/queries";
import { periodLabel } from "@/lib/service";
import { formatDateTime, formatMonth, formatRub } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { Money, Stat, StatusBadge } from "@/components/parts";
import { AuditList } from "@/components/audit-list";
import { AssetsGrid } from "@/components/assets-grid";
import { EmptyState } from "@/components/ui/field";
import { InvestorActions } from "@/components/investor-actions";
import { ReportLinks } from "@/components/report-links";
import { Tabs } from "@/components/tabs";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const d = await getInvestorDetail((await params).id);
  return { title: d?.user.fullName ?? "Инвестор" };
}

export default async function InvestorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await getInvestorDetail(id);
  if (!d) notFound();
  const { user, counters } = d;

  const opItems: AuditItem[] = d.ops.map((o) => ({
    id: o.id,
    action: o.type,
    createdAt: o.createdAt,
    actorName: "",
    clientId: user.id,
    clientName: user.fullName,
    details: {
      amountKop: o.amountKop,
      date: o.effectiveDate.toISOString().slice(0, 10),
      title: o.asset?.name,
      ticker: o.asset?.ticker,
      quantity: o.asset?.quantity,
      fileId: o.asset?.fileId,
    },
  }));

  const incomeByMonth = new Map<string, number>();
  for (const o of d.ops) {
    if (o.type !== "INCOME") continue;
    const m = o.effectiveDate.toISOString().slice(0, 7);
    incomeByMonth.set(m, (incomeByMonth.get(m) ?? 0) + o.amountKop);
  }
  const income = [...incomeByMonth.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));

  const logItems: AuditItem[] = d.logs.map((l) => ({
    id: l.id,
    action: l.action,
    createdAt: l.createdAt,
    actorName: "",
    clientId: user.id,
    clientName: user.fullName,
    details: JSON.parse(l.details) as Record<string, unknown>,
  }));

  return (
    <>
      <Link href="/admin/investors" className="mb-4 inline-flex items-center gap-1 text-[13px] text-muted transition-colors hover:text-ink">
        <ChevronLeft size={15} /> Все инвесторы
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[26px] font-semibold leading-tight tracking-tight">{user.fullName}</h1>
            <StatusBadge status={user.status} />
          </div>
          <p className="num mt-1 text-sm text-muted">{formatPhone(user.phone)}</p>
        </div>
      </div>
      <div className="mb-5">
        <InvestorActions investorId={user.id} status={user.status} balanceKop={counters.balanceKop} />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Всего на счёте" kop={counters.totalKop} help="Взносы инвестора плюс весь начисленный доход, за вычетом уже выплаченного." />
        <Stat label="Вложено в активы" kop={counters.investedKop} help="Сумма покупок активов и переносов из свободных денег во вложения." />
        <Stat label="Свободные деньги" kop={counters.balanceKop} tone={counters.balanceKop < 0 ? "brick" : "ink"} hint={counters.balanceKop < 0 ? "Отрицательный остаток" : undefined} help="Ещё не вложенные деньги: всего на счёте минус вложенное." />
        <Stat label="Заработано" kop={counters.incomeKop} tone="teal" hint={counters.paidOutKop > 0 ? `Выплачено: ${formatRub(counters.paidOutKop)}` : undefined} help="Весь доход, начисленный инвестору за всё время." />
      </div>

      {d.withdrawals.some((w) => w.status === "PENDING") && (
        <Link href="/admin/payouts" className="mb-6 flex items-center justify-between gap-3 rounded-card border border-tiffany/40 bg-tiffany-50 px-5 py-3.5 text-sm transition-colors hover:bg-tiffany-100">
          <span className="font-medium">Заявка на вывод {formatRub(d.withdrawals.find((w) => w.status === "PENDING")!.amountKop)} ожидает решения</span>
          <span className="text-tiffany-700">К заявкам →</span>
        </Link>
      )}

      <Tabs
        tabs={[
          {
            id: "ops",
            label: "История операций",
            count: opItems.length,
            content: (
              <AuditList
                showClient={false}
                items={opItems}
                empty={<EmptyState icon={<ListOrdered size={18} />} title="Операций нет" text="Пополните счёт инвестора, чтобы начать." />}
              />
            ),
          },
          { id: "assets", label: "Купленные активы", count: d.assets.length, content: <AssetsGrid assets={d.assets} /> },
          {
            id: "income",
            label: "Заработано по месяцам",
            count: income.length,
            content:
              income.length === 0 ? (
                <EmptyState icon={<Coins size={18} />} title="Доходов пока нет" text="Внесите доход за месяц кнопкой «Внести доход»." />
              ) : (
                <table className="w-full border-separate border-spacing-0">
                  <thead>
                    <tr>
                      <th className="th">Месяц</th>
                      <th className="th text-right">Сумма</th>
                    </tr>
                  </thead>
                  <tbody>
                    {income.map(([m, kop]) => (
                      <tr key={m} className="transition-colors hover:bg-[#FBFAF7]">
                        <td className="td">{formatMonth(m)}</td>
                        <td className="td text-right font-medium text-tiffany-700">
                          <Money kop={kop} sign />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ),
          },
          {
            id: "withdrawals",
            label: "Заявки на вывод",
            count: d.withdrawals.length,
            content:
              d.withdrawals.length === 0 ? (
                <EmptyState icon={<Coins size={18} />} title="Заявок на вывод нет" />
              ) : (
                <ul className="divide-y divide-line">
                  {d.withdrawals.map((w) => (
                    <li key={w.id} className="flex items-center justify-between gap-4 px-5 py-3.5 text-sm">
                      <div>
                        <p className="font-medium">{w.status === "PENDING" ? "На рассмотрении" : w.status === "PAID" ? "Выплачено" : "Отклонено"}</p>
                        <p className="text-xs text-muted">{formatDateTime(w.createdAt)}{w.rejectReason ? ` · ${w.rejectReason}` : ""}</p>
                      </div>
                      <Money kop={w.amountKop} className="font-semibold" />
                    </li>
                  ))}
                </ul>
              ),
          },
          {
            id: "reports",
            label: "Ссылки на отчёты",
            count: d.reports.length,
            content: (
              <ReportLinks
                showInvestor={false}
                rows={d.reports.map((r) => ({
                  id: r.id,
                  token: r.token,
                  label: periodLabel(r.quarter.seq, r.quarter.startAt, r.quarter.endAt),
                  createdAt: r.createdAt.toISOString(),
                  investor: { id: user.id, fullName: user.fullName },
                }))}
              />
            ),
          },
          {
            id: "log",
            label: "История действий",
            count: logItems.length,
            content: <AuditList showClient={false} items={logItems} empty={<EmptyState icon={<History size={18} />} title="Журнал пуст" />} />,
          },
        ]}
      />
    </>
  );
}
