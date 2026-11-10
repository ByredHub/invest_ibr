"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search, Users, Award, TriangleAlert } from "lucide-react";
import { MoneyInput } from "@/components/ui/money-input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Modal } from "@/components/ui/modal";
import { Field, FormError, Spinner, EmptyState } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { postJson } from "@/components/ui/client";
import { Money, StatusBadge } from "@/components/parts";
import { formatPhone, searchDigits } from "@/lib/phone";
import { todayIso } from "@/lib/format";

export interface InvestorView {
  id: string;
  fullName: string;
  phone: string;
  status: string;
  totalKop: number;
  investedKop: number;
  balanceKop: number;
  incomeKop: number;
  rank: number | null;
}

export function NewInvestorButton() {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const res = await postJson<{ id: string }>("/api/admin/investors", {
        fullName: f.get("fullName"),
        phone: f.get("phone"),
        password: f.get("password"),
        initialDeposit: f.get("initialDeposit") || undefined,
        date: f.get("date") || undefined,
      });
      toast.push("success", "Инвестор создан");
      setOpen(false);
      router.push(`/admin/investors/${res.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className="btn-primary" onClick={() => setOpen(true)}>
        <Plus size={16} /> Новый инвестор
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Новый инвестор" description="Инвестор войдёт в кабинет по телефону и паролю, которые вы зададите.">
        <form onSubmit={submit} className="space-y-4">
          <Field label="ФИО">
            <input name="fullName" className="input" placeholder="Иванов Иван Иванович" required autoComplete="off" />
          </Field>
          <Field label="Телефон" hint="Формат +7 XXX XXX-XX-XX, будет логином">
            <PhoneInput name="phone" required />
          </Field>
          <Field label="Начальный пароль" hint="Минимум 8 символов. Передайте инвестору лично.">
            <input name="password" className="input" type="text" minLength={8} required autoComplete="off" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Начальный взнос, ₽" hint="Необязательно">
              <MoneyInput name="initialDeposit" placeholder="0" />
            </Field>
            <Field label="Дата">
              <input name="date" type="date" className="input" defaultValue={todayIso()} />
            </Field>
          </div>
          <FormError message={error} />
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
              Отмена
            </button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy && <Spinner />} Создать
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

function RankBadge({ rank }: { rank: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-tiffany-100 px-2 py-0.5 text-[11px] font-semibold text-tiffany-700" title={`№${rank} по доходу`}>
      <Award size={12} /> Топ {rank}
    </span>
  );
}

export function InvestorsTable({ rows }: { rows: InvestorView[] }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const digits = searchDigits(s);
    if (!s) return rows;
    return rows.filter((r) => r.fullName.toLowerCase().includes(s) || (digits.length > 1 && r.phone.replace(/\D/g, "").includes(digits)));
  }, [q, rows]);

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
        <div className="relative w-full sm:w-80">
          <Search size={16} className="pointer-events-none absolute left-3 top-3 text-slate2" />
          <input className="input pl-9" placeholder="Поиск по ФИО или телефону" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <p className="text-xs text-muted">
          Показано {filtered.length} из {rows.length}
        </p>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Users size={18} />} title={rows.length ? "Ничего не найдено" : "Инвесторов пока нет"} text={rows.length ? "Измените запрос поиска." : "Добавьте первого инвестора кнопкой «Новый инвестор»."} />
      ) : (
        <>
          <div className="hidden max-h-[calc(100vh-260px)] overflow-auto md:block">
            <table className="w-full border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="th">Инвестор</th>
                  <th className="th">Статус</th>
                  <th className="th text-right">Общая сумма</th>
                  <th className="th text-right">Вложено</th>
                  <th className="th text-right">Остаток</th>
                  <th className="th text-right">Доход</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const neg = r.balanceKop < 0;
                  return (
                    <tr key={r.id} className={`group transition-colors duration-150 ${neg ? "bg-brick-50/70 hover:bg-brick-50" : "hover:bg-[#FBFAF7]"}`}>
                      <td className={`td relative ${neg ? "border-l-[3px] border-l-brick" : ""}`}>
                        <Link href={`/admin/investors/${r.id}`} className="block after:absolute after:inset-0">
                          <span className="block text-sm font-medium">{r.fullName}</span>
                          <span className="num block text-xs text-muted">{formatPhone(r.phone)}</span>
                        </Link>
                      </td>
                      <td className="td">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="td text-right font-medium"><Money kop={r.totalKop} /></td>
                      <td className="td text-right"><Money kop={r.investedKop} /></td>
                      <td className={`td text-right font-medium ${neg ? "text-brick" : ""}`}>
                        <span className="inline-flex items-center gap-1.5">
                          {neg && <TriangleAlert size={14} />}
                          <Money kop={r.balanceKop} />
                        </span>
                      </td>
                      <td className="td text-right">
                        <span className="inline-flex items-center justify-end gap-2">
                          {r.rank && <RankBadge rank={r.rank} />}
                          <Money kop={r.incomeKop} className={r.incomeKop > 0 ? "font-medium text-tiffany-700" : "text-muted"} />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <ul className="divide-y divide-line md:hidden">
            {filtered.map((r) => {
              const neg = r.balanceKop < 0;
              return (
                <li key={r.id} className={neg ? "border-l-[3px] border-l-brick bg-brick-50/70" : ""}>
                  <Link href={`/admin/investors/${r.id}`} className="block px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{r.fullName}</p>
                        <p className="num text-xs text-muted">{formatPhone(r.phone)}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <StatusBadge status={r.status} />
                        {r.rank && <RankBadge rank={r.rank} />}
                      </div>
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
                      {[
                        ["Общая сумма", r.totalKop, ""],
                        ["Вложено", r.investedKop, ""],
                        ["Остаток", r.balanceKop, neg ? "text-brick font-medium" : ""],
                        ["Доход", r.incomeKop, r.incomeKop > 0 ? "text-tiffany-700 font-medium" : "text-muted"],
                      ].map(([l, v, c]) => (
                        <div key={l as string}>
                          <dt className="label-caps">{l as string}</dt>
                          <dd className={`mt-0.5 ${c}`}><Money kop={v as number} /></dd>
                        </div>
                      ))}
                    </dl>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
