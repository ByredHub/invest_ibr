import type { ReactNode } from "react";
import { ImageOff } from "lucide-react";
import { formatRubParts } from "@/lib/format";
import { Hint } from "@/components/ui/hint";

export function Logo({ size = 32 }: { size?: number }) {
  return (
    <span className="grid shrink-0 place-items-center overflow-hidden rounded-lg bg-[#F8FAFB]" style={{ width: size, height: size }}>
      <img src="/logo.webp" alt="IBR Group" width={size} height={size} className="h-full w-full object-contain p-[2px]" />
    </span>
  );
}

export function Wordmark({ dark = false, sub = "Инвесторам" }: { dark?: boolean; sub?: string }) {
  return (
    <span className="flex items-center gap-2.5">
      <Logo />
      <span className="leading-none">
        <span className={`block text-[15px] font-semibold tracking-tight ${dark ? "text-ink" : "text-white"}`}>IBR Group</span>
        <span className={`mt-1 block text-[10px] font-medium uppercase tracking-[0.14em] ${dark ? "text-muted" : "text-white/45"}`}>{sub}</span>
      </span>
    </span>
  );
}

/** Money with muted currency sign. size controls the numeric font. */
export function Money({
  kop,
  sign,
  className = "",
  currencyClass = "",
}: {
  kop: number;
  sign?: boolean;
  className?: string;
  currencyClass?: string;
}) {
  const p = formatRubParts(kop, { sign });
  return (
    <span className={`num whitespace-nowrap ${className}`}>
      {p.sign}
      {p.int}
      {p.frac && <span className="opacity-60">{p.frac}</span>}
      <span className={`ml-[0.18em] font-normal opacity-50 ${currencyClass}`}>₽</span>
    </span>
  );
}

export function Thumb({ fileId, size = 48, className = "" }: { fileId: string | null; size?: number; className?: string }) {
  if (!fileId) {
    return (
      <span className={`grid shrink-0 place-items-center rounded-md border border-line bg-paper text-slate2 ${className}`} style={{ width: size, height: size }}>
        <ImageOff size={Math.round(size / 3)} />
      </span>
    );
  }
  return (
    <img
      src={`/api/files/${fileId}`}
      alt=""
      width={size}
      height={size}
      className={`shrink-0 rounded-md border border-line bg-paper object-cover ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

const STATUS: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: "Активен", cls: "bg-tiffany-50 text-tiffany-700 border-tiffany/40" },
  PAUSED: { label: "Приостановлен", cls: "bg-[#F5EFDD] text-[#7A6122] border-sand" },
  CLOSED: { label: "Закрыт", cls: "bg-[#EFEEEA] text-muted border-line" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? STATUS.CLOSED;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${s.cls}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {s.label}
    </span>
  );
}

export function TickerChip({ ticker }: { ticker: string }) {
  return <span className="rounded border border-line bg-paper px-1.5 py-px text-[11px] font-medium tracking-wide text-muted">{ticker}</span>;
}

export function Stat({ label, kop, tone = "ink", hint, help }: { label: string; kop: number; tone?: "ink" | "teal" | "brick"; hint?: string; help?: string }) {
  const color = tone === "teal" ? "text-tiffany-700" : tone === "brick" ? "text-brick" : "text-ink";
  return (
    <div className="card p-5">
      <p className="label-caps">
        {label} {help && <Hint text={help} />}
      </p>
      <p className={`mt-2.5 text-[32px] font-semibold leading-none tracking-tight ${color}`}>
        <Money kop={kop} currencyClass="text-[20px]" />
      </p>
      {hint && <p className="mt-2.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
