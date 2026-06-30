"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db, schema } from "@auction/db";
import { emailSchema, isValidLotCode } from "@auction/shared";

import { writeAudit } from "@/lib/audit";
import { issuePasswordToken, RESET_TTL_MS } from "@/lib/auth-tokens";
import { appUrl, sendEmail } from "@/lib/email";
import { resetEmail } from "@/lib/email-templates";
import { notify } from "@/lib/notify";
import { requirePermission } from "@/lib/session";

export async function approveKyc(userId: string) {
  const admin = await requirePermission("kyc.review");
  await db.update(schema.users).set({ kyc: "approved" }).where(eq(schema.users.id, userId));
  await notify(userId, "kyc_approved");
  await writeAudit({ actorId: admin.id, action: "kyc.approve", targetType: "user", targetId: userId });
  revalidatePath("/admin/kyc");
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/users");
}

export async function rejectKyc(userId: string, reason: string) {
  const admin = await requirePermission("kyc.review");
  if (!reason.trim()) return;
  await db.update(schema.users).set({ kyc: "rejected" }).where(eq(schema.users.id, userId));
  await notify(userId, "kyc_rejected", { reason });
  await writeAudit({
    actorId: admin.id,
    action: "kyc.reject",
    targetType: "user",
    targetId: userId,
    meta: { reason },
  });
  revalidatePath("/admin/kyc");
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/users");
}

export async function setUserDisabled(userId: string, disabled: boolean) {
  const admin = await requirePermission("users.suspend");
  await db.update(schema.users).set({ disabled }).where(eq(schema.users.id, userId));
  await writeAudit({
    actorId: admin.id,
    action: disabled ? "user.suspend" : "user.unsuspend",
    targetType: "user",
    targetId: userId,
  });
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/users");
}

export async function resetCredentials(userId: string) {
  const admin = await requirePermission("users.reset_credentials");
  const [u] = await db
    .select({ email: schema.users.email, disabled: schema.users.disabled })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  if (u && !u.disabled) {
    const token = await issuePasswordToken(u.email, RESET_TTL_MS);
    await sendEmail(resetEmail(u.email, `${appUrl()}/set-password?token=${token}`));
  }
  await writeAudit({
    actorId: admin.id,
    action: "user.reset_credentials",
    targetType: "user",
    targetId: userId,
  });
}

/** Replace a bidder's eligibility codes (per-code lot access). */
export async function updateUserCodes(
  userId: string,
  codes: string[],
): Promise<{ ok: boolean; error?: string }> {
  const admin = await requirePermission("users.edit");
  const clean = [...new Set(codes)];
  if (clean.length === 0) return { ok: false, error: "Дор хаяж нэг шифр сонгоно уу." };
  if (!clean.every(isValidLotCode)) return { ok: false, error: "Буруу шифр сонгогдсон байна." };

  await db.transaction(async (tx) => {
    await tx.delete(schema.userCodes).where(eq(schema.userCodes.userId, userId));
    await tx.insert(schema.userCodes).values(clean.map((code) => ({ userId, code })));
  });
  await writeAudit({
    actorId: admin.id,
    action: "user.update_codes",
    targetType: "user",
    targetId: userId,
    meta: { codes: clean },
  });
  revalidatePath(`/admin/users/${userId}`);
  return { ok: true };
}

export async function updateUserInfo(
  userId: string,
  accountType: string,
  fields: Record<string, string>,
): Promise<{ ok: boolean; error?: string }> {
  const admin = await requirePermission("users.edit");

  // Optional email change — validate format + uniqueness before any writes.
  const newEmail = (fields.email ?? "").trim().toLowerCase();
  let emailChanged = false;
  if (newEmail) {
    if (!emailSchema.safeParse(newEmail).success) {
      return { ok: false, error: "И-мэйл хаяг буруу байна." };
    }
    const [cur] = await db
      .select({ email: schema.users.email })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);
    if (cur && cur.email !== newEmail) {
      const [dup] = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.email, newEmail))
        .limit(1);
      if (dup && dup.id !== userId) {
        return { ok: false, error: "Энэ и-мэйл өөр хэрэглэгчид бүртгэлтэй байна." };
      }
      emailChanged = true;
    }
  }

  if (accountType === "legal_entity") {
    await db
      .update(schema.legalEntityProfiles)
      .set({
        registeredName: fields.registeredName,
        stateCertNumber: fields.stateCertNumber,
        registryNumber: fields.registryNumber,
        directorName: fields.directorName,
        address: fields.address,
      })
      .where(eq(schema.legalEntityProfiles.userId, userId));
  } else {
    await db
      .update(schema.individualProfiles)
      .set({
        surname: fields.surname,
        givenName: fields.givenName,
        registryNumber: fields.registryNumber,
        address: fields.address,
      })
      .where(eq(schema.individualProfiles.userId, userId));
  }
  if (fields.phone) {
    await db.update(schema.users).set({ phone: fields.phone }).where(eq(schema.users.id, userId));
  }
  if (emailChanged) {
    // Changing the login email invalidates prior verification.
    await db.update(schema.users).set({ email: newEmail, emailVerified: false }).where(eq(schema.users.id, userId));
  }
  await writeAudit({
    actorId: admin.id,
    action: "user.update",
    targetType: "user",
    targetId: userId,
    meta: emailChanged ? { email: newEmail } : {},
  });
  revalidatePath(`/admin/users/${userId}`);
  return { ok: true };
}
