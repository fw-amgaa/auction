"use server";

import { eq } from "drizzle-orm";

import { db, schema } from "@auction/db";
import { emailSchema } from "@auction/shared";

import { issuePasswordToken, RESET_TTL_MS } from "@/lib/auth-tokens";
import { appUrl, sendEmail } from "@/lib/email";
import { resetEmail } from "@/lib/email-templates";

export interface ForgotState {
  sent?: boolean;
  error?: string;
}

export async function forgotAction(_prev: ForgotState, formData: FormData): Promise<ForgotState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!emailSchema.safeParse(email).success) return { error: "И-мэйл хаяг буруу байна." };

  const [u] = await db
    .select({ id: schema.users.id, disabled: schema.users.disabled })
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);

  // Only send for a real, active account — but always respond identically so
  // the form can't be used to discover which emails are registered.
  if (u && !u.disabled) {
    try {
      const token = await issuePasswordToken(email, RESET_TTL_MS);
      await sendEmail(resetEmail(email, `${appUrl()}/set-password?token=${token}`));
    } catch (err) {
      console.error("forgotAction: send failed", err);
    }
  }

  return { sent: true };
}
