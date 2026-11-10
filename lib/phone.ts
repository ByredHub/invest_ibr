/** Normalizes Russian phone numbers to +7XXXXXXXXXX. Returns null when invalid. */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 11 && (digits[0] === "7" || digits[0] === "8")) return `+7${digits.slice(1)}`;
  if (digits.length === 10) return `+7${digits}`;
  return null;
}

export function formatPhone(phone: string): string {
  const m = /^\+7(\d{3})(\d{3})(\d{2})(\d{2})$/.exec(phone);
  return m ? `+7 ${m[1]} ${m[2]}-${m[3]}-${m[4]}` : phone;
}

const NATIONAL_LEN = 10;

/** Digits of a pasted phone: 11 digits starting with 7/8 lose the leading digit; result is at most 10 digits. */
export function digitsFromPaste(text: string): string {
  let d = text.replace(/\D/g, "");
  if (d.length > NATIONAL_LEN && (d[0] === "7" || d[0] === "8")) d = d.slice(1);
  return d.slice(0, NATIONAL_LEN);
}

/** National digits (without country code) from what the user currently has in the field. */
export function nationalDigits(raw: string): string {
  const t = raw.trim();
  if (t.startsWith("+7")) {
    const n = t.slice(2).replace(/\D/g, "");
    if (n.length > NATIONAL_LEN && (n[0] === "7" || n[0] === "8")) return n.slice(1, NATIONAL_LEN + 1);
    return n.slice(0, NATIONAL_LEN);
  }
  const d = t.replace(/\D/g, "");
  if (d.length === 1 && (d === "7" || d === "8")) return "";
  if (d.length > NATIONAL_LEN && (d[0] === "7" || d[0] === "8")) return d.slice(1, NATIONAL_LEN + 1);
  return d.slice(0, NATIONAL_LEN);
}

export function formatNational(digits: string): string {
  const a = digits.slice(0, 3);
  const b = digits.slice(3, 6);
  const c = digits.slice(6, 8);
  const e = digits.slice(8, 10);
  let out = "+7";
  if (a) out += ` ${a}`;
  if (b) out += ` ${b}`;
  if (c) out += `-${c}`;
  if (e) out += `-${e}`;
  return out;
}

/** Formats raw input as "+7 XXX XXX-XX-XX"; `prev` makes backspace over separators remove a digit. Empty national part gives "". */
export function formatPhoneInput(raw: string, prev = ""): string {
  let digits = nationalDigits(raw);
  const prevDigits = nationalDigits(prev);
  if (raw.length < prev.length && digits === prevDigits && digits.length > 0) digits = digits.slice(0, -1);
  return digits ? formatNational(digits) : "";
}

export function formatPhonePaste(text: string): string {
  const d = digitsFromPaste(text);
  return d ? formatNational(d) : "";
}

/** Digits used by the investors search; leading 8 is treated as 7. */
export function searchDigits(q: string): string {
  const d = q.replace(/\D/g, "");
  return d.startsWith("8") ? `7${d.slice(1)}` : d;
}
