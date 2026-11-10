"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, Lock, TriangleAlert } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { FormError, Spinner } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { postJson } from "@/components/ui/client";
import { Money } from "@/components/parts";

export interface InvestorPeriodItem {
  userId: string;
  fullName: string;
  status: string;
  anchor: string | null;
  currentSeq: number | null;
  currentRange: string | null; // "10.11.2026 — 09.02.2027"
  expiredCount: number;
  closedCount: number;
  lastClosedAt: string | null;
}

export function QuarterHero({
  investors,
  activeInvestors,
  aumKop,
  compact = false,
}: {
  investors: InvestorPeriodItem[];
  activeInvestors: number;
  aumKop: number;
  compact?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [confirmAll, setConfirmAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closingUser, setClosingUser] = useState<string | null>(null);

  const expiredTotal = investors.reduce((s, i) => s + i.expiredCount, 0);

  async function closeAll() {
    setBusy(true);
    setError(null);
    try {
      const res = await postJson<{ closed: number }>("/api/admin/quarters", { all: true });
      setConfirmAll(false);
      toast.push("success", res.closed > 0 ? `Закрыто периодов: ${res.closed}` : "Закрывать нечего — все периоды актуальны");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  async function closeOne(item: InvestorPeriodItem) {
    setClosingUser(item.userId);
    try {
      const res = await postJson<{ label: string }>("/api/admin/quarters", { userId: item.userId });
      toast.push("success", `${item.fullName}: закрыт ${res.label}`);
      router.refresh();
    } catch (e) {
      toast.push("error", e instanceof Error ? e.message : "Ошибка");
    } finally {
      setClosingUser(null);
    }
  }

  const list = (
    <ul className="divide-y divide-white/10">
      {investors.map((i) => (
        <li key={i.userId} className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{i.fullName}</p>
            <p className="text-xs text-white/45">
              {i.currentSeq === null
                ? "Пополнений ещё не было"
                : `Идёт квартал ${i.currentSeq} · ${i.currentRange}`}
              {i.closedCount > 0 && ` · закрыто: ${i.closedCount}`}
            </p>
          </div>
          {i.expiredCount > 0 && i.status === "ACTIVE" ? (
            <button
              className="btn-ghost h-8 border-white/20 px-3 text-[12px] text-white hover:bg-white/10"
              disabled={closingUser === i.userId}
              onClick={() => closeOne(i)}
            >
              {closingUser === i.userId ? <Spinner /> : <Lock size={13} />}
              Закрыть {i.expiredCount === 1 ? "период" : `периоды (${i.expiredCount})`}
            </button>
          ) : i.currentSeq !== null ? (
            <span className="text-[11px] text-white/35">{i.expiredCount > 0 ? "Неактивен" : "Актуально"}</span>
          ) : null}
        </li>
      ))}
    </ul>
  );

  const confirmModal = (
    <Modal open={confirmAll} onClose={() => !busy && setConfirmAll(false)} title="Закрыть завершившиеся периоды?" description="Это действие нельзя отменить.">
      <div className="space-y-4 text-ink">
        <div className="flex gap-3 rounded-ctl border border-sand bg-[#F8F3E4] p-3.5 text-[13px] leading-relaxed text-[#6B5A22]">
          <TriangleAlert size={18} className="mt-0.5 shrink-0" />
          <p>
            У всех активных инвесторов будут закрыты периоды, срок которых истёк ({expiredTotal} шт.). Для каждого будет создан отчёт со
            снимком данных и отправлено уведомление. Операции с датами закрытых периодов станут недоступны.
          </p>
        </div>
        <FormError message={error} />
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={() => setConfirmAll(false)} disabled={busy}>
            Отмена
          </button>
          <button className="btn-primary" onClick={closeAll} disabled={busy}>
            {busy && <Spinner />}
            Да, закрыть {expiredTotal} {expiredTotal === 1 ? "период" : "периодов"}
          </button>
        </div>
      </div>
    </Modal>
  );

  if (compact) {
    if (expiredTotal === 0) return null;
    return (
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-card bg-ink px-6 py-5 text-white">
        <div>
          <p className="text-sm font-semibold">Завершились отчётные периоды: {expiredTotal}</p>
          <p className="mt-0.5 text-xs text-white/55">Закройте их, чтобы сформировать отчёты инвесторов.</p>
        </div>
        <button onClick={() => setConfirmAll(true)} className="btn-accent h-10 px-4 text-[13px] font-semibold">
          <CalendarCheck size={16} /> Закрыть периоды
        </button>
        {confirmModal}
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-card bg-ink text-white">
      <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div>
          <p className="label-caps !text-tiffany">Отчётные периоды</p>
          <p className="mt-4 text-sm leading-relaxed text-white/60">
            У каждого инвестора свой квартал — 3 месяца от даты первого взноса. Закрытие формирует отчёт со снимком данных и открывает
            доступ в личном кабинете.
          </p>
          <dl className="mt-7 grid grid-cols-2 gap-6">
            <div>
              <dt className="label-caps !text-white/45">Активных инвесторов</dt>
              <dd className="num mt-2 text-[32px] font-semibold leading-none tracking-tight">{activeInvestors}</dd>
            </div>
            <div>
              <dt className="label-caps !text-white/45">Активы под управлением</dt>
              <dd className="mt-2 text-[32px] font-semibold leading-none tracking-tight">
                <Money kop={aumKop} currencyClass="text-[20px]" />
              </dd>
            </div>
          </dl>
        </div>

        <div className="flex flex-col justify-center rounded-card border border-white/10 bg-white/[0.04] p-6 text-center sm:p-8">
          <p className="mx-auto max-w-xs text-sm leading-relaxed text-white/60">
            {expiredTotal > 0
              ? `У инвесторов завершились отчётные периоды (${expiredTotal} шт.) — их можно закрыть и сформировать отчёты.`
              : "Сейчас нет завершившихся периодов. Они появятся здесь, когда у инвесторов истечёт очередной квартал."}
          </p>
          <button
            onClick={() => {
              setError(null);
              setConfirmAll(true);
            }}
            disabled={expiredTotal === 0}
            className="mt-6 flex min-h-[72px] w-full items-center justify-center gap-3 rounded-xl bg-tiffany px-6 py-4 text-[15px] font-bold uppercase leading-tight tracking-[0.06em] text-ink transition-colors duration-150 hover:bg-[#7adcd8] disabled:opacity-40"
          >
            <CalendarCheck size={22} className="shrink-0" />
            Закрыть завершившиеся периоды{expiredTotal > 0 ? ` (${expiredTotal})` : ""}
          </button>
          <p className="mt-3 text-xs text-white/40">Действие необратимо</p>
        </div>
      </div>

      <div className="border-t border-white/10 px-6 py-4 sm:px-8">{list}</div>
      {confirmModal}
    </section>
  );
}
