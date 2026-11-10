import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { QuarterLockedError } from "@/lib/ledger";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function ok<T extends object>(data: T = {} as T) {
  return NextResponse.json({ ok: true, ...data });
}

export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ApiError) return NextResponse.json({ error: e.message }, { status: e.status });
    if (e instanceof QuarterLockedError) return NextResponse.json({ error: e.message }, { status: 409 });
    if (e instanceof ZodError) {
      return NextResponse.json({ error: e.issues[0]?.message ?? "Некорректные данные" }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new ApiError(400, "Некорректный запрос");
  }
}
