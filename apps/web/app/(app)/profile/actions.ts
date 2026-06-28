"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db, schema } from "@auction/db";

import { requireUser } from "@/lib/session";

/** Self-service edit of contact fields (identity fields stay locked after KYC). */
export async function updateMyProfile(input: { phone: string; address: string }) {
  const user = await requireUser();
  if (input.phone.trim()) {
    await db.update(schema.users).set({ phone: input.phone.trim() }).where(eq(schema.users.id, user.id));
  }
  if (user.accountType === "legal_entity") {
    await db.update(schema.legalEntityProfiles).set({ address: input.address }).where(eq(schema.legalEntityProfiles.userId, user.id));
  } else {
    await db.update(schema.individualProfiles).set({ address: input.address }).where(eq(schema.individualProfiles.userId, user.id));
  }
  revalidatePath("/profile");
}
