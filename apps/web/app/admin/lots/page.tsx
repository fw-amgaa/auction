import { getAdminLots, getCategoryOptions } from "@/lib/lots";

import { LotsManager, type ManagedLot } from "./LotsManager";

export const dynamic = "force-dynamic";

export default async function AdminLotsPage() {
  const [lots, categories] = await Promise.all([getAdminLots(), getCategoryOptions()]);
  const managed: ManagedLot[] = lots.map((l) => ({
    id: l.id,
    code: l.code,
    categoryId: l.categoryId,
    species: l.species,
    aimag: l.aimag,
    reserve: l.reserve,
    step: l.step,
    status: l.status,
    phase: l.phase,
    startsAt: l.startsAt?.toISOString() ?? null,
    endsAt: l.endsAt?.toISOString() ?? null,
    description: l.description,
    images: l.images,
  }));
  return <LotsManager lots={managed} categories={categories.map((c) => ({ id: c.id, name: c.name }))} />;
}
