import { getAdminLots, getCategoryOptions, getCodeAvailability } from "@/lib/lots";

import { LotsManager, type ManagedLot } from "./LotsManager";

export const dynamic = "force-dynamic";

export default async function AdminLotsPage() {
  const [lots, categories, codeAvailability] = await Promise.all([
    getAdminLots(),
    getCategoryOptions(),
    getCodeAvailability(),
  ]);
  const managed: ManagedLot[] = lots.map((l) => ({
    id: l.id,
    code: l.code,
    categoryId: l.categoryId,
    species: l.species,
    aimag: l.aimag,
    reserve: l.reserve,
    status: l.status,
    phase: l.phase,
    startsAt: l.startsAt?.toISOString() ?? null,
    endsAt: l.endsAt?.toISOString() ?? null,
    description: l.description,
    images: l.images,
  }));
  return (
    <LotsManager
      lots={managed}
      categories={categories.map((c) => ({
        id: c.id,
        code: c.code,
        name: c.name,
        defaultReserve: c.defaultReserve,
      }))}
      codeAvailability={codeAvailability}
    />
  );
}
