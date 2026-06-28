"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db, schema } from "@auction/db";

import { writeAudit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { requireAdmin } from "@/lib/session";

export async function approveKyc(userId: string) {
  const admin = await requireAdmin();
  await db.update(schema.users).set({ kyc: "approved" }).where(eq(schema.users.id, userId));
  await notify(userId, "kyc_approved");
  await writeAudit({ actorId: admin.id, action: "kyc.approve", targetType: "user", targetId: userId });
  revalidatePath("/admin/kyc");
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/users");
}

export async function rejectKyc(userId: string, reason: string) {
  const admin = await requireAdmin();
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
  const admin = await requireAdmin();
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
  const admin = await requireAdmin();
  // TODO(email): when SES is wired, generate a verification token + send invite.
  // For now this records the intent in the audit log.
  await writeAudit({
    actorId: admin.id,
    action: "user.reset_credentials",
    targetType: "user",
    targetId: userId,
  });
}

export async function updateUserInfo(userId: string, accountType: string, fields: Record<string, string>) {
  const admin = await requireAdmin();
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
  await writeAudit({ actorId: admin.id, action: "user.update", targetType: "user", targetId: userId });
  revalidatePath(`/admin/users/${userId}`);
}
