/** Strips currency marks, spaces and letters from a pasted/typed money or quantity value. Keeps digits and , . separators. */
export function sanitizeMoneyInput(text: string): string {
  return text
    .replace(/руб\.?|rub|₽|р\./gi, "")
    .replace(/[^\d.,]/g, "");
}
