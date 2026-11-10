import { apiRequireAdmin, verifyAdminPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { ApiError, handle, ok, readJson } from "@/lib/api";
import { normalizeQuantity, purchaseTotalKop } from "@/lib/ledger";
import { deleteStored, storeImage, validateImage } from "@/lib/files";
import {
  depositSchema,
  incomeSchema,
  passwordResetSchema,
  purchaseFieldsSchema,
  statusSchema,
  transferSchema,
} from "@/lib/schemas";
import { MAX_KOP, assertOpenDate, purchaseAsset, resetPassword, setStatus, simpleOperation } from "@/lib/service";

export async function POST(req: Request, ctx: { params: Promise<{ id: string; action: string }> }) {
  return handle(async () => {
    const admin = await apiRequireAdmin();
    const { id, action } = await ctx.params;

    switch (action) {
      case "deposit": {
        const d = depositSchema.parse(await readJson(req));
        const op = await simpleOperation(admin.id, id, "DEPOSIT", d.amount, d.date);
        return ok({ operationId: op.id });
      }
      case "income": {
        const d = incomeSchema.parse(await readJson(req));
        // Доход привязан к текущему дню выбранного месяца — тогда он попадает в отчётный
        // период, который идёт в этот день, и корректно блокируется при закрытии периода.
        const today = new Date();
        const lastDay = new Date(Date.UTC(d.month.getUTCFullYear(), d.month.getUTCMonth() + 1, 0)).getUTCDate();
        const day = Math.min(today.getUTCDate(), lastDay);
        const date = new Date(Date.UTC(d.month.getUTCFullYear(), d.month.getUTCMonth(), day));
        const op = await simpleOperation(admin.id, id, "INCOME", d.amount, date);
        return ok({ operationId: op.id });
      }
      case "transfer": {
        const d = transferSchema.parse(await readJson(req));
        await verifyAdminPassword(admin.id, d.adminPassword);
        const op = await simpleOperation(admin.id, id, "TRANSFER", d.amount, d.date);
        return ok({ operationId: op.id });
      }
      case "purchase": {
        const form = await req.formData().catch(() => {
          throw new ApiError(400, "Некорректный запрос");
        });
        const photo = form.get("photo");
        const fields = purchaseFieldsSchema.parse({
          name: form.get("name") ?? undefined,
          ticker: form.get("ticker") ?? undefined,
          quantity: form.get("quantity") ?? undefined,
          unitPrice: form.get("unitPrice") ?? undefined,
          date: form.get("date") || undefined,
          adminPassword: (form.get("adminPassword") as string | null) ?? undefined,
        });
        const quantity = normalizeQuantity(fields.quantity);
        if (!quantity) throw new ApiError(400, "Количество должно быть положительным числом (до 6 знаков после запятой)");
        const total = purchaseTotalKop(quantity, fields.unitPrice);
        if (!total || total > MAX_KOP) throw new ApiError(400, "Сумма покупки некорректна или превышает 20 000 000 ₽");
        await verifyAdminPassword(admin.id, fields.adminPassword);
        const client = await db.user.findUnique({ where: { id }, select: { id: true, role: true } });
        if (!client || client.role !== "INVESTOR") throw new ApiError(404, "Инвестор не найден");
        if (!(photo instanceof File)) throw new ApiError(400, "Фото товара обязательно");
        const { buf, mime } = await validateImage(photo);
        await assertOpenDate(id, fields.date);
        const storedAs = await storeImage(buf, mime);
        let asset;
        try {
          asset = await purchaseAsset(admin.id, id, {
            name: fields.name,
            ticker: fields.ticker,
            quantity,
            unitPriceKop: fields.unitPrice,
            totalKop: total,
            file: { storedAs, mime, size: buf.length },
            date: fields.date,
          });
        } catch (e) {
          await deleteStored(storedAs);
          throw e;
        }
        return ok({ assetId: asset.id, totalKop: total });
      }
      case "password": {
        const d = passwordResetSchema.parse(await readJson(req));
        await resetPassword(admin.id, id, d.password);
        return ok();
      }
      case "status": {
        const d = statusSchema.parse(await readJson(req));
        await setStatus(admin.id, id, d.status);
        return ok();
      }
      default:
        throw new ApiError(404, "Неизвестное действие");
    }
  });
}
