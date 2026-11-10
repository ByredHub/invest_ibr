import { z } from "zod";
import { apiRequireAdmin, verifyAdminPassword } from "@/lib/auth";
import { ApiError, handle, ok, readJson } from "@/lib/api";
import { payRequest, rejectRequest } from "@/lib/payout";

const paySchema = z.object({ adminPassword: z.string().optional() });
const rejectSchema = z.object({
  reason: z.string({ error: "Укажите причину отклонения" }).trim().min(3, "Укажите причину отклонения").max(300, "Причина слишком длинная"),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string; action: string }> }) {
  return handle(async () => {
    const admin = await apiRequireAdmin();
    const { id, action } = await ctx.params;
    if (action === "pay") {
      const { adminPassword } = paySchema.parse(await readJson(req));
      await verifyAdminPassword(admin.id, adminPassword);
      await payRequest(admin.id, id);
      return ok();
    }
    if (action === "reject") {
      const { reason } = rejectSchema.parse(await readJson(req));
      await rejectRequest(admin.id, id, reason);
      return ok();
    }
    throw new ApiError(404, "Неизвестное действие");
  });
}
