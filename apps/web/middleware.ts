import { NextResponse, type NextRequest } from "next/server";

import { getSessionCookie } from "better-auth/cookies";

/**
 * Optimistic edge gate: bounce logged-out visitors away from protected routes
 * based on the presence of the better-auth session cookie. This is *not* the
 * security boundary — the real checks (and role enforcement for /admin) happen
 * server-side in lib/session.ts (`requireUser` / `requireAdmin`), which re-reads
 * the user row. Mirrors the old auth.config `authorized` callback.
 */
const PROTECTED_PREFIXES = [
  "/catalog",
  "/my-bids",
  "/balance",
  "/notifications",
  "/profile",
  "/help",
];

function isProtected(path: string): boolean {
  if (path.startsWith("/admin")) return true;
  return PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

export function middleware(request: NextRequest) {
  if (!isProtected(request.nextUrl.pathname)) return NextResponse.next();

  if (!getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // run on everything except static assets and the auth API
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|assets/).*)"],
};
