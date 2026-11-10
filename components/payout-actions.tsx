"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Lock, TriangleAlert, UnlockKeyhole, X } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Field, FormError, Spinner } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { postJson } from "@/components/ui/client";
import { formatDateTime, formatRub } from "@/lib/format";

export function PayoutRowActions({ id, amountKop, balanceKop }: { id: string; amountKop: number; balanceKop: number }) {
  const router = useRouter();
  const toast = useToast();
  const [mode, setMode] = useState<"pay" | "reject" | null>(null);
  const [password, setPassword] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    if (busy) return;
    setMode(null);
    setPassword("");
    setReason("");
    setError(null);
  }

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "pay") await postJson(`/api/admin/payouts/${id}/pay`, { adminPassword: password });
      else await postJson(`/api/admin/payouts/${id}/reject`, { reason });
      toast.push("success", mode === "pay" ? "Выплата проведена" : "Заявка отклонена");
      setMode(null);
      setPassword("");
      setReason("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  const negative = balanceKop - amountKop < 0;

  return (
    <>
      <div className="flex justify-end gap-2">
        <button className="btn-primary h-9 px-3 text-[13px]" onClick={() => setMode("pay")}>
          <Check size={15} /> Выплачено
        </button>
        <button className="btn-ghost h-9 px-3 text-[13px]" onClick={() => setMode("reject")}>
          <X size={15} /> Отклонить
        </button>
      </div>

      <Modal
        open={mode === "pay"}
        onClose={close}
        title="Подтвердите выплату"
        description="Будет создана операция «Выплата дохода» с сегодняшней датой. Введите пароль администратора."
      >
        <form onSubmit={run} className="space-y-4">
          <div className="flex items-center gap-3 rounded-ctl border border-line bg-paper px-3.5 py-3 text-sm">
            <Lock size={16} className="shrink-0 text-muted" />
            <span>
              Выплата на <b className="num">{formatRub(amountKop)}</b>
            </span>
          </div>
          {negative && (
            <div className="flex gap-2.5 rounded-ctl border border-brick/30 bg-brick-50 p-3 text-[13px] leading-snug text-brick">
              <TriangleAlert size={17} className="mt-px shrink-0" />
              <p>После выплаты остаток инвестора станет отрицательным ({formatRub(balanceKop - amountKop)}). Операция разрешена.</p>
            </div>
          )}
          <Field label="Пароль администратора">
            <input className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <FormError message={error} />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={close} disabled={busy}>
              Отмена
            </button>
            <button type="submit" className="btn-accent" disabled={busy || !password}>
              {busy && <Spinner />} Подтвердить выплату
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={mode === "reject"} onClose={close} title="Отклонить заявку" description="Причина будет показана инвестору.">
        <form onSubmit={run} className="space-y-4">
          <Field label="Причина отклонения">
            <textarea className="input h-24 resize-none py-2" required minLength={3} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <FormError message={error} />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={close} disabled={busy}>
              Отмена
            </button>
            <button type="submit" className="btn-danger" disabled={busy || reason.trim().length < 3}>
              {busy && <Spinner />} Отклонить
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export interface LockedPeriodView {
  id: string;
  investor: string;
  label: string;
  lockedAt: string;
  payoutOpenedAt: string | null;
}

export function PayoutQuarters({ quarters, compact = false }: { quarters: LockedPeriodView[]; compact?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [target, setTarget] = useState<LockedPeriodView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      await postJson<{ notified: number }>("/api/admin/quarters/payout", { quarterId: target.id });
      toast.push("success", `Вывод открыт — ${target.investor}, ${target.label}`);
      setTarget(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  if (quarters.length === 0) return null;
  return (
    <section className="card overflow-hidden">
      {!compact && (
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-[15px] font-semibold tracking-tight">Вывод дохода</h2>
          <p className="mt-0.5 text-[13px] text-muted">Откройте вывод по закрытому периоду, чтобы инвестор мог забрать доход за него.</p>
        </div>
      )}
      <ul className="divide-y divide-line">
        {quarters.map((q) => (
          <li key={q.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
            <div>
              <p className="text-sm font-medium">
                {q.investor} <span className="font-normal text-muted">· {q.label}</span>
              </p>
              <p className="text-xs text-muted">
                {q.payoutOpenedAt ? `Вывод открыт ${formatDateTime(q.payoutOpenedAt)}` : `Закрыт ${formatDateTime(q.lockedAt)}`}
              </p>
            </div>
            {q.payoutOpenedAt ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-tiffany/40 bg-tiffany-50 px-2.5 py-1 text-[11px] font-medium text-tiffany-700">
                <UnlockKeyhole size={12} /> Вывод открыт
              </span>
            ) : (
              <button
                className="btn-ghost h-9 text-[13px]"
                onClick={() => {
                  setError(null);
                  setTarget(q);
                }}
              >
                <UnlockKeyhole size={15} /> Открыть вывод
              </button>
            )}
          </li>
        ))}
      </ul>
      <Modal open={!!target} onClose={() => !busy && setTarget(null)} title={`Открыть вывод — ${target?.investor ?? ""}?`} description="Действие необратимо.">
        <div className="space-y-4">
          <p className="text-[13px] leading-relaxed text-muted">
            {target?.label}. Инвестор получит уведомление и сможет отправить заявку кнопкой «Вывести», если за период начислен доход.
          </p>
          <FormError message={error} />
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setTarget(null)} disabled={busy}>
              Отмена
            </button>
            <button className="btn-primary" onClick={run} disabled={busy}>
              {busy && <Spinner />} Открыть вывод
            </button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
