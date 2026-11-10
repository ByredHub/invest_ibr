import Link from "next/link";
import { ArrowDownToLine, ArrowRightLeft, Banknote, CalendarCheck, HandCoins, KeyRound, TrendingUp, UnlockKeyhole, UserPlus, UserCog, XCircle, type LucideIcon } from "lucide-react";
import type { AuditItem } from "@/lib/queries";
import { formatDate, formatDateTime, formatMonth } from "@/lib/format";
import { Money, Thumb, TickerChip } from "@/components/parts";

const STATUS_RU: Record<string, string> = { ACTIVE: "Активен", PAUSED: "Приостановлен", CLOSED: "Закрыт" };

interface Row {
  icon: LucideIcon;
  title: string;
  ticker?: string;
  fileId?: string | null;
  meta?: string;
  amount?: number;
  credit?: boolean;
  neutral?: boolean;
}

function describe(a: Pick<AuditItem, "action" | "details">): Row {
  const d = a.details as Record<string, string | number | undefined>;
  const amount = typeof d.amountKop === "number" ? d.amountKop : undefined;
  const date = typeof d.date === "string" ? formatDate(d.date) : undefined;
  switch (a.action) {
    case "DEPOSIT":
      return { icon: ArrowDownToLine, title: "Пополнение", meta: date && `Дата операции ${date}`, amount, credit: true };
    case "TRANSFER":
      return { icon: ArrowRightLeft, title: "Перенос из «Остатка» во «Вложено»", meta: date && `Дата операции ${date}`, amount };
    case "PURCHASE":
      return {
        icon: ArrowRightLeft,
        title: String(d.title ?? "Покупка актива"),
        ticker: d.ticker ? String(d.ticker) : undefined,
        fileId: typeof d.fileId === "string" ? d.fileId : null,
        meta: [d.quantity && `${String(d.quantity).replace(".", ",")} ед.`, date].filter(Boolean).join(" · "),
        amount,
      };
    case "INCOME":
      return {
        icon: TrendingUp,
        title: "Доход",
        meta: typeof d.date === "string" ? `За ${formatMonth(d.date.slice(0, 7))}` : undefined,
        amount,
        credit: true,
      };
    case "WITHDRAWAL":
      return { icon: Banknote, title: "Выплата дохода", meta: date && `Дата операции ${date}`, amount };
    case "WITHDRAWAL_REQUESTED":
      return { icon: HandCoins, title: "Заявка на вывод дохода", amount, neutral: true };
    case "WITHDRAWAL_REJECTED":
      return { icon: XCircle, title: "Заявка на вывод отклонена", meta: d.reason ? `Причина: ${d.reason}` : undefined, amount, neutral: true };
    case "PAYOUT_OPENED":
      return { icon: UnlockKeyhole, title: `Вывод дохода за период ${d.seq ?? "?"} открыт`, meta: d.notified ? "Инвестор уведомлён" : undefined };
    case "INVESTOR_CREATED":
      return { icon: UserPlus, title: "Инвестор добавлен" };
    case "PASSWORD_RESET":
      return { icon: KeyRound, title: "Пароль инвестора сброшен" };
    case "STATUS_CHANGED":
      return { icon: UserCog, title: "Статус изменён", meta: `${STATUS_RU[String(d.from)] ?? d.from} → ${STATUS_RU[String(d.to)] ?? d.to}` };
    case "QUARTER_LOCKED":
      return {
        icon: CalendarCheck,
        title: `Период ${d.seq ?? "?"} закрыт`,
        meta: d.startAt && d.endAt ? `${formatDate(String(d.startAt))} — ${formatDate(new Date(new Date(String(d.endAt)).getTime() - 86_400_000).toISOString())}` : "Отчёт сформирован",
      };
    default:
      return { icon: UserCog, title: a.action };
  }
}

export function AuditList({ items, showClient = true, empty }: { items: AuditItem[]; showClient?: boolean; empty?: React.ReactNode }) {
  if (items.length === 0) return <>{empty}</>;
  return (
    <ul className="divide-y divide-line">
      {items.map((it) => {
        const r = describe(it);
        const Icon = r.icon;
        return (
          <li key={it.id} className="flex items-center gap-4 px-4 py-3 transition-colors duration-150 hover:bg-[#FBFAF7] sm:px-5">
            {r.fileId !== undefined ? (
              <Thumb fileId={r.fileId} size={48} />
            ) : (
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-md border border-line bg-paper text-muted">
                <Icon size={19} strokeWidth={1.6} />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="truncate text-sm font-medium">{r.title}</p>
                {r.ticker && <TickerChip ticker={r.ticker} />}
              </div>
              <p className="mt-0.5 truncate text-xs text-muted">
                {showClient && it.clientName && it.clientId && (
                  <>
                    <Link href={`/admin/investors/${it.clientId}`} className="text-ink/80 underline-offset-2 hover:underline">
                      {it.clientName}
                    </Link>
                    {" · "}
                  </>
                )}
                {r.meta && <>{r.meta} · </>}
                {formatDateTime(it.createdAt)}
              </p>
            </div>
            {r.amount !== undefined && (
              <Money
                kop={r.credit || r.neutral ? r.amount : -r.amount}
                sign={!r.neutral}
                className={`shrink-0 text-[15px] font-semibold ${r.credit ? "text-tiffany-700" : "text-ink"}`}
                currencyClass="text-[13px]"
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}
