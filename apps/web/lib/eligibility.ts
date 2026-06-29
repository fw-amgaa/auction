import "server-only";

import { eq } from "drizzle-orm";

import { db, schema } from "@auction/db";

/** The set of lot codes a bidder is eligible for. */
export async function getUserCodes(userId: string): Promise<string[]> {
  const rows = await db
    .select({ code: schema.userCodes.code })
    .from(schema.userCodes)
    .where(eq(schema.userCodes.userId, userId));
  return rows.map((r) => r.code);
}

/**
 * Whether a viewer may see/bid a lot. Admins always may; a bidder may only when
 * the lot's code is in their registered set. A logged-out viewer never may.
 */
export function isEligible(
  viewer: { role: "bidder" | "admin" } | null,
  codes: string[],
  lotCode: string,
): boolean {
  if (!viewer) return false;
  if (viewer.role === "admin") return true;
  return codes.includes(lotCode);
}
