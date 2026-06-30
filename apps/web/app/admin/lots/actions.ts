"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db, schema } from "@auction/db";
import { categoryForCode, CATEGORIES, type CategoryCode } from "@auction/shared";

import { writeAudit } from "@/lib/audit";
import { lotPhase } from "@/lib/lots";
import { requirePermission } from "@/lib/session";

export interface LotInput {
  categoryId: string;
  code: string;
  aimag: string;
  reserve: number;
  status: "draft" | "scheduled" | "live" | "ended";
  startsAt: string | null; // ISO from datetime-local
  endsAt: string | null;
  description: string;
  images: string[];
}

export interface BulkLotInput {
  categoryId: string;
  codes: string[];
  aimag: string;
  reserve: number;
  status: "draft" | "scheduled" | "live" | "ended";
  startsAt: string | null;
  endsAt: string | null;
  description: string;
  images: string[];
}

export interface LotActionState {
  error?: string;
  /** number of lots created (bulk) */
  created?: number;
}

// values arrive as UTC ISO strings (converted client-side in the viewer's zone)
function parseDate(v: string | null): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** A lot's code must belong to the chosen category (constants.ts). */
async function categoryCodeFor(categoryId: string): Promise<{ name: string; code: CategoryCode } | null> {
  const [cat] = await db
    .select({ name: schema.categories.name, code: schema.categories.code })
    .from(schema.categories)
    .where(eq(schema.categories.id, categoryId))
    .limit(1);
  if (!cat) return null;
  if (!(cat.code in CATEGORIES)) return null;
  return { name: cat.name, code: cat.code as CategoryCode };
}

function validate(input: LotInput): string | null {
  if (!input.categoryId) return "Ангилал сонгоно уу.";
  if (!input.code.trim()) return "Лотын код сонгоно уу.";
  if (!input.reserve || input.reserve <= 0) return "Босго үнэ оруулна уу.";
  return null;
}

export async function createLot(input: LotInput): Promise<LotActionState> {
  const admin = await requirePermission("lots.create");
  const err = validate(input);
  if (err) return { error: err };

  const cat = await categoryCodeFor(input.categoryId);
  if (!cat) return { error: "Ангилал олдсонгүй." };

  const code = input.code.trim();
  // the code must be one of the category's predefined codes
  if (categoryForCode(code) !== cat.code) {
    return { error: `${code} нь ${cat.name} ангилалд хамаарахгүй код байна.` };
  }

  try {
    const [lot] = await db
      .insert(schema.lots)
      .values({
        code,
        categoryId: input.categoryId,
        title: cat.name,
        aimag: input.aimag.trim() || null,
        description: input.description.trim() || null,
        reserve: input.reserve,
        status: input.status,
        startsAt: parseDate(input.startsAt),
        endsAt: parseDate(input.endsAt),
        images: input.images ?? [],
      })
      .returning({ id: schema.lots.id });
    await writeAudit({ actorId: admin.id, action: "lot.create", targetType: "lot", targetId: lot!.id, meta: { code } });
  } catch {
    return { error: "Энэ кодтой лот аль хэдийн байна." };
  }
  revalidatePath("/admin/lots");
  revalidatePath("/catalog");
  return {};
}

/** Create several lots at once — one per selected code, sharing the schedule. */
export async function createLotsBulk(input: BulkLotInput): Promise<LotActionState> {
  const admin = await requirePermission("lots.create");
  if (!input.categoryId) return { error: "Ангилал сонгоно уу." };
  if (!input.codes || input.codes.length === 0) return { error: "Дор хаяж нэг код сонгоно уу." };
  if (!input.reserve || input.reserve <= 0) return { error: "Босго үнэ оруулна уу." };

  const cat = await categoryCodeFor(input.categoryId);
  if (!cat) return { error: "Ангилал олдсонгүй." };

  // only codes that belong to this category and that aren't already used
  const valid = [...new Set(input.codes)].filter((c) => categoryForCode(c) === cat.code);
  if (valid.length === 0) return { error: "Сонгосон код тухайн ангилалд хамаарахгүй байна." };

  const existing = await db.select({ code: schema.lots.code }).from(schema.lots);
  const taken = new Set(existing.map((r) => r.code));
  const toCreate = valid.filter((c) => !taken.has(c));
  if (toCreate.length === 0) return { error: "Сонгосон бүх код аль хэдийн ашиглагдсан байна." };

  const startsAt = parseDate(input.startsAt);
  const endsAt = parseDate(input.endsAt);
  const rows = toCreate.map((code) => ({
    code,
    categoryId: input.categoryId,
    title: cat.name,
    aimag: input.aimag.trim() || null,
    description: input.description.trim() || null,
    reserve: input.reserve,
    status: input.status,
    startsAt,
    endsAt,
    images: input.images ?? [],
  }));

  const created = await db.insert(schema.lots).values(rows).returning({ id: schema.lots.id, code: schema.lots.code });
  await writeAudit({
    actorId: admin.id,
    action: "lot.create_bulk",
    targetType: "lot",
    targetId: cat.code,
    meta: { codes: created.map((c) => c.code) },
  });
  revalidatePath("/admin/lots");
  revalidatePath("/catalog");
  return { created: created.length };
}

export async function updateLot(id: string, input: LotInput): Promise<LotActionState> {
  const admin = await requirePermission("lots.edit");
  const err = validate(input);
  if (err) return { error: err };

  const cat = await categoryCodeFor(input.categoryId);
  if (!cat) return { error: "Ангилал олдсонгүй." };

  const code = input.code.trim();
  if (categoryForCode(code) !== cat.code) {
    return { error: `${code} нь ${cat.name} ангилалд хамаарахгүй код байна.` };
  }

  try {
    await db
      .update(schema.lots)
      .set({
        code,
        categoryId: input.categoryId,
        title: cat.name,
        aimag: input.aimag.trim() || null,
        description: input.description.trim() || null,
        reserve: input.reserve,
        status: input.status,
        startsAt: parseDate(input.startsAt),
        endsAt: parseDate(input.endsAt),
        images: input.images ?? [],
      })
      .where(eq(schema.lots.id, id));
  } catch {
    return { error: "Энэ кодтой лот аль хэдийн байна." };
  }
  await writeAudit({ actorId: admin.id, action: "lot.update", targetType: "lot", targetId: id });
  revalidatePath("/admin/lots");
  revalidatePath("/catalog");
  revalidatePath(`/lots/${id}`);
  return {};
}

export async function cancelLot(id: string): Promise<void> {
  const admin = await requirePermission("lots.cancel");
  await db.update(schema.lots).set({ status: "cancelled" }).where(eq(schema.lots.id, id));
  await writeAudit({ actorId: admin.id, action: "lot.cancel", targetType: "lot", targetId: id });
  revalidatePath("/admin/lots");
  revalidatePath("/catalog");
}

export interface RerunInput {
  startsAt: string | null; // ISO from datetime-local
  endsAt: string | null;
}

/**
 * Re-run (relist) a finished lot — used when the winner fails to pay. The lot is
 * reopened for a brand-new auction round: the previous winner/leader/price and
 * payment state are cleared and a fresh schedule is set. The previous round's
 * bids are kept (marked `void`) so the full history survives, and a `lot.rerun`
 * audit entry records the finished round (run history).
 *
 * The durable reset is enough: the bid engine's `ensureLot` reconciles its cached
 * "ended" state against this new scheduled/live status and reseeds, so the lot
 * actually reopens (see apps/bid/src/engine.ts). Just editing the end time — the
 * old workaround — never worked because `status` stayed "ended".
 */
export async function rerunLot(id: string, input: RerunInput): Promise<LotActionState> {
  const admin = await requirePermission("lots.rerun");

  const startsAt = parseDate(input.startsAt);
  const endsAt = parseDate(input.endsAt);
  if (!startsAt || !endsAt) return { error: "Эхлэх ба дуусах огноог оруулна уу." };
  if (endsAt <= startsAt) return { error: "Дуусах огноо эхлэх огнооноос хойш байх ёстой." };

  const [lot] = await db.select().from(schema.lots).where(eq(schema.lots.id, id)).limit(1);
  if (!lot) return { error: "Лот олдсонгүй." };

  // Only a finished lot may be re-run (a live/upcoming one is still in progress).
  const phase = lotPhase(lot.status, lot.startsAt, lot.endsAt);
  if (phase !== "ended" && phase !== "settled" && phase !== "cancelled") {
    return { error: "Зөвхөн дууссан лотыг дахин ажиллуулна." };
  }

  // Snapshot the finished round for the audit trail before we clear it.
  const prevBids = await db.$count(schema.bids, eq(schema.bids.lotId, id));
  let prevWinnerName: string | null = null;
  if (lot.winnerUserId) {
    const [w] = await db
      .select({
        email: schema.users.email,
        accountType: schema.users.accountType,
        surname: schema.individualProfiles.surname,
        givenName: schema.individualProfiles.givenName,
        registeredName: schema.legalEntityProfiles.registeredName,
      })
      .from(schema.users)
      .leftJoin(schema.individualProfiles, eq(schema.individualProfiles.userId, schema.users.id))
      .leftJoin(schema.legalEntityProfiles, eq(schema.legalEntityProfiles.userId, schema.users.id))
      .where(eq(schema.users.id, lot.winnerUserId))
      .limit(1);
    if (w) {
      prevWinnerName =
        w.accountType === "legal_entity"
          ? w.registeredName || w.email
          : [w.surname, w.givenName].filter(Boolean).join(" ") || w.email;
    }
  }

  await db.transaction(async (tx) => {
    // Keep the previous round's bids as history, but strip every "winning"
    // semantic so they're never recounted toward a bidder's committed total.
    await tx.update(schema.bids).set({ status: "void" }).where(eq(schema.bids.lotId, id));
    await tx
      .update(schema.lots)
      .set({
        status: "scheduled",
        startsAt,
        endsAt,
        currentPrice: null,
        leaderUserId: null,
        winnerUserId: null,
        payment: "pending",
        permitIssuedAt: null,
      })
      .where(eq(schema.lots.id, id));
  });

  await writeAudit({
    actorId: admin.id,
    action: "lot.rerun",
    targetType: "lot",
    targetId: id,
    meta: {
      code: lot.code,
      previousWinnerUserId: lot.winnerUserId,
      previousWinnerName: prevWinnerName,
      previousPrice: lot.currentPrice ?? lot.reserve,
      previousPayment: lot.payment,
      previousStartsAt: lot.startsAt?.toISOString() ?? null,
      previousEndsAt: lot.endsAt?.toISOString() ?? null,
      previousBids: prevBids,
      newStartsAt: startsAt.toISOString(),
      newEndsAt: endsAt.toISOString(),
    },
  });

  revalidatePath("/admin/lots");
  revalidatePath(`/admin/lots/${id}`);
  revalidatePath("/admin/results");
  revalidatePath("/catalog");
  revalidatePath(`/lots/${id}`);
  return {};
}

/** Permanently delete a lot (and its bids, via cascade). */
export async function deleteLot(id: string): Promise<LotActionState> {
  const admin = await requirePermission("lots.delete");
  const [lot] = await db.select({ code: schema.lots.code }).from(schema.lots).where(eq(schema.lots.id, id)).limit(1);
  await db.delete(schema.lots).where(eq(schema.lots.id, id));
  await writeAudit({ actorId: admin.id, action: "lot.delete", targetType: "lot", targetId: id, meta: { code: lot?.code } });
  revalidatePath("/admin/lots");
  revalidatePath("/catalog");
  return {};
}
