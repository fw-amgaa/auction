"use server";

import { randomUUID } from "node:crypto";

import { desc, eq } from "drizzle-orm";

import { db, schema } from "@auction/db";
import { registerSchema } from "@auction/shared";

import { docKeysFor } from "@/lib/docs";
import { hashPassword } from "@/lib/password";
import { putObject } from "@/lib/storage";

export interface RegisterState {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function registerAction(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const accountType = String(formData.get("accountType") ?? "");
  const raw = Object.fromEntries(
    [
      "accountType",
      "email",
      "phone",
      "password",
      "address",
      "termsVersion",
      "surname",
      "givenName",
      "registryNumber",
      "registeredName",
      "stateCertNumber",
      "directorName",
    ].map((k) => [k, formData.get(k) ?? undefined]),
  );

  const codes = formData.getAll("codes").map(String);
  const parsed = registerSchema.safeParse({ ...raw, codes });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { error: "Талбаруудыг шалгана уу.", fieldErrors };
  }
  const data = parsed.data;

  // Everything past validation touches the DB, object storage and native
  // hashing — any of which can throw at runtime. Keep it all inside one
  // try/catch so a failure returns a friendly message instead of bubbling up
  // as an unhandled server-side exception (the blank "Application error" page).
  try {
    // email uniqueness
    const [existing] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, data.email))
      .limit(1);
    if (existing) {
      return {
        error: "Энэ и-мэйл хаягаар бүртгэл аль хэдийн үүссэн байна.",
        fieldErrors: { email: "Бүртгэлтэй и-мэйл" },
      };
    }

    // read uploaded documents
    const docKeys = docKeysFor(accountType);
    const files: { docType: string; fileName: string; bytes: Buffer }[] = [];
    for (const key of docKeys) {
      const f = formData.get(key);
      if (f instanceof File && f.size > 0) {
        files.push({
          docType: key,
          fileName: f.name,
          bytes: Buffer.from(await f.arrayBuffer()),
        });
      }
    }
    if (files.length < docKeys.length) {
      return { error: "Бүх бичиг баримтыг оруулна уу." };
    }

    const passwordHash = await hashPassword(data.password);
    const [latestTerms] = await db
      .select()
      .from(schema.termsVersions)
      .orderBy(desc(schema.termsVersions.publishedAt))
      .limit(1);

    // display name for the better-auth user record (used in session.user.name)
    const name =
      data.accountType === "individual"
        ? `${data.surname} ${data.givenName}`.trim()
        : data.registeredName;

    await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(schema.users)
        .values({
          email: data.email,
          name,
          phone: data.phone,
          accountType: data.accountType,
          role: "bidder",
          kyc: "pending",
          source: "self",
        })
        .returning({ id: schema.users.id });

      const userId = user!.id;

      // better-auth credential account — holds the argon2 hash that
      // auth.api.signInEmail verifies at login (providerId "credential").
      await tx.insert(schema.accounts).values({
        id: randomUUID(),
        accountId: userId,
        providerId: "credential",
        userId,
        password: passwordHash,
      });

      if (data.accountType === "individual") {
        await tx.insert(schema.individualProfiles).values({
          userId,
          surname: data.surname,
          givenName: data.givenName,
          registryNumber: data.registryNumber,
          address: data.address,
        });
      } else {
        await tx.insert(schema.legalEntityProfiles).values({
          userId,
          registeredName: data.registeredName,
          stateCertNumber: data.stateCertNumber,
          registryNumber: data.registryNumber,
          directorName: data.directorName,
          contactPhone: data.phone,
          address: data.address,
        });
      }

      for (const file of files) {
        const s3Key = `kyc/${userId}/${file.docType}-${file.fileName}`;
        await putObject(s3Key, file.bytes);
        await tx.insert(schema.kycDocuments).values({
          userId,
          docType: file.docType,
          s3Key,
          fileName: file.fileName,
        });
      }

      await tx.insert(schema.userCodes).values(data.codes.map((code) => ({ userId, code })));

      if (latestTerms) {
        await tx.insert(schema.userTermsAcceptance).values({
          userId,
          termsVersionId: latestTerms.id,
        });
      }
    });
  } catch (e) {
    console.error("registration failed", e);
    return { error: "Бүртгэл үүсгэхэд алдаа гарлаа. Дахин оролдоно уу." };
  }

  return { ok: true };
}
