import Link from "next/link";
import { HandCoins } from "lucide-react";
import { listWithdrawals, pendingWithdrawalCount } from "@/lib/queries";
import { formatDate, formatDateTime } from "@/lib/format";
import { Money, PageHeader } from "@/components/parts";
import { EmptyState } from "@/components/ui/field";
import { PayoutRowActions } from "@/components/payout-actions";

export const metadata = { title: "Заявки на вывод" };

const STATUS = {
  PAID: { label: "Выплачено", cls: "bg-tiffany-50 text-tiffany-700 border-tiffany/40" },
  REJECTED: { label: "Отклонено", cls: "bg-brick-50 text-brick border-brick/25" },
} as const;

export default async function PayoutsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const tab = (await searchParams).tab === "processed" ? "processed" : "pending";
  const [rows, pending] = await Promise.all([listWithdrawals(tab), pendingWithdrawalCount()]);

  return (
    <>
      <PageHeader title="Заявки на вывод" subtitle="Выплаты инвесторам проводятся вручную с подтверждением паролем" />
      <div className="card overflow-hidden">
        <div className="flex gap-1 border-b border-line px-3 pt-2">
          {[
            ["pending", "На рассмотрении", pending],
            ["processed", "Обработанные", undefined],
          ].map(([id, label, count]) => {
            const on = tab === id;
            return (
              <Link
                key={id as string}
                href={id === "pending" ? "/admin/payouts" : "/admin/payouts?tab=processed"}
                className={`relative flex items-center gap-2 px-3 pb-3 pt-2 text-sm font-medium transition-colors ${on ? "text-ink" : "text-muted hover:text-ink"}`}
              >
                {label as string}
                {count !== undefined && (
                  <span className={`num rounded-full px-1.5 text-[11px] ${on ? "bg-ink text-white" : "bg-paper text-muted"}`}>{count as number}</span>
                )}
                {on && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-tiffany" />}
              </Link>
            );
          })}
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={<HandCoins size={18} />}
            title={tab === "pending" ? "Заявок на рассмотрении нет" : "Обработанных заявок пока нет"}
            text={tab === "pending" ? "Когда инвестор нажмёт «Забрать», заявка появится здесь." : undefined}
          />
        ) : (
          <>
            <div className="hidden overflow-auto md:block">
              <table className="w-full border-separate border-spacing-0">
                <thead>
                  <tr>
                    <th className="th">Инвестор</th>
                    <th className="th">{tab === "pending" ? "Заявка от" : "Решение"}</th>
                    <th className="th text-right">Сумма</th>
                    <th className="th text-right">Остаток сейчас</th>
                    <th className="th text-right">{tab === "pending" ? "Действия" : "Статус"}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="transition-colors hover:bg-[#FBFAF7]">
                      <td className="td font-medium">
                        <Link href={`/admin/investors/${r.userId}`} className="hover:underline">
                          {r.fullName}
                        </Link>
                      </td>
                      <td className="td text-muted">{formatDateTime(tab === "pending" ? r.createdAt : (r.decidedAt ?? r.createdAt))}</td>
                      <td className="td text-right font-semibold"><Money kop={r.amountKop} /></td>
                      <td className={`td text-right ${r.balanceKop < 0 ? "text-brick" : ""}`}><Money kop={r.balanceKop} /></td>
                      <td className="td text-right">
                        {tab === "pending" ? (
                          <PayoutRowActions id={r.id} amountKop={r.amountKop} balanceKop={r.balanceKop} />
                        ) : (
                          <StatusPill status={r.status} reason={r.rejectReason} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-line md:hidden">
              {rows.map((r) => (
                <li key={r.id} className="space-y-3 px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link href={`/admin/investors/${r.userId}`} className="text-sm font-medium">
                        {r.fullName}
                      </Link>
                      <p className="text-xs text-muted">{formatDate(r.decidedAt ?? r.createdAt)}</p>
                    </div>
                    <span className="text-[17px] font-semibold"><Money kop={r.amountKop} /></span>
                  </div>
                  <p className="text-xs text-muted">
                    Остаток сейчас: <Money kop={r.balanceKop} />
                  </p>
                  {tab === "pending" ? <PayoutRowActions id={r.id} amountKop={r.amountKop} balanceKop={r.balanceKop} /> : <StatusPill status={r.status} reason={r.rejectReason} />}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </>
  );

  function StatusPill({ status, reason }: { status: string; reason: string | null }) {
    const s = STATUS[status as keyof typeof STATUS] ?? STATUS.PAID;
    return (
      <span className="inline-flex flex-col items-end gap-1">
        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${s.cls}`}>{s.label}</span>
        {reason && <span className="max-w-[240px] truncate text-xs text-muted">{reason}</span>}
      </span>
    );
  }
}
