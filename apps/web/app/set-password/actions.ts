"use server";

import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";

import { db, schema } from "@auction/db";

import { consumePasswordToken } from "@/lib/auth-tokens";
import { hashPassword } from "@/lib/password";

export interface SetPasswordState {
  ok?: boolean;
  error?: string;
}

export async function setPasswordAction(
  _prev: SetPasswordState,
  formData: FormData,
): Promise<SetPasswordState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 8) return { error: "Нууц үг дор хаяж 8 тэмдэгт байх ёстой." };
  if (password !== confirm) return { error: "Нууц үг хоорондоо таарахгүй байна." };

  // Consume last so a validation error doesn't burn the token.
  const email = await consumePasswordToken(token);
  if (!email) return { error: "Холбоосын хугацаа дууссан эсвэл буруу байна. Дахин хүсэлт илгээнэ үү." };

  const [user] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);
  if (!user) return { error: "Бүртгэл олдсонгүй." };

  const passwordHash = await hashPassword(password);

  // Upsert the better-auth credential account: invite flow has none yet, reset
  // flow already has one. The password hash lives here, not on the user row.
  const credentialFilter = and(
    eq(schema.accounts.userId, user.id),
    eq(schema.accounts.providerId, "credential"),
  );
  const [existing] = await db
    .select({ id: schema.accounts.id })
    .from(schema.accounts)
    .where(credentialFilter)
    .limit(1);

  if (existing) {
    await db.update(schema.accounts).set({ password: passwordHash }).where(credentialFilter);
  } else {
    await db.insert(schema.accounts).values({
      id: randomUUID(),
      accountId: user.id,
      providerId: "credential",
      userId: user.id,
      password: passwordHash,
    });
  }

  // Using the emailed link proves control of the address → mark verified.
  await db.update(schema.users).set({ emailVerified: true }).where(eq(schema.users.id, user.id));

  return { ok: true };
}
