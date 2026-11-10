import Link from "next/link";
import { ArrowUpRight, Coins, FileText } from "lucide-react";
import type { LiveData } from "@/lib/cabinet-live";
import { formatDate, formatMonth } from "@/lib/format";
import { Money } from "@/components/parts";
import { AssetsGrid } from "@/components/assets-grid";
import { PortfolioDonut, type Slice } from "@/components/donut";
import { IncomeChart } from "@/components/income-chart";
import { WithdrawCard } from "@/components/withdraw-card";
import { EmptyState } from "@/components/ui/field";
import { Hint } from "@/components/ui/hint";

export function LiveCabinet({ data, name }: { data: LiveData; name: string }) {
  const c = data.counters;
  const assetsSum = data.assets.reduce((s, a) => s + a.totalKop, 0);
  const slices: Slice[] = data.assets.map((a) => ({ name: a.name, kop: a.totalKop, kind: "asset" as const }));
  if (c.investedKop > assetsSum) slices.push({ name: "Прочие вложения", kop: c.investedKop - assetsSum, kind: "other" });
  if (c.balanceKop > 0) slices.push({ name: "Остаток", kop: c.balanceKop, kind: "balance" });
  const monthLabel = formatMonth(data.monthKey).toLowerCase();
  const firstName = name.split(/\s+/)[1] ?? name;

  return (
    <div>
      <div className="mb-6">
        <p className="label-caps">Личный кабинет</p>
        <h1 className="mt-1 text-[26px] font-semibold leading-tight tracking-tight">{firstName}, ваш портфель</h1>
        <p className="mt-1.5 flex items-center gap-2 text-[13px] text-muted">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-tiffany opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-tiffany" />
          </span>
          Данные обновляются по мере начислений
        </p>
      </div>

      <section className="card overflow-hidden">
        <div className="grid gap-px bg-line lg:grid-cols-[1.3fr_1fr]">
          <div className="bg-ink p-6 text-white sm:p-8">
            <p className="label-caps !text-tiffany">
              Всего на счёте{" "}
              <Hint dark text="Все ваши взносы плюс весь заработанный доход. Из этой суммы часть вложена в активы, а часть лежит свободными деньгами." />
            </p>
            <p className="mt-3 text-[44px] font-semibold leading-none tracking-tight sm:text-[52px]">
              <Money kop={c.totalKop} currencyClass="text-[26px] sm:text-[30px]" />
            </p>
            <p className="mt-4 text-[13px] text-white/50">Всё, что вы внесли, плюс заработанный доход</p>
          </div>
          <div className="grid grid-cols-3 gap-px bg-line lg:grid-cols-1">
            {[
              ["Вложено в активы", c.investedKop, "text-ink", "Деньги, которые сейчас работают в купленных активах — недвижимости, металлах, облигациях."],
              ["Свободные деньги", c.balanceKop, c.balanceKop < 0 ? "text-brick" : "text-ink", "Остаток на счёте, который ещё не вложен в активы."],
              ["Заработано", c.incomeKop, "text-tiffany-700", "Весь доход, начисленный вам за всё время инвестирования."],
            ].map(([l, v, cls, hint]) => (
              <div key={l as string} className="flex flex-col justify-center bg-white px-5 py-4">
                <p className="label-caps">
                  {l as string} <Hint text={hint as string} />
                </p>
                <p className={`mt-1.5 text-xl font-semibold tracking-tight ${cls}`}>
                  <Money kop={v as number} currencyClass="text-sm" />
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <section className="card p-5 sm:p-7">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[15px] font-semibold tracking-tight">
              Сколько вы заработали{" "}
              <Hint text="Доход начисляется ежемесячно. Ниже — сколько вы заработали в этом месяце и за весь текущий квартал." />
            </h2>
            <span className="flex items-center gap-2 text-xs text-muted">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-tiffany opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-tiffany" />
              </span>
              обновляется по мере начислений
            </span>
          </div>
          <div className="mt-5 grid gap-6 sm:grid-cols-2">
            <div>
              <p className="label-caps">За {monthLabel}</p>
              <p className="mt-2 text-[32px] font-semibold leading-none tracking-tight text-tiffany-700">
                <Money kop={data.monthIncomeKop} sign currencyClass="text-[20px]" />
              </p>
            </div>
            <div>
              <p className="label-caps">{data.periodLabel ? `За текущий ${data.periodLabel.charAt(0).toLowerCase()}${data.periodLabel.slice(1)}` : "За текущий период"}</p>
              <p className="mt-2 text-[32px] font-semibold leading-none tracking-tight">
                <Money kop={data.periodIncomeKop} sign currencyClass="text-[20px]" />
              </p>
            </div>
          </div>

          {data.income.length === 0 ? (
            <div className="mt-6 rounded-card border border-dashed border-line">
              <EmptyState icon={<Coins size={18} />} title="Начислений пока нет" text="Как только менеджер внесёт доход, он сразу появится здесь, и вы получите уведомление." />
            </div>
          ) : (
            <>
              <div className="mt-6">
                <IncomeChart income={data.income} endMonth={data.monthKey} />
              </div>
              <ul className="mt-4 divide-y divide-line border-t border-line">
                {data.income.map((r, i) => (
                  <li key={r.month} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <span className="flex items-center gap-2.5">
                      {i === 0 && <span className="h-1.5 w-1.5 rounded-full bg-tiffany" />}
                      <span className={i === 0 ? "font-medium" : ""}>{formatMonth(r.month)}</span>
                      <span className="text-xs text-muted">обновлено {formatDate(r.lastAt)}</span>
                    </span>
                    <span className="font-medium text-tiffany-700">
                      <Money kop={r.amountKop} sign />
                    </span>
                  </li>
                ))}
                <li className="flex items-center justify-between py-3 text-sm font-semibold">
                  <span>Итого</span>
                  <Money kop={c.incomeKop} />
                </li>
              </ul>
            </>
          )}
        </section>

        <WithdrawCard available={data.available} payoutOpen={data.payoutOpen} active={data.active} requests={data.requests} />
      </div>

      <section className="card mt-6 p-5 sm:p-7">
        <h2 className="mb-6 text-[15px] font-semibold tracking-tight">
          Из чего состоит ваш портфель{" "}
          <Hint text="Как распределены ваши деньги: сколько в каждом активе и сколько лежит свободными." />
        </h2>
        <PortfolioDonut slices={slices} totalKop={c.totalKop} />
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-[15px] font-semibold tracking-tight">
          Ваши активы{" "}
          <Hint text="Всё, что куплено на ваши деньги. Нажмите на актив, чтобы посмотреть фото и детали." />
        </h2>
        <div className="card">
          <AssetsGrid assets={data.assets} emptyText="Купленные активы с фотографиями появятся здесь." />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-[15px] font-semibold tracking-tight">
          Отчёты за кварталы{" "}
          <Hint text="После каждого квартала здесь появляется официальный отчёт — его можно открыть и скачать в PDF." />
        </h2>
        <div className="card overflow-hidden">
          {data.reports.length === 0 ? (
            <EmptyState icon={<FileText size={18} />} title="Отчётов пока нет" text="После закрытия квартала здесь появится архив отчётов с выгрузкой в PDF." />
          ) : (
            <ul className="divide-y divide-line">
              {data.reports.map((r) => (
                <li key={r.token}>
                  <Link href={`/report/${r.token}`} className="flex items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-[#FBFAF7]">
                    <span className="flex items-center gap-3">
                      <span className="grid h-10 w-10 place-items-center rounded-md border border-line bg-paper text-muted">
                        <FileText size={18} strokeWidth={1.6} />
                      </span>
                      <span>
                        <span className="block text-sm font-medium">Отчёт за {r.label}</span>
                        <span className="block text-xs text-muted">Сформирован {formatDate(r.createdAt)} · PDF</span>
                      </span>
                    </span>
                    <ArrowUpRight size={17} className="text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
