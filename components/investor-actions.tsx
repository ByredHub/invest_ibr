"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownToLine, ArrowRightLeft, ImagePlus, KeyRound, ShoppingBag, TrendingUp, TriangleAlert, Lock, ChevronDown } from "lucide-react";
import { MoneyInput } from "@/components/ui/money-input";
import { Modal } from "@/components/ui/modal";
import { Field, FormError, Spinner } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { postForm, postJson } from "@/components/ui/client";
import { formatRub, currentMonthIso, todayIso } from "@/lib/format";
import { parseRubToKop, purchaseTotalKop } from "@/lib/ledger";

type Kind = "deposit" | "transfer" | "purchase" | "income" | "password" | null;

const STATUSES = [
  { v: "ACTIVE", l: "Активен" },
  { v: "PAUSED", l: "Приостановлен" },
  { v: "CLOSED", l: "Закрыт" },
];

function Footer({ onCancel, busy, label, tone = "primary" }: { onCancel: () => void; busy: boolean; label: string; tone?: "primary" | "accent" }) {
  return (
    <div className="flex justify-end gap-2 pt-1">
      <button type="button" className="btn-ghost" onClick={onCancel} disabled={busy}>
        Отмена
      </button>
      <button type="submit" className={tone === "accent" ? "btn-accent" : "btn-primary"} disabled={busy}>
        {busy && <Spinner />} {label}
      </button>
    </div>
  );
}

function AmountPreview({ label, value, tone }: { label: string; value: string; tone?: "warn" }) {
  return (
    <div className={`flex items-center justify-between rounded-ctl border px-3.5 py-2.5 text-sm ${tone === "warn" ? "border-brick/30 bg-brick-50 text-brick" : "border-line bg-paper"}`}>
      <span className={tone === "warn" ? "" : "text-muted"}>{label}</span>
      <span className="num font-semibold">{value}</span>
    </div>
  );
}

export function InvestorActions({ investorId, status, balanceKop }: { investorId: string; status: string; balanceKop: number }) {
  const router = useRouter();
  const toast = useToast();
  const [kind, setKind] = useState<Kind>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [amount, setAmount] = useState("");
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pending, setPending] = useState<{ type: "transfer" | "purchase"; form: FormData | Record<string, unknown> } | null>(null);
  const [adminPassword, setAdminPassword] = useState("");

  useEffect(() => {
    if (!photo) return setPreview(null);
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  function open(k: Kind) {
    setError(null);
    setAmount("");
    setQty("");
    setPrice("");
    setPhoto(null);
    setPending(null);
    setAdminPassword("");
    setKind(k);
  }
  const close = () => !busy && (setKind(null), setPending(null));

  async function run(task: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError(null);
    try {
      await task();
      toast.push("success", success);
      setKind(null);
      setPending(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  const base = `/api/admin/investors/${investorId}`;
  const amountKop = parseRubToKop(amount);
  const total = purchaseTotalKop(qty, parseRubToKop(price) ?? 0);

  function submitSimple(type: "deposit" | "income") {
    return (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      void run(
        () => postJson(`${base}/${type}`, type === "deposit" ? { amount: f.get("amount"), date: f.get("date") } : { amount: f.get("amount"), month: f.get("month") }),
        type === "deposit" ? "Пополнение внесено" : "Доход внесён",
      );
    };
  }

  function submitTransfer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setError(null);
    setPending({ type: "transfer", form: { amount: f.get("amount"), date: f.get("date") } });
  }

  function submitPurchase(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!photo) return setError("Загрузите фото товара");
    setError(null);
    const f = new FormData(e.currentTarget);
    f.set("photo", photo);
    setPending({ type: "purchase", form: f });
  }

  function confirmDebit(e: React.FormEvent) {
    e.preventDefault();
    if (!pending) return;
    const { type, form } = pending;
    void run(async () => {
      if (type === "purchase") {
        const f = form as FormData;
        f.set("adminPassword", adminPassword);
        await postForm(`${base}/purchase`, f);
      } else {
        await postJson(`${base}/transfer`, { ...(form as Record<string, unknown>), adminPassword });
      }
    }, type === "purchase" ? "Актив куплен" : "Средства перенесены во «Вложено»");
  }

  async function changeStatus(v: string) {
    try {
      await postJson(`${base}/status`, { status: v });
      toast.push("success", "Статус обновлён");
      router.refresh();
    } catch (e) {
      toast.push("error", e instanceof Error ? e.message : "Ошибка");
    }
  }

  const transferWarn = amountKop !== null && balanceKop - amountKop < 0;
  const purchaseWarn = total !== null && balanceKop - total < 0;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-primary" onClick={() => open("deposit")}>
          <ArrowDownToLine size={16} /> Пополнить
        </button>
        <button className="btn-ghost" onClick={() => open("transfer")}>
          <ArrowRightLeft size={16} /> Перенести во «Вложено»
        </button>
        <button className="btn-ghost" onClick={() => open("purchase")}>
          <ShoppingBag size={16} /> Купить актив
        </button>
        <button className="btn-ghost" onClick={() => open("income")}>
          <TrendingUp size={16} /> Внести доход
        </button>
        <button className="btn-ghost" onClick={() => open("password")}>
          <KeyRound size={16} /> Сбросить пароль
        </button>
        <div className="relative">
          <select
            aria-label="Статус"
            value={status}
            onChange={(e) => changeStatus(e.target.value)}
            className="btn-ghost h-10 cursor-pointer appearance-none pr-9 text-left"
          >
            {STATUSES.map((s) => (
              <option key={s.v} value={s.v}>
                Статус: {s.l}
              </option>
            ))}
          </select>
          <ChevronDown size={15} className="pointer-events-none absolute right-3 top-3 text-muted" />
        </div>
      </div>

      <Modal open={kind === "deposit"} onClose={close} title="Пополнение" description="Сумма увеличит «Общую сумму» и «Остаток».">
        <form onSubmit={submitSimple("deposit")} className="space-y-4">
          <Field label="Сумма, ₽">
            <MoneyInput name="amount" placeholder="190 000" required />
          </Field>
          <Field label="Дата операции">
            <input name="date" type="date" className="input" defaultValue={todayIso()} required />
          </Field>
          <FormError message={error} />
          <Footer onCancel={close} busy={busy} label="Пополнить" />
        </form>
      </Modal>

      <Modal open={kind === "income"} onClose={close} title="Внести доход" description="Доход за месяц, например дивиденды. Увеличивает «Общую сумму» и «Остаток».">
        <form onSubmit={submitSimple("income")} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Месяц">
              <input name="month" type="month" className="input" defaultValue={currentMonthIso()} required />
            </Field>
            <Field label="Сумма, ₽">
              <MoneyInput name="amount" placeholder="2 500" required />
            </Field>
          </div>
          <FormError message={error} />
          <Footer onCancel={close} busy={busy} label="Внести доход" />
        </form>
      </Modal>

      <Modal open={kind === "password"} onClose={close} title="Сброс пароля" description="Новый пароль нужно передать инвестору лично.">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void run(() => postJson(`${base}/password`, { password: f.get("password") }), "Пароль изменён");
          }}
          className="space-y-4"
        >
          <Field label="Новый пароль" hint="Минимум 8 символов">
            <input name="password" className="input" type="text" minLength={8} required autoComplete="off" />
          </Field>
          <FormError message={error} />
          <Footer onCancel={close} busy={busy} label="Сбросить" />
        </form>
      </Modal>

      <Modal
        open={kind === "transfer" && !pending}
        onClose={close}
        title="Перенос во «Вложено»"
        description="Часть «Остатка» переходит во «Вложено». Общая сумма не меняется."
      >
        <form onSubmit={submitTransfer} className="space-y-4">
          <Field label="Сумма, ₽">
            <MoneyInput name="amount" placeholder="50 000" required value={amount} onChange={setAmount} />
          </Field>
          <Field label="Дата операции">
            <input name="date" type="date" className="input" defaultValue={todayIso()} required />
          </Field>
          <AmountPreview label="Остаток сейчас" value={formatRub(balanceKop)} />
          {transferWarn && <AmountPreview tone="warn" label="Остаток после операции станет отрицательным" value={formatRub(balanceKop - amountKop!)} />}
          <FormError message={error} />
          <Footer onCancel={close} busy={busy} label="Продолжить" />
        </form>
      </Modal>

      <Modal open={kind === "purchase" && !pending} onClose={close} wide title="Покупка актива" description="Фото товара обязательно — оно отображается в истории и карточке актива.">
        <form onSubmit={submitPurchase} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
            <Field label="Название">
              <input name="name" className="input" placeholder="Золотой слиток 100 г" required maxLength={120} autoComplete="off" />
            </Field>
            <Field label="Тикер">
              <input name="ticker" className="input uppercase" placeholder="GOLD" required maxLength={20} autoComplete="off" />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Кол-во">
              <MoneyInput name="quantity" placeholder="1" required value={qty} onChange={setQty} />
            </Field>
            <Field label="Цена за ед., ₽">
              <MoneyInput name="unitPrice" placeholder="100 000" required value={price} onChange={setPrice} />
            </Field>
            <Field label="Дата покупки">
              <input name="date" type="date" className="input" defaultValue={todayIso()} required />
            </Field>
          </div>
          <Field label="Фото товара">
            <div className="flex items-center gap-4">
              <label className="flex h-[88px] w-[88px] shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-card border border-dashed border-[#cfc9b9] bg-paper text-muted transition-colors hover:border-tiffany hover:text-tiffany-700 focus-within:ring-2 focus-within:ring-tiffany/40">
                {preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : <ImagePlus size={24} strokeWidth={1.5} />}
                <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
              </label>
              <p className="text-xs leading-relaxed text-muted">
                {photo ? <span className="text-ink">{photo.name}</span> : "Нажмите, чтобы выбрать файл."}
                <br />
                JPEG, PNG или WebP, до 5 МБ.
              </p>
            </div>
          </Field>
          <AmountPreview label="Итого к списанию" value={total ? `−${formatRub(total)}` : "—"} />
          {purchaseWarn && (
            <div className="flex gap-2.5 rounded-ctl border border-brick/30 bg-brick-50 p-3 text-[13px] leading-snug text-brick">
              <TriangleAlert size={17} className="mt-px shrink-0" />
              <p>
                Остатка недостаточно: после покупки он станет отрицательным ({formatRub(balanceKop - total!)}). Операция разрешена, но проверьте сумму.
              </p>
            </div>
          )}
          <FormError message={error} />
          <Footer onCancel={close} busy={busy} label="Продолжить" />
        </form>
      </Modal>

      <Modal open={!!pending} onClose={close} title="Подтвердите паролем" description="Списание средств — введите пароль администратора. Пароль проверяется на сервере.">
        <form onSubmit={confirmDebit} className="space-y-4">
          <div className="flex items-center gap-3 rounded-ctl border border-line bg-paper px-3.5 py-3 text-sm">
            <Lock size={16} className="shrink-0 text-muted" />
            <span>
              {pending?.type === "purchase" ? "Покупка актива" : "Перенос во «Вложено»"}
              {" на "}
              <b className="num">{formatRub(pending?.type === "purchase" ? (total ?? 0) : (amountKop ?? 0))}</b>
            </span>
          </div>
          <Field label="Пароль администратора">
            <input className="input" type="password" autoComplete="current-password" required value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} />
          </Field>
          <FormError message={error} />
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn-ghost" onClick={() => setPending(null)} disabled={busy}>
              Назад
            </button>
            <button type="submit" className="btn-accent" disabled={busy || !adminPassword}>
              {busy && <Spinner />} Подтвердить и списать
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
