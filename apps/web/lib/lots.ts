import "server-only";

import { asc, desc, eq, inArray } from "drizzle-orm";

import { db, schema } from "@auction/db";

export type LotStatus = (typeof schema.lots.status.enumValues)[number];
/** Catalog display status (the design's three-way view). */
export type DisplayStatus = "live" | "upcoming" | "ended";

export function displayStatus(s: LotStatus): DisplayStatus {
  if (s === "live") return "live";
  if (s === "scheduled") return "upcoming";
  return "ended"; // ended | settled
}

export interface CatalogLot {
  id: string;
  code: string;
  categoryCode: string;
  species: string;
  latin: string | null;
  aimag: string | null;
  reserve: number;
  step: number;
  currentPrice: number | null;
  status: DisplayStatus;
  startsAt: number | null;
  endsAt: number | null;
  image: string | null;
}

const CATALOG_STATUSES: LotStatus[] = ["scheduled", "live", "ended", "settled"];

type LotJoin = {
  lot: typeof schema.lots.$inferSelect;
  category: typeof schema.categories.$inferSelect;
};

function toCatalogLot({ lot, category }: LotJoin): CatalogLot {
  return {
    id: lot.id,
    code: lot.code,
    categoryCode: category.code,
    species: category.name,
    latin: category.latinName,
    aimag: lot.aimag,
    reserve: lot.reserve,
    step: lot.step,
    currentPrice: lot.currentPrice,
    status: displayStatus(lot.status),
    startsAt: lot.startsAt?.getTime() ?? null,
    endsAt: lot.endsAt?.getTime() ?? null,
    image: lot.images?.[0] ?? null,
  };
}

export async function getCatalogLots(filters: {
  species?: string;
  status?: string;
  aimag?: string;
  q?: string;
  sort?: string;
}): Promise<{ lots: CatalogLot[]; aimags: string[] }> {
  const rows = await db
    .select({ lot: schema.lots, category: schema.categories })
    .from(schema.lots)
    .innerJoin(schema.categories, eq(schema.lots.categoryId, schema.categories.id))
    .where(inArray(schema.lots.status, CATALOG_STATUSES));

  let lots = rows.map(toCatalogLot);
  const aimags = [...new Set(lots.map((l) => l.aimag).filter(Boolean) as string[])].sort();

  const q = (filters.q ?? "").trim().toLowerCase();
  lots = lots.filter(
    (l) =>
      (!filters.species || filters.species === "all" || l.categoryCode === filters.species) &&
      (!filters.status || filters.status === "all" || l.status === filters.status) &&
      (!filters.aimag || filters.aimag === "all" || l.aimag === filters.aimag) &&
      (!q || l.code.toLowerCase().includes(q) || l.species.toLowerCase().includes(q)),
  );

  const rank: Record<DisplayStatus, number> = { live: 0, upcoming: 1, ended: 2 };
  if (filters.sort === "priceAsc") {
    lots.sort((a, b) => (a.currentPrice ?? a.reserve) - (b.currentPrice ?? b.reserve));
  } else if (filters.sort === "priceDesc") {
    lots.sort((a, b) => (b.currentPrice ?? b.reserve) - (a.currentPrice ?? a.reserve));
  } else {
    // ending-soon: live first, then by end time
    lots.sort((a, b) => rank[a.status] - rank[b.status] || (a.endsAt ?? 0) - (b.endsAt ?? 0));
  }
  return { lots, aimags };
}

export interface LotDetail extends CatalogLot {
  title: string;
  description: string | null;
  bidders: number;
  history: { label: string; amount: number; agoSec: number; mine: boolean }[];
}

export async function getLotDetail(id: string, viewerId?: string): Promise<LotDetail | null> {
  const [row] = await db
    .select({ lot: schema.lots, category: schema.categories })
    .from(schema.lots)
    .innerJoin(schema.categories, eq(schema.lots.categoryId, schema.categories.id))
    .where(eq(schema.lots.id, id))
    .limit(1);
  if (!row) return null;

  const recent = await db
    .select()
    .from(schema.bids)
    .where(eq(schema.bids.lotId, id))
    .orderBy(desc(schema.bids.seq))
    .limit(8);

  const distinctBidders = new Set(recent.map((b) => b.userId)).size;
  const now = Date.now();
  const history = recent.map((b) => ({
    label: viewerId && b.userId === viewerId ? "Та" : `Оролцогч #${b.seq}`,
    amount: b.amount,
    agoSec: Math.max(0, Math.floor((now - b.createdAt.getTime()) / 1000)),
    mine: !!viewerId && b.userId === viewerId,
  }));

  return { ...toCatalogLot(row), title: row.lot.title, description: row.lot.description, bidders: distinctBidders, history };
}

/* ------------------------------ admin side -------------------------------- */

export interface AdminLot {
  id: string;
  code: string;
  categoryId: string;
  species: string;
  aimag: string | null;
  reserve: number;
  step: number;
  status: LotStatus;
  startsAt: Date | null;
  endsAt: Date | null;
  description: string | null;
  images: string[];
}

export async function getAdminLots(): Promise<AdminLot[]> {
  const rows = await db
    .select({ lot: schema.lots, category: schema.categories })
    .from(schema.lots)
    .innerJoin(schema.categories, eq(schema.lots.categoryId, schema.categories.id))
    .orderBy(desc(schema.lots.createdAt));
  return rows.map(({ lot, category }) => ({
    id: lot.id,
    code: lot.code,
    categoryId: lot.categoryId,
    species: category.name,
    aimag: lot.aimag,
    reserve: lot.reserve,
    step: lot.step,
    status: lot.status,
    startsAt: lot.startsAt,
    endsAt: lot.endsAt,
    description: lot.description,
    images: lot.images ?? [],
  }));
}

export async function getCategoryOptions() {
  return db
    .select({ id: schema.categories.id, code: schema.categories.code, name: schema.categories.name })
    .from(schema.categories)
    .orderBy(asc(schema.categories.sortOrder));
}
