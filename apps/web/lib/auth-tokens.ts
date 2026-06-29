import "server-only";

import { randomBytes } from "node:crypto";

import { and, eq, gt } from "drizzle-orm";

import { db, schema } from "@auction/db";

/**
 * Single-use, time-limited tokens for "set your password" links — used by both
 * the admin invite flow and self-service password recovery. Reuses the
 * Auth.js `verification_tokens` table (identifier = email).
 */
export const INVITE_TTL_MS = 1000 * 60 * 60 * 24 * 3; // 3 days
export const RESET_TTL_MS = 1000 * 60 * 60; // 1 hour

/** Issue a fresh token for an email, replacing any previous one. */
export async function issuePasswordToken(email: string, ttlMs: number): Promise<string> {
  const identifier = email.trim().toLowerCase();
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + ttlMs);
  await db.delete(schema.verificationTokens).where(eq(schema.verificationTokens.identifier, identifier));
  await db.insert(schema.verificationTokens).values({ identifier, token, expires });
  return token;
}

/** Return the email a still-valid token belongs to, without consuming it. */
export async function peekPasswordToken(token: string): Promise<string | null> {
  if (!token) return null;
  const [row] = await db
    .select({ identifier: schema.verificationTokens.identifier })
    .from(schema.verificationTokens)
    .where(and(eq(schema.verificationTokens.token, token), gt(schema.verificationTokens.expires, new Date())))
    .limit(1);
  return row?.identifier ?? null;
}

/** Validate and delete a token; returns the email on success, null otherwise. */
export async function consumePasswordToken(token: string): Promise<string | null> {
  const email = await peekPasswordToken(token);
  if (!email) return null;
  await db.delete(schema.verificationTokens).where(eq(schema.verificationTokens.token, token));
  return email;
}
