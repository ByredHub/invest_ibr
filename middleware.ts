import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE = "ibr_session";

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const login = new URL("/login", req.url);
  login.searchParams.set("next", pathname + search);

  const token = req.cookies.get(COOKIE)?.value;
  const secret = process.env.AUTH_SECRET;
  if (!token || !secret) return NextResponse.redirect(login);

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ["HS256"] });
    const role = payload.role;
    if (pathname.startsWith("/admin") && role !== "ADMIN") return NextResponse.redirect(new URL("/cabinet", req.url));
    if (pathname.startsWith("/cabinet") && role !== "INVESTOR") {
      return NextResponse.redirect(new URL(role === "ADMIN" ? "/admin" : "/login", req.url));
    }
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(login);
  }
}

export const config = { matcher: ["/admin/:path*", "/cabinet/:path*", "/report/:path*"] };
