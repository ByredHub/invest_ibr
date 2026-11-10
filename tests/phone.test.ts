import { describe, expect, it } from "vitest";
import { digitsFromPaste, formatPhoneInput, formatPhonePaste, normalizePhone, searchDigits } from "@/lib/phone";
import { parseRubToKop } from "@/lib/ledger";
import { sanitizeMoneyInput } from "@/lib/money-input";

const TARGET = "+7 999 000-00-01";

describe("formatPhoneInput", () => {
  it.each(["89990000001", "79990000001", "9990000001", "+7 999 000-00-01", "+79990000001", "8 (999) 000-00-01"])(
    "приводит %s к маске",
    (raw) => {
      expect(formatPhoneInput(raw)).toBe(TARGET);
    },
  );

  it("набор 8… после префикса +7: городские коды сохраняются, 11 цифр отбрасывают ведущую 8", () => {
    expect(formatPhoneInput("+7 8")).toBe("+7 8");
    expect(formatPhoneInput("+7 812 345-67-89")).toBe("+7 812 345-67-89");
    expect(formatPhoneInput("+7 899 900-00-001")).toBe(TARGET);
    expect(formatPhoneInput("8")).toBe("");
  });

  it("частичный ввод форматируется по маске", () => {
    expect(formatPhoneInput("+7 99")).toBe("+7 99");
    expect(formatPhoneInput("+7 9990")).toBe("+7 999 0");
    expect(formatPhoneInput("+7 9990000")).toBe("+7 999 000-0");
  });

  it("backspace поверх разделителя удаляет цифру", () => {
    expect(formatPhoneInput("+7 999 0000", "+7 999 000-0")).toBe("+7 999 000");
    expect(formatPhoneInput("+7 999 00", "+7 999 000")).toBe("+7 999 00");
    expect(formatPhoneInput("+7 999 000-00-0", "+7 999 000-00-01")).toBe("+7 999 000-00-0");
  });

  it("не больше 10 национальных цифр", () => {
    expect(formatPhoneInput("+7 999 000-00-012")).toBe(TARGET);
  });
});

describe("вставка", () => {
  it.each(["8 (999) 000-00-01", "+7(999)000-00-01", "tel:+79990000001", "9990000001", "7 999 000 00 01"])(
    "вставка %s",
    (text) => {
      expect(formatPhonePaste(text)).toBe(TARGET);
    },
  );
  it("digitsFromPaste", () => {
    expect(digitsFromPaste("89990000001")).toBe("9990000001");
    expect(digitsFromPaste("abc")).toBe("");
  });
  it("normalizePhone принимает вставленные форматы", () => {
    expect(normalizePhone("8 (999) 000-00-01")).toBe("+79990000001");
    expect(normalizePhone(TARGET)).toBe("+79990000001");
  });
  it("поиск: ведущая 8 как 7", () => {
    expect(searchDigits("8 999 000")).toBe("7999000");
  });
});

describe("суммы при вставке", () => {
  it("parseRubToKop принимает знак валюты", () => {
    expect(parseRubToKop("100 000 ₽")).toBe(10_000_000);
    expect(parseRubToKop("100\u202f000\u00a0₽")).toBe(10_000_000);
    expect(parseRubToKop("2 500,50")).toBe(250_050);
    expect(parseRubToKop("2500.5 руб.")).toBe(250_050);
    expect(parseRubToKop("abc")).toBeNull();
  });
  it("sanitizeMoneyInput", () => {
    expect(sanitizeMoneyInput("190 000 ₽")).toBe("190000");
    expect(sanitizeMoneyInput("1\u202f234,5 руб")).toBe("1234,5");
  });
});
