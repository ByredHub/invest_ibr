import { apiRequireAdmin } from "@/lib/auth";
import { ApiError, handle, ok, readJson } from "@/lib/api";
import { closePeriodSchema } from "@/lib/schemas";
import { closeExpiredPeriods, closeInvestorPeriod } from "@/lib/service";

export async function POST(req: Request) {
  return handle(async () => {
    const admin = await apiRequireAdmin();
    const body = closePeriodSchema.parse(await readJson(req));
    if (body.all) {
      const res = await closeExpiredPeriods(admin.id);
      return ok({ closed: res.closed });
    }
    if (!body.userId) throw new ApiError(400, "Укажите инвестора или режим массового закрытия");
    const res = await closeInvestorPeriod(admin.id, body.userId, body.seq);
    return ok({ quarterId: res.quarterId, seq: res.seq, label: res.label });
  });
}
