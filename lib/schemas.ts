import { z } from "zod";
import { normalizePhone } from "@/lib/phone";
import { parseDay, parseMonth, parseRubToKop } from "@/lib/ledger";
import { MAX_KOP } from "@/lib/service";

const text = (label: string, max = 120) =>
  z.string({ error: `${label}: обязательное поле` }).trim().min(1, `${label}: обязательное поле`).max(max, `${label}: слишком длинное значение`);

export const phoneSchema = z
  .string({ error: "Введите телефон" })
  .transform((v, ctx) => {
    const p = normalizePhone(v);
    if (!p) ctx.addIssue({ code: "custom", message: "Некорректный номер телефона" });
    return p ?? "";
  });

export const passwordSchema = z
  .string({ error: "Введите пароль" })
  .min(8, "Пароль должен содержать минимум 8 символов")
  .max(100, "Пароль слишком длинный");

export const amountSchema = z
  .union([z.string(), z.number()], { error: "Введите сумму" })
  .transform((v, ctx) => {
    const kop = parseRubToKop(String(v));
    if (kop === null) ctx.addIssue({ code: "custom", message: "Сумма должна быть положительной (не более 2 знаков после запятой)" });
    else if (kop > MAX_KOP) ctx.addIssue({ code: "custom", message: "Сумма превышает допустимый максимум 20 000 000 ₽" });
    return kop ?? 0;
  });

export const daySchema = z
  .string()
  .optional()
  .transform((v, ctx) => {
    if (!v) return new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");
    const d = parseDay(v);
    if (!d) ctx.addIssue({ code: "custom", message: "Некорректная дата" });
    return d ?? new Date(0);
  });

export const monthSchema = z
  .string({ error: "Выберите месяц" })
  .transform((v, ctx) => {
    const d = parseMonth(v);
    if (!d) ctx.addIssue({ code: "custom", message: "Некорректный месяц" });
    return d ?? new Date(0);
  });

export const loginSchema = z.object({ phone: phoneSchema, password: z.string().min(1, "Введите пароль").max(100) });

export const createInvestorSchema = z.object({
  fullName: text("ФИО", 160).refine((v) => v.split(/\s+/).length >= 2, "Укажите фамилию и имя"),
  phone: phoneSchema,
  password: passwordSchema,
  initialDeposit: z.union([z.string(), z.number()]).optional().transform((v, ctx) => {
    if (v === undefined || String(v).trim() === "") return undefined;
    const kop = parseRubToKop(String(v));
    if (kop === null || kop > MAX_KOP) ctx.addIssue({ code: "custom", message: "Некорректная сумма начального взноса" });
    return kop ?? undefined;
  }),
  date: daySchema,
});

export const depositSchema = z.object({ amount: amountSchema, date: daySchema });
export const transferSchema = z.object({ amount: amountSchema, date: daySchema, adminPassword: z.string().optional() });
export const incomeSchema = z.object({ month: monthSchema, amount: amountSchema });
export const passwordResetSchema = z.object({ password: passwordSchema });
export const statusSchema = z.object({ status: z.enum(["ACTIVE", "PAUSED", "CLOSED"], { error: "Некорректный статус" }) });
export const closePeriodSchema = z.object({
  all: z.boolean().optional(),
  userId: z.string().min(1).optional(),
  seq: z.number().int().positive().optional(),
});
export const openPayoutSchema = z.object({ quarterId: z.string().min(1, "Не указан период") });

export const purchaseFieldsSchema = z.object({
  name: text("Название"),
  ticker: text("Тикер", 20).transform((v) => v.toUpperCase()),
  quantity: text("Количество", 30),
  unitPrice: amountSchema,
  date: daySchema,
  adminPassword: z.string().optional(),
});
