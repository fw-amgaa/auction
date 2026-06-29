"use server";

import { eq } from "drizzle-orm";

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

  const passwordHash = await hashPassword(password);
  await db
    .update(schema.users)
    .set({ passwordHash, emailVerified: new Date() })
    .where(eq(schema.users.email, email));

  return { ok: true };
}
