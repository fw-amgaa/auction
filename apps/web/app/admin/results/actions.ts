"use server";

import { and, desc, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db, schema } from "@auction/db";

import { writeAudit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { requireAdmin } from "@/lib/session";

export async function markPaid(lotId: string) {
  const admin = await requireAdmin();
  await db.update(schema.lots).set({ payment: "paid", status: "settled" }).where(eq(schema.lots.id, lotId));
  await writeAudit({ actorId: admin.id, action: "result.mark_paid", targetType: "lot", targetId: lotId });
  revalidatePath("/admin/results");
}

export async function generatePermit(lotId: string) {
  const admin = await requireAdmin();
  await db.update(schema.lots).set({ permitIssuedAt: new Date() }).where(eq(schema.lots.id, lotId));
  await writeAudit({ actorId: admin.id, action: "result.permit_issued", targetType: "lot", targetId: lotId });
  revalidatePath("/admin/results");
}

/**
 * Winner default → offer to the next-highest qualified bidder (PLAN §4.8).
 * Marks the current winner defaulted (deposit already forfeited via consume),
 * promotes the runner-up at their highest bid, resets payment to pending.
 */
export async function defaultWinner(lotId: string) {
  const admin = await requireAdmin();
  const [lot] = await db.select().from(schema.lots).where(eq(schema.lots.id, lotId)).limit(1);
  if (!lot || !lot.winnerUserId) return;

  // runner-up = highest bid by a different user
  const [next] = await db
    .select({ userId: schema.bids.userId, amount: schema.bids.amount })
    .from(schema.bids)
    .where(and(eq(schema.bids.lotId, lotId), ne(schema.bids.userId, lot.winnerUserId)))
    .orderBy(desc(schema.bids.amount))
    .limit(1);

  if (!next) {
    // no runner-up: just mark defaulted, lot unsold
    await db.update(schema.lots).set({ payment: "defaulted", winnerUserId: null }).where(eq(schema.lots.id, lotId));
  } else {
    await db
      .update(schema.lots)
      .set({ winnerUserId: next.userId, currentPrice: next.amount, payment: "pending", permitIssuedAt: null })
      .where(eq(schema.lots.id, lotId));
    // consume the runner-up's credit for their winning amount
    const [u] = await db.select().from(schema.users).where(eq(schema.users.id, next.userId)).limit(1);
    if (u) {
      const newLimit = Math.max(0, u.limit - next.amount);
      await db.update(schema.users).set({ limit: newLimit }).where(eq(schema.users.id, next.userId));
      await db.insert(schema.limitLedger).values({
        userId: next.userId,
        type: "consume",
        delta: -next.amount,
        balanceAfter: newLimit,
        lotId,
        note: "Дараагийн оролцогчид шилжсэн",
      });
    }
    await notify(next.userId, "won", { lotId, code: lot.code, price: next.amount });
  }
  await writeAudit({ actorId: admin.id, action: "result.default_winner", targetType: "lot", targetId: lotId });
  revalidatePath("/admin/results");
}
