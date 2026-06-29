import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe auth config (no DB / no node-only deps) — shared by middleware and
 * the full auth instance. The Credentials provider with its DB-backed
 * `authorize` lives in auth.ts (node runtime only).
 */

const PROTECTED_PREFIXES = [
  "/catalog",
  "/my-bids",
  "/balance",
  "/notifications",
  "/profile",
  "/help",
];

export const authConfig = {
  // Self-hosted behind Caddy: trust the proxied Host header (anav.mn) instead of
  // failing with UntrustedHost. Safe because the only ingress is our reverse proxy.
  trustHost: true,
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [], // real providers added in auth.ts
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const path = nextUrl.pathname;

      if (path.startsWith("/admin")) {
        return isLoggedIn && auth?.user?.role === "admin";
      }
      if (PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) {
        return isLoggedIn;
      }
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id as string;
      if (token.role) session.user.role = token.role as "bidder" | "admin";
      return session;
    },
  },
} satisfies NextAuthConfig;

export default authConfig;
