import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";

export const SESSION_COOKIE = "ibr_session";
const MAX_AGE = 60 * 60 * 24 * 7;

export type Role = "ADMIN" | "INVESTOR";

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET не задан или короче 32 символов");
  return new TextEncoder().encode(s);
}

export async function createSession(userId: string, role: Role): Promise<void> {
  const token = await new SignJWT({ role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE !== "false" && process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export interface SessionUser {
  id: string;
  role: Role;
  fullName: string;
  phone: string;
  status: string;
}

/** Verifies the cookie and reloads the user from the database on every call. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (!payload.sub) return null;
    const u = await db.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, fullName: true, phone: true, status: true },
    });
    if (!u) return null;
    return { ...u, role: u.role as Role };
  } catch {
    return null;
  }
}

/** For route handlers: throws ApiError. */
export async function apiRequireUser(): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u) throw new ApiError(401, "Требуется вход в систему");
  return u;
}

export async function apiRequireAdmin(): Promise<SessionUser> {
  const u = await apiRequireUser();
  if (u.role !== "ADMIN") throw new ApiError(403, "Недостаточно прав");
  return u;
}

/** For pages: redirects. */
export async function pageRequireAdmin(): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u) redirect("/login");
  if (u.role !== "ADMIN") redirect("/cabinet");
  return u;
}

export async function pageRequireInvestor(): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u) redirect("/login");
  if (u.role !== "INVESTOR") redirect("/admin");
  return u;
}

export async function pageRequireUser(next?: string): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u) redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  return u;
}

export async function verifyAdminPassword(adminId: string, password: string | undefined): Promise<void> {
  if (!password) throw new ApiError(400, "Введите пароль администратора для подтверждения");
  const admin = await db.user.findUnique({ where: { id: adminId }, select: { passwordHash: true, role: true } });
  const ok = admin ? await bcrypt.compare(password, admin.passwordHash) : false;
  if (!admin || admin.role !== "ADMIN" || !ok) throw new ApiError(403, "Неверный пароль администратора");
}

export const hashPassword = (p: string) => bcrypt.hash(p, 12);
