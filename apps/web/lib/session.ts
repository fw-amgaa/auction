import "server-only";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { db, schema } from "@auction/db";

import { auth } from "@/lib/auth";

/** The full, fresh user row for the logged-in user (or null). */
export async function getCurrentUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return null;
  const [u] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, session.user.id))
    .limit(1);
  if (!u || u.disabled) return null;
  return u;
}

export async function requireUser() {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  return u;
}

export async function requireAdmin() {
  const u = await requireUser();
  if (u.role !== "admin") redirect("/");
  return u;
}

/** A user who has passed KYC — required before bidding. */
export async function requireApproved() {
  const u = await requireUser();
  return { user: u, approved: u.kyc === "approved" };
}
