import { apiRequireAdmin } from "@/lib/auth";
import { handle, ok, readJson } from "@/lib/api";
import { openPayoutSchema } from "@/lib/schemas";
import { openPayout } from "@/lib/payout";

export async function POST(req: Request) {
  return handle(async () => {
    const admin = await apiRequireAdmin();
    const { quarterId } = openPayoutSchema.parse(await readJson(req));
    const res = await openPayout(admin.id, quarterId);
    return ok({ quarterId, notified: res.notified, label: res.label });
  });
}
