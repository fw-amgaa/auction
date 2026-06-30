"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db, schema } from "@auction/db";

import { writeAudit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { requirePermission } from "@/lib/session";

export type LimitAction = "raise" | "lower" | "refund";

export interface AdjustResult {
  error?: string;
}

export async function adjustLimit(
  userId: string,
  action: LimitAction,
  amount: number,
  note: string,
): Promise<AdjustResult> {
  const admin = await requirePermission("limits.adjust");
  if (!amount || amount <= 0) return { error: "Дүн оруулна уу." };

  const [u] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  if (!u) return { error: "Хэрэглэгч олдсонгүй." };

  // raise: +amount; lower/refund: -amount. Never below currently committed.
  const delta = action === "raise" ? amount : -amount;
  const newLimit = u.limit + delta;
  if (newLimit < u.committedCache) {
    return { error: "Шинэ лимит барьцаанд байгаа дүнгээс бага байж болохгүй." };
  }

  const ledgerType =
    action === "raise"
      ? (u.limit === 0 ? "admin_issue" : "admin_raise")
      : action === "lower"
        ? "admin_lower"
        : "offline_refund";

  await db.transaction(async (tx) => {
    await tx.update(schema.users).set({ limit: newLimit }).where(eq(schema.users.id, userId));
    await tx.insert(schema.limitLedger).values({
      userId,
      type: ledgerType,
      delta,
      balanceAfter: newLimit,
      actorId: admin.id,
      note: note.trim() || null,
    });
  });

  await notify(userId, action === "raise" ? "limit_raised" : "limit_issued", { amount, action });
  await writeAudit({
    actorId: admin.id,
    action: `limit.${action}`,
    targetType: "user",
    targetId: userId,
    meta: { amount, newLimit, note },
  });

  revalidatePath("/admin/limits");
  revalidatePath(`/admin/users/${userId}`);
  return {};
}
