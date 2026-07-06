import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";

import { db, schema } from "@auction/db";

import { hashPassword, verifyPassword } from "./password";

/**
 * better-auth instance — replaces Auth.js. Email + password only; sessions are
 * stored in the `sessions` table and carried by a cookie.
 *
 * All redirect / callback URLs derive from `baseURL` (BETTER_AUTH_URL), never
 * from the request or container bind host — which is why this fixes the old
 * `callbackUrl=https://0.0.0.0:3000/...` bug we saw behind Caddy.
 *
 * The drizzle adapter looks tables up as `schema[modelName]`, so we pass the
 * full schema and point each model at our (plural) table export names. The
 * `users` table doubles as both our domain table and better-auth's user model;
 * the credential password hash lives in `accounts` (providerId "credential").
 */
export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? process.env.APP_URL,
  secret: process.env.AUTH_SECRET,
  trustedOrigins: ["https://anav.mn"],
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: false, // preserve the "register → then log in" flow
    // Sign-up happens ONLY through registerAction (documents + KYC + the admin
    // registration switch); the public /api/auth/sign-up/email endpoint would
    // bypass all of that, so it stays off.
    disableSignUp: true,
    password: {
      hash: hashPassword, // (password) => Promise<hash>
      verify: ({ password, hash }) => verifyPassword(hash, password),
    },
  },
  user: {
    modelName: "users",
    additionalFields: {
      // surfaced on the session so middleware/UI can read it without a DB hit
      role: { type: "string", input: false },
    },
  },
  session: { modelName: "sessions" },
  account: { modelName: "accounts" },
  verification: { modelName: "verification" },
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
