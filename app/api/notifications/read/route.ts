import { apiRequireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { handle, ok } from "@/lib/api";

export async function POST() {
  return handle(async () => {
    const user = await apiRequireUser();
    await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
    return ok();
  });
}
