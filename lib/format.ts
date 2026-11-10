const NNBSP = "\u202f";
const NBSP = "\u00a0";

function group(int: string): string {
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, NNBSP);
}

export function formatRubParts(kop: number, opts: { sign?: boolean } = {}): { sign: string; int: string; frac: string } {
  const abs = Math.abs(kop);
  const int = group(String(Math.floor(abs / 100)));
  const f = abs % 100;
  const frac = f ? `,${String(f).padStart(2, "0")}` : "";
  const sign = kop < 0 ? "\u2212" : opts.sign && kop > 0 ? "+" : "";
  return { sign, int, frac };
}

/** «192 500 ₽» with narrow no-break spaces. */
export function formatRub(kop: number, opts: { sign?: boolean } = {}): string {
  const p = formatRubParts(kop, opts);
  return `${p.sign}${p.int}${p.frac}${NBSP}₽`;
}

export function formatQty(q: string): string {
  const [i, f] = q.split(".");
  return f ? `${group(i)},${f}` : group(i);
}

const dateFmt = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
const dateLongFmt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const dateTimeFmt = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow",
});
const monthFmt = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric", timeZone: "UTC" });

export const formatDate = (d: Date | string) => dateFmt.format(new Date(d));
export const formatDateLong = (d: Date | string) => dateLongFmt.format(new Date(d));
export const formatDateTime = (d: Date | string) => dateTimeFmt.format(new Date(d));
export function formatMonth(ym: string): string {
  const s = monthFmt.format(new Date(`${ym}-01T00:00:00Z`));
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/\s*г\.$/, "");
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
export function currentMonthIso(): string {
  return todayIso().slice(0, 7);
}

export function initials(fullName: string): string {
  return fullName.split(/\s+/).slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join("");
}
