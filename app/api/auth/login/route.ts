import bcrypt from "bcryptjs";
import { createSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { ApiError, handle, ok, readJson } from "@/lib/api";
import { loginSchema } from "@/lib/schemas";

const DUMMY_HASH = bcrypt.hashSync("ibr-invest-dummy", 12);
const attempts = new Map<string, { count: number; until: number }>();
const LIMIT = 8;
const WINDOW = 10 * 60 * 1000;

export async function POST(req: Request) {
  return handle(async () => {
    const { phone, password } = loginSchema.parse(await readJson(req));
    const key = `${phone}|${req.headers.get("x-forwarded-for") ?? "local"}`;
    const rec = attempts.get(key);
    if (rec && rec.until > Date.now() && rec.count >= LIMIT) {
      throw new ApiError(429, "Слишком много попыток входа. Повторите через несколько минут");
    }
    const user = await db.user.findUnique({ where: { phone } });
    const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !valid) {
      const fresh = rec && rec.until > Date.now() ? rec : { count: 0, until: Date.now() + WINDOW };
      attempts.set(key, { count: fresh.count + 1, until: fresh.until });
      throw new ApiError(401, "Неверный телефон или пароль");
    }
    attempts.delete(key);
    await createSession(user.id, user.role as "ADMIN" | "INVESTOR");
    return ok({ redirect: user.role === "ADMIN" ? "/admin" : "/cabinet" });
  });
}
