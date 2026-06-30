"use server";

import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db, schema } from "@auction/db";
import { emailSchema, isValidLotCode } from "@auction/shared";

import { writeAudit } from "@/lib/audit";
import { INVITE_TTL_MS, issuePasswordToken } from "@/lib/auth-tokens";
import { docKeysFor } from "@/lib/docs";
import { appUrl, sendEmail } from "@/lib/email";
import { inviteEmail } from "@/lib/email-templates";
import { notify } from "@/lib/notify";
import { hashPassword } from "@/lib/password";
import { requirePermission } from "@/lib/session";
import { putObject } from "@/lib/storage";

export interface CreateUserState {
  error?: string;
  fieldErrors?: Record<string, string>;
  /** Set once the account is created so the form can navigate to the list. */
  ok?: boolean;
}

const REQUIRED: Record<string, string[]> = {
  individual: ["givenName", "registryNumber", "phone", "email", "address"],
  legal_entity: ["registeredName", "registryNumber", "stateCertNumber", "phone", "email", "address"],
};

export async function createUserAction(
  _prev: CreateUserState,
  formData: FormData,
): Promise<CreateUserState> {
  const admin = await requirePermission("users.create");
  const accountType = String(formData.get("accountType") ?? "individual");
  const g = (k: string) => String(formData.get(k) ?? "").trim();

  const fieldErrors: Record<string, string> = {};
  for (const key of REQUIRED[accountType] ?? []) {
    if (!g(key)) fieldErrors[key] = "Заавал бөглөнө";
  }
  const email = g("email").toLowerCase();
  if (email && !emailSchema.safeParse(email).success) fieldErrors.email = "И-мэйл буруу";
  if (g("phone") && g("phone").replace(/\D/g, "").length < 8) fieldErrors.phone = "Утас буруу";

  const cred = g("cred") || "invite";
  const tempPass = g("tempPass");
  if (cred === "temp" && tempPass.length < 6) fieldErrors.tempPass = "Дор хаяж 6 тэмдэгт";

  const codes = formData.getAll("codes").map(String);
  if (codes.length === 0) fieldErrors.codes = "Дор хаяж нэг шифр сонгоно уу";
  else if (!codes.every(isValidLotCode)) fieldErrors.codes = "Буруу шифр сонгогдсон";

  if (Object.keys(fieldErrors).length > 0) {
    return { error: "Талбаруудыг шалгана уу.", fieldErrors };
  }

  const registryNumber = g("registryNumber");
  // duplicate detection (email + registry across both profile tables)
  const [dupEmail] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);
  if (dupEmail) return { error: `И-мэйл ${email} бүртгэлтэй байна.`, fieldErrors: { email: "Бүртгэлтэй" } };

  const [dupInd] = await db
    .select({ id: schema.individualProfiles.userId })
    .from(schema.individualProfiles)
    .where(eq(schema.individualProfiles.registryNumber, registryNumber))
    .limit(1);
  const [dupLeg] = await db
    .select({ id: schema.legalEntityProfiles.userId })
    .from(schema.legalEntityProfiles)
    .where(eq(schema.legalEntityProfiles.registryNumber, registryNumber))
    .limit(1);
  if (dupInd || dupLeg) {
    return { error: `Регистр ${registryNumber} бүртгэлтэй байна.`, fieldErrors: { registryNumber: "Бүртгэлтэй" } };
  }

  // read docs
  const docKeys = docKeysFor(accountType);
  const files: { docType: string; fileName: string; bytes: Buffer }[] = [];
  for (const key of docKeys) {
    const f = formData.get(key);
    if (f instanceof File && f.size > 0) {
      files.push({ docType: key, fileName: f.name, bytes: Buffer.from(await f.arrayBuffer()) });
    }
  }

  const preApprove = g("preApprove") === "true";
  const limit = Number.parseInt(g("limit").replace(/\D/g, "") || "0", 10);
  const passwordHash = cred === "temp" ? await hashPassword(tempPass) : null;

  const name = accountType === "legal_entity" ? g("registeredName") : g("givenName");

  let newUserId = "";
  await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(schema.users)
      .values({
        email,
        name,
        phone: g("phone"),
        accountType: accountType as "individual" | "legal_entity",
        role: "bidder",
        kyc: preApprove ? "approved" : "pending",
        source: "admin",
        createdBy: admin.id,
        limit: limit > 0 ? limit : 0,
      })
      .returning({ id: schema.users.id });
    newUserId = user!.id;

    // Temp-password flow: store the hash as a better-auth credential account.
    // (Invite flow leaves the user password-less until they use the link.)
    if (passwordHash) {
      await tx.insert(schema.accounts).values({
        id: randomUUID(),
        accountId: newUserId,
        providerId: "credential",
        userId: newUserId,
        password: passwordHash,
      });
    }

    if (accountType === "legal_entity") {
      await tx.insert(schema.legalEntityProfiles).values({
        userId: newUserId,
        registeredName: g("registeredName"),
        registryNumber,
        stateCertNumber: g("stateCertNumber"),
        contactPhone: g("phone"),
        address: g("address"),
      });
    } else {
      await tx.insert(schema.individualProfiles).values({
        userId: newUserId,
        citizenship: g("citizenship") || null,
        clanName: g("clanName") || null,
        fatherName: g("fatherName") || null,
        givenName: g("givenName"),
        registryNumber,
        address: g("address"),
        altContact: g("altContact") || null,
      });
    }

    for (const file of files) {
      const s3Key = `kyc/${newUserId}/${file.docType}-${file.fileName}`;
      await putObject(s3Key, file.bytes);
      await tx.insert(schema.kycDocuments).values({
        userId: newUserId,
        docType: file.docType,
        s3Key,
        fileName: file.fileName,
        review: preApprove ? "approved" : "pending",
      });
    }

    await tx.insert(schema.userCodes).values(codes.map((code) => ({ userId: newUserId, code })));

    if (limit > 0) {
      await tx.insert(schema.limitLedger).values({
        userId: newUserId,
        type: "admin_issue",
        delta: limit,
        balanceAfter: limit,
        actorId: admin.id,
        note: "Хэрэглэгч үүсгэх үед олгосон",
      });
    }
  });

  // The account is committed. Notifications and the audit log are best-effort:
  // a failure here must not surface as a creation error or leave the admin
  // stuck on the form thinking nothing happened.
  try {
    // Invite flow: the account has no password yet — email a set-password link.
    if (cred === "invite") {
      const token = await issuePasswordToken(email, INVITE_TTL_MS);
      await sendEmail(inviteEmail(email, `${appUrl()}/set-password?token=${token}`));
    }
    if (preApprove) await notify(newUserId, "kyc_approved");
    if (limit > 0) await notify(newUserId, "limit_issued", { amount: limit });
    await writeAudit({
      actorId: admin.id,
      action: "user.create",
      targetType: "user",
      targetId: newUserId,
      meta: { accountType, preApprove, limit, cred },
    });
  } catch (err) {
    console.error("createUserAction: post-create side effect failed", err);
  }

  revalidatePath("/admin/users");
  return { ok: true };
}
