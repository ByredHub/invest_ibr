import { apiRequireAdmin } from "@/lib/auth";
import { handle, ok, readJson } from "@/lib/api";
import { createInvestorSchema } from "@/lib/schemas";
import { createInvestor } from "@/lib/service";

export async function POST(req: Request) {
  return handle(async () => {
    const admin = await apiRequireAdmin();
    const d = createInvestorSchema.parse(await readJson(req));
    const user = await createInvestor(admin.id, {
      fullName: d.fullName,
      phone: d.phone,
      password: d.password,
      initialDepositKop: d.initialDeposit,
      date: d.date,
    });
    return ok({ id: user.id });
  });
}
