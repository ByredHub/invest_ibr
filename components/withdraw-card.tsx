"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock, HandCoins, X } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { FormError, Spinner } from "@/components/ui/field";
import { Hint } from "@/components/ui/hint";
import { useToast } from "@/components/ui/toast";
import { postJson } from "@/components/ui/client";
import { Money } from "@/components/parts";
import { formatDate, formatRub } from "@/lib/format";
import type { LiveRequest } from "@/lib/cabinet-live";

export function WithdrawCard({
  available,
  payoutOpen,
  active,
  requests,
}: {
  available: number;
  payoutOpen: boolean;
  active: boolean;
  requests: LiveRequest[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = requests.find((r) => r.status === "PENDING");
  const past = requests.filter((r) => r.status !== "PENDING").slice(0, 4);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await postJson("/api/cabinet/withdraw");
      setOpen(false);
      toast.push("success", "Заявка на вывод отправлена");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  const canRequest = active && !pending && available > 0;
  const hint = !active
    ? "Вывод доступен активным инвесторам"
    : pending
      ? null
      : !payoutOpen
        ? "Вывести деньги можно будет после закрытия квартала — мы вас уведомим"
        : available === 0
          ? "К выводу доступен только заработанный доход — пока начислений нет"
          : "Выведется весь заработанный доход за закрытые кварталы";

  return (
    <section className="no-print flex flex-col rounded-card bg-ink p-6 text-white sm:p-7">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/5 text-tiffany">
          <HandCoins size={16} />
        </span>
        <p className="label-caps !text-tiffany">
          Доступно к выводу{" "}
          <Hint dark text="Заработанный доход, который можно вывести на свой счёт. Основные вложения остаются работать." />
        </p>
      </div>

      {pending ? (
        <>
          <p className="mt-5 text-[40px] font-semibold leading-none tracking-tight">
            <Money kop={pending.amountKop} currencyClass="text-[24px]" />
          </p>
          <div className="mt-5 flex items-start gap-3 rounded-ctl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm">
            <Clock size={17} className="mt-0.5 shrink-0 text-tiffany" />
            <p className="leading-snug text-white/80">
              Заявка на {formatRub(pending.amountKop)} на рассмотрении
              <span className="block text-xs text-white/45">Отправлена {formatDate(pending.createdAt)}</span>
            </p>
          </div>
        </>
      ) : (
        <>
          <p className="mt-5 text-[40px] font-semibold leading-none tracking-tight">
            <Money kop={available} currencyClass="text-[24px]" />
          </p>
          <button className="btn-accent mt-6 h-12 w-full text-[15px] font-semibold" disabled={!canRequest} onClick={() => setOpen(true)}>
            {canRequest ? `Вывести ${formatRub(available)}` : "Вывести деньги"}
          </button>
          {hint && <p className="mt-3 text-xs leading-relaxed text-white/50">{hint}</p>}
        </>
      )}

      {past.length > 0 && (
        <ul className="mt-6 space-y-2.5 border-t border-white/10 pt-4">
          {past.map((r) => (
            <li key={r.id} className="flex items-start gap-2.5 text-[13px]">
              {r.status === "PAID" ? <Check size={15} className="mt-0.5 shrink-0 text-tiffany" /> : <X size={15} className="mt-0.5 shrink-0 text-[#f0906a]" />}
              <div className="min-w-0 flex-1">
                <p className="text-white/85">
                  <span className="num">{formatRub(r.amountKop)}</span> · {r.status === "PAID" ? "выплачено" : "отклонено"}
                </p>
                <p className="text-xs text-white/40">
                  {formatDate(r.decidedAt ?? r.createdAt)}
                  {r.rejectReason ? ` · ${r.rejectReason}` : ""}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={open} onClose={() => !busy && setOpen(false)} title="Вывод дохода" description="Заявка уйдёт менеджеру — после одобрения деньги переведут на ваш счёт.">
        <div className="space-y-4 text-ink">
          <div className="rounded-ctl border border-line bg-paper px-4 py-3.5">
            <p className="label-caps">Сумма к выводу</p>
            <p className="mt-1.5 text-2xl font-semibold tracking-tight">
              <Money kop={available} currencyClass="text-base" />
            </p>
          </div>
          <FormError message={error} />
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setOpen(false)} disabled={busy}>
              Отмена
            </button>
            <button className="btn-primary" onClick={submit} disabled={busy}>
              {busy && <Spinner />} Отправить заявку
            </button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
