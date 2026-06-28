"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db, schema } from "@auction/db";

import { writeAudit } from "@/lib/audit";
import { parseMnInput } from "@/lib/datetime";
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

export interface LotActionState {
  error?: string;
}

const parseDate = (v: string | null): Date | null => parseMnInput(v);

function validate(input: LotInput): string | null {
  if (!input.categoryId) return "Зүйл сонгоно уу.";
  if (!input.code.trim()) return "Лотын код оруулна уу.";
  if (!input.reserve || input.reserve <= 0) return "Босго үнэ оруулна уу.";
  return null;
}

export async function createLot(input: LotInput): Promise<LotActionState> {
  const admin = await requireAdmin();
  const err = validate(input);
  if (err) return { error: err };

  const [cat] = await db
    .select({ name: schema.categories.name })
    .from(schema.categories)
    .where(eq(schema.categories.id, input.categoryId))
    .limit(1);
  if (!cat) return { error: "Зүйл олдсонгүй." };

  try {
    const [lot] = await db
      .insert(schema.lots)
      .values({
        code: input.code.trim(),
        categoryId: input.categoryId,
        title: cat.name,
        aimag: input.aimag.trim() || null,
        description: input.description.trim() || null,
        reserve: input.reserve,
        step: Math.round(input.reserve * 0.1),
        status: input.status,
        startsAt: parseDate(input.startsAt),
        endsAt: parseDate(input.endsAt),
        images: input.images ?? [],
      })
      .returning({ id: schema.lots.id });
    await writeAudit({ actorId: admin.id, action: "lot.create", targetType: "lot", targetId: lot!.id, meta: { code: input.code } });
  } catch {
    return { error: "Энэ кодтой лот аль хэдийн байна." };
  }
  revalidatePath("/admin/lots");
  revalidatePath("/catalog");
  return {};
}

export async function updateLot(id: string, input: LotInput): Promise<LotActionState> {
  const admin = await requireAdmin();
  const err = validate(input);
  if (err) return { error: err };

  await db
    .update(schema.lots)
    .set({
      code: input.code.trim(),
      categoryId: input.categoryId,
      aimag: input.aimag.trim() || null,
      description: input.description.trim() || null,
      reserve: input.reserve,
      step: Math.round(input.reserve * 0.1),
      status: input.status,
      startsAt: parseDate(input.startsAt),
      endsAt: parseDate(input.endsAt),
      images: input.images ?? [],
    })
    .where(eq(schema.lots.id, id));
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
