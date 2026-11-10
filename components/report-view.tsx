import Link from "next/link";
import { CalendarClock, Coins } from "lucide-react";
import type { ReportSnapshot } from "@/lib/snapshot";
import { snapshotAsOf } from "@/lib/ledger";
import { formatDateLong, formatMonth } from "@/lib/format";
import { Logo, Money } from "@/components/parts";
import { AssetsGrid } from "@/components/assets-grid";
import { PortfolioDonut, type Slice } from "@/components/donut";
import { PrintButton } from "@/components/print-button";
import { EmptyState } from "@/components/ui/field";

export interface ReportTab {
  token: string;
  label: string;
}

export function ReportView({ snapshot, current, all }: { snapshot: ReportSnapshot; current: string; all: ReportTab[] }) {
  const c = snapshot.counters;
  const label = snapshot.label;
  const asOf = snapshotAsOf(new Date(snapshot.periodEnd), new Date(snapshot.generatedAt));
  const assetsSum = snapshot.assets.reduce((s, a) => s + a.totalKop, 0);

  const slices: Slice[] = snapshot.assets.map((a) => ({ name: a.name, kop: a.totalKop, kind: "asset" as const }));
  if (c.investedKop > assetsSum) slices.push({ name: "Прочие вложения", kop: c.investedKop - assetsSum, kind: "other" });
  if (c.balanceKop > 0) slices.push({ name: "Остаток", kop: c.balanceKop, kind: "balance" });

  return (
    <div>
      <div className="print-only mb-6 border-b border-line pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo size={40} />
            <div>
              <p className="text-base font-semibold">IBR Group</p>
              <p className="text-xs text-muted">Инвестиционный отчёт</p>
            </div>
          </div>
          <div className="text-right text-xs text-muted">
            <p className="text-sm font-semibold text-ink">{snapshot.investor.fullName}</p>
            <p>
              {label} · сформирован {formatDateLong(snapshot.generatedAt)}
            </p>
          </div>
        </div>
      </div>

      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="label-caps">Инвестиционный отчёт</p>
          <h1 className="mt-1 text-[26px] font-semibold leading-tight tracking-tight">{label}</h1>
          <p className="mt-1 flex items-center gap-1.5 text-[13px] text-muted">
            <CalendarClock size={14} /> Данные на {formatDateLong(asOf)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {all.length > 1 && (
            <nav aria-label="Отчётные периоды" className="flex rounded-ctl border border-line bg-white p-0.5">
              {all.map((r) => (
                <Link
                  key={r.token}
                  href={`/report/${r.token}`}
                  title={r.label}
                  className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors duration-150 ${
                    r.token === current ? "bg-ink text-white" : "text-muted hover:text-ink"
                  }`}
                >
                  {r.label.split(" ")[0]} {r.label.split(" ")[1]}
                </Link>
              ))}
            </nav>
          )}
          <PrintButton />
        </div>
      </div>

      <section className="card print-flat overflow-hidden">
        <div className="grid gap-px bg-line lg:grid-cols-[1.3fr_1fr]">
          <div className="bg-ink p-6 text-white print-flat sm:p-8">
            <p className="label-caps !text-tiffany">Общая сумма</p>
            <p className="mt-3 text-[44px] font-semibold leading-none tracking-tight sm:text-[52px]">
              <Money kop={c.totalKop} currencyClass="text-[26px] sm:text-[30px]" />
            </p>
            <p className="mt-4 text-[13px] text-white/50">Пополнения и накопленный доход на конец отчётного периода</p>
          </div>
          <div className="grid grid-cols-3 gap-px bg-line lg:grid-cols-1">
            {[
              ["Вложено", c.investedKop, "text-ink"],
              ["Остаток", c.balanceKop, c.balanceKop < 0 ? "text-brick" : "text-ink"],
              ["Доход", c.incomeKop, "text-tiffany-700"],
            ].map(([l, v, cls]) => (
              <div key={l as string} className="flex flex-col justify-center bg-white px-5 py-4">
                <p className="label-caps">{l as string}</p>
                <p className={`mt-1.5 text-xl font-semibold tracking-tight ${cls}`}>
                  <Money kop={v as number} currencyClass="text-sm" />
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="card mt-6 p-5 sm:p-7">
        <h2 className="mb-6 text-[15px] font-semibold tracking-tight">Структура портфеля</h2>
        <PortfolioDonut slices={slices} totalKop={c.totalKop} />
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-[15px] font-semibold tracking-tight">Активы</h2>
        <div className="card">
          <AssetsGrid assets={snapshot.assets} emptyText="Покупки активов будут отображены в отчёте." />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-[15px] font-semibold tracking-tight">Доход по месяцам</h2>
        <div className="card overflow-hidden">
          {snapshot.income.length === 0 ? (
            <EmptyState icon={<Coins size={18} />} title="Доходов за период нет" />
          ) : (
            <table className="w-full border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="th">Месяц</th>
                  <th className="th text-right">Доход</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.income.map((r) => (
                  <tr key={r.month}>
                    <td className="td">{formatMonth(r.month)}</td>
                    <td className="td text-right font-medium text-tiffany-700">
                      <Money kop={r.amountKop} sign />
                    </td>
                  </tr>
                ))}
                <tr>
                  <td className="px-4 py-3 text-sm font-semibold">Итого</td>
                  <td className="px-4 py-3 text-right text-sm font-semibold">
                    <Money kop={c.incomeKop} />
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </section>

      <p className="mt-8 text-center text-xs text-slate2">
        Отчёт содержит снимок данных на момент закрытия отчётного периода и не изменяется. Не является индивидуальной инвестиционной рекомендацией.
      </p>
    </div>
  );
}

