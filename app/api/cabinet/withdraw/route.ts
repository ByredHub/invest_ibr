import { apiRequireUser } from "@/lib/auth";
import { ApiError, handle, ok } from "@/lib/api";
import { requestWithdrawal } from "@/lib/payout";

export async function POST() {
  return handle(async () => {
    const user = await apiRequireUser();
    if (user.role !== "INVESTOR") throw new ApiError(403, "Недостаточно прав");
    const req = await requestWithdrawal(user.id);
    return ok({ requestId: req.id, amountKop: req.amountKop });
  });
}
