"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db, schema } from "@auction/db";
import { emailSchema, isPermission, type Permission } from "@auction/shared";

import { writeAudit } from "@/lib/audit";
import { INVITE_TTL_MS, issuePasswordToken } from "@/lib/auth-tokens";
import { appUrl, sendEmail } from "@/lib/email";
import { inviteEmail } from "@/lib/email-templates";
import { requirePermission } from "@/lib/session";

export interface AdminActionState {
  ok?: boolean;
  error?: string;
}

/** Keep only known permission codes; drop dupes and anything unrecognised. */
function sanitize(perms: string[]): Permission[] {
  return [...new Set(perms)].filter(isPermission);
}

/**
 * Count enabled users (other than `excludeUserId`) that hold admins.manage.
 * Used to refuse any change that would leave nobody able to manage admins.
 */
async function otherManagersCount(excludeUserId: string): Promise<number> {
  const rows = await db
    .select({ userId: schema.userPermissions.userId })
    .from(schema.userPermissions)
    .innerJoin(schema.users, eq(schema.userPermissions.userId, schema.users.id))
    .where(
      and(
        eq(schema.userPermissions.permission, "admins.manage"),
        eq(schema.users.disabled, false),
        ne(schema.userPermissions.userId, excludeUserId),
      ),
    );
  return rows.length;
}

/**
 * Create a dashboard (staff) user: role=admin, the chosen permissions, and an
 * emailed set-password link (the invite flow — no password is ever set by the
 * admin). The user activates the account via the link.
 */
export async function createDashboardUser(input: {
  email: string;
  name: string;
  permissions: string[];
}): Promise<AdminActionState> {
  const admin = await requirePermission("admins.manage");
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (!emailSchema.safeParse(email).success) return { error: "И-мэйл хаяг буруу байна." };
  if (!name) return { error: "Нэр оруулна уу." };
  const perms = sanitize(input.permissions);

  const [dup] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);
  if (dup) return { error: `И-мэйл ${email} бүртгэлтэй байна.` };

  let newId = "";
  await db.transaction(async (tx) => {
    const [u] = await tx
      .insert(schema.users)
      .values({
        email,
        name,
        role: "admin",
        accountType: "individual",
        kyc: "approved",
        emailVerified: false,
        source: "admin",
        createdBy: admin.id,
      })
      .returning({ id: schema.users.id });
    newId = u!.id;
    if (perms.length) {
      await tx.insert(schema.userPermissions).values(perms.map((permission) => ({ userId: newId, permission })));
    }
  });

  // Best-effort side effects: the account already exists, so a mail/audit failure
  // must not surface as a creation error.
  try {
    const token = await issuePasswordToken(email, INVITE_TTL_MS);
    await sendEmail(inviteEmail(email, `${appUrl()}/set-password?token=${token}`));
    await writeAudit({
      actorId: admin.id,
      action: "admin.create",
      targetType: "user",
      targetId: newId,
      meta: { email, permissions: perms },
    });
  } catch (err) {
    console.error("createDashboardUser: post-create side effect failed", err);
  }

  revalidatePath("/admin/admins");
  return { ok: true };
}

/** Replace a dashboard user's permission set. */
export async function updateAdminPermissions(
  userId: string,
  permissions: string[],
): Promise<AdminActionState> {
  const admin = await requirePermission("admins.manage");
  const [target] = await db
    .select({ role: schema.users.role })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  if (!target || target.role !== "admin") return { error: "Хэрэглэгч олдсонгүй." };
  const perms = sanitize(permissions);

  // Never leave the system with no one who can manage admins.
  if (!perms.includes("admins.manage") && (await otherManagersCount(userId)) === 0) {
    return { error: "Эрх удирдах эрхтэй дор хаяж нэг идэвхтэй хэрэглэгч үлдэх ёстой." };
  }

  await db.transaction(async (tx) => {
    await tx.delete(schema.userPermissions).where(eq(schema.userPermissions.userId, userId));
    if (perms.length) {
      await tx.insert(schema.userPermissions).values(perms.map((permission) => ({ userId, permission })));
    }
  });
  await writeAudit({
    actorId: admin.id,
    action: "admin.update_permissions",
    targetType: "user",
    targetId: userId,
    meta: { permissions: perms },
  });
  revalidatePath("/admin/admins");
  return { ok: true };
}

/** Enable/disable a dashboard user (a disabled user can't log in — see getCurrentUser). */
export async function setAdminDisabled(userId: string, disabled: boolean): Promise<AdminActionState> {
  const admin = await requirePermission("admins.manage");
  const [target] = await db
    .select({ role: schema.users.role })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  if (!target || target.role !== "admin") return { error: "Хэрэглэгч олдсонгүй." };

  if (disabled && (await otherManagersCount(userId)) === 0) {
    return { error: "Сүүлчийн эрх удирдагчийг идэвхгүй болгох боломжгүй." };
  }

  await db.update(schema.users).set({ disabled }).where(eq(schema.users.id, userId));
  await writeAudit({
    actorId: admin.id,
    action: disabled ? "admin.disable" : "admin.enable",
    targetType: "user",
    targetId: userId,
  });
  revalidatePath("/admin/admins");
  return { ok: true };
}

/** Re-send the set-password (invite) link to a dashboard user. */
export async function resendAdminInvite(userId: string): Promise<AdminActionState> {
  const admin = await requirePermission("admins.manage");
  const [u] = await db
    .select({ email: schema.users.email, role: schema.users.role, disabled: schema.users.disabled })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  if (!u || u.role !== "admin") return { error: "Хэрэглэгч олдсонгүй." };
  if (u.disabled) return { error: "Идэвхгүй хэрэглэгч." };

  try {
    const token = await issuePasswordToken(u.email, INVITE_TTL_MS);
    await sendEmail(inviteEmail(u.email, `${appUrl()}/set-password?token=${token}`));
    await writeAudit({
      actorId: admin.id,
      action: "admin.resend_invite",
      targetType: "user",
      targetId: userId,
    });
  } catch (err) {
    console.error("resendAdminInvite: send failed", err);
    return { error: "И-мэйл илгээхэд алдаа гарлаа." };
  }
  return { ok: true };
}
