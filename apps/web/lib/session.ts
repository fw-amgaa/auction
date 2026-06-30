import "server-only";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { db, schema } from "@auction/db";
import { type Permission, PERMISSION_GROUPS } from "@auction/shared";

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

/* ----------------------------- admin permissions -------------------------- */
/**
 * Per-user admin permissions (no roles). The original admin holds them all; new
 * dashboard users are granted a subset. Server-side checks below are the real
 * gate — the UI only hides controls cosmetically.
 */

/** Every admin permission granted to a user (empty for bidders). */
export async function getPermissions(userId: string): Promise<Permission[]> {
  const rows = await db
    .select({ permission: schema.userPermissions.permission })
    .from(schema.userPermissions)
    .where(eq(schema.userPermissions.userId, userId));
  return rows.map((r) => r.permission as Permission);
}

/** First admin route the given permissions grant entry to (for safe redirects). */
function firstAccessiblePath(perms: Permission[]): string {
  const g = PERMISSION_GROUPS.find((grp) => perms.includes(grp.viewPermission));
  return g?.path ?? "/admin/no-access";
}

/**
 * Page guard: staff + a specific permission. Redirects to the first section the
 * user can access (or the no-access page) rather than rendering forbidden
 * content. Returns the user and their full permission set.
 */
export async function requirePageAccess(perm: Permission) {
  const user = await requireAdmin();
  const permissions = await getPermissions(user.id);
  if (!permissions.includes(perm)) redirect(firstAccessiblePath(permissions));
  return { user, permissions };
}

/**
 * Action guard: staff + a specific permission. Throws on a missing permission —
 * the UI hides the control, so this is the server backstop against a stale page
 * or a direct call. Returns the acting user (same shape as requireAdmin).
 */
export async function requirePermission(perm: Permission) {
  const user = await requireAdmin();
  const permissions = await getPermissions(user.id);
  if (!permissions.includes(perm)) {
    throw new Error(`forbidden: missing permission "${perm}"`);
  }
  return user;
}
