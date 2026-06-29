"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db, schema } from "@auction/db";
import { categoryForCode, CATEGORIES, type CategoryCode } from "@auction/shared";

import { writeAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/session";

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
  const admin = await requireAdmin();
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
  const admin = await requireAdmin();
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
  const admin = await requireAdmin();
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
  const admin = await requireAdmin();
  await db.update(schema.lots).set({ status: "cancelled" }).where(eq(schema.lots.id, id));
  await writeAudit({ actorId: admin.id, action: "lot.cancel", targetType: "lot", targetId: id });
  revalidatePath("/admin/lots");
  revalidatePath("/catalog");
}

/** Permanently delete a lot (and its bids, via cascade). */
export async function deleteLot(id: string): Promise<LotActionState> {
  const admin = await requireAdmin();
  const [lot] = await db.select({ code: schema.lots.code }).from(schema.lots).where(eq(schema.lots.id, id)).limit(1);
  await db.delete(schema.lots).where(eq(schema.lots.id, id));
  await writeAudit({ actorId: admin.id, action: "lot.delete", targetType: "lot", targetId: id, meta: { code: lot?.code } });
  revalidatePath("/admin/lots");
  revalidatePath("/catalog");
  return {};
}
