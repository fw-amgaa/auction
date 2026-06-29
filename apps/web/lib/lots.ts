import "server-only";

import { asc, desc, eq, inArray } from "drizzle-orm";

import { db, schema } from "@auction/db";
import { CATEGORIES, type CategoryCode, CATEGORY_CODES, incrementsForCode } from "@auction/shared";

/** Codes of the two valid categories — guards every lot/category selection. */
const VALID_CATEGORY_CODES = new Set<string>(CATEGORY_CODES);

export type LotStatus = (typeof schema.lots.status.enumValues)[number];
/** Catalog display status (the design's three-way view). */
export type DisplayStatus = "live" | "upcoming" | "ended";

/**
 * The auction PHASE is derived from the clock, not stored: a published lot is
 * upcoming before startsAt, live within the window, ended after endsAt. Only the
 * lifecycle states (draft/cancelled/settled/finalized-ended) are authoritative.
 */
export function displayStatus(status: LotStatus, startsAt: Date | null, endsAt: Date | null): DisplayStatus {
  if (status === "ended" || status === "settled") return "ended";
  const now = Date.now();
  if (startsAt && now < startsAt.getTime()) return "upcoming";
  if (endsAt && now >= endsAt.getTime()) return "ended";
  return "live"; // scheduled/live and inside the window
}

/** Full lifecycle phase for admin display (includes draft/cancelled). */
export type Phase = "draft" | "upcoming" | "live" | "ended" | "cancelled" | "settled";
export function lotPhase(status: LotStatus, startsAt: Date | null, endsAt: Date | null): Phase {
  if (status === "draft" || status === "cancelled" || status === "settled") return status;
  return displayStatus(status, startsAt, endsAt); // live | upcoming | ended (by clock)
}

export interface CatalogLot {
  id: string;
  code: string;
  categoryCode: string;
  species: string;
  latin: string | null;
  aimag: string | null;
  reserve: number;
  currentPrice: number | null;
  status: DisplayStatus;
  startsAt: number | null;
  endsAt: number | null;
  image: string | null;
  /**
   * For ended lots only — the anonymised winner label ("Та" when the viewer won,
   * "Оролцогч #N" otherwise) or null when the lot ended with no bids. Computed
   * server-side so the raw winner identity is never sent to the browser.
   */
  winnerLabel: string | null;
  /** True when the viewing bidder is the winner of an ended lot. */
  iWon: boolean;
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
    currentPrice: lot.currentPrice,
    status: displayStatus(lot.status, lot.startsAt, lot.endsAt),
    startsAt: lot.startsAt?.getTime() ?? null,
    endsAt: lot.endsAt?.getTime() ?? null,
    image: lot.images?.[0] ?? null,
    winnerLabel: null,
    iWon: false,
  };
}

/**
 * Per-lot stable participant numbering by order of first bid (ascending seq),
 * matching the live room's "Оролцогч #N" pseudonyms. Returns lotId → (userId → N).
 */
async function participantNumbers(lotIds: string[]): Promise<Map<string, Map<string, number>>> {
  const out = new Map<string, Map<string, number>>();
  if (lotIds.length === 0) return out;
  const rows = await db
    .select({ lotId: schema.bids.lotId, userId: schema.bids.userId })
    .from(schema.bids)
    .where(inArray(schema.bids.lotId, lotIds))
    .orderBy(asc(schema.bids.seq));
  for (const r of rows) {
    let m = out.get(r.lotId);
    if (!m) {
      m = new Map();
      out.set(r.lotId, m);
    }
    if (!m.has(r.userId)) m.set(r.userId, m.size + 1);
  }
  return out;
}

/** The viewer a catalog request is scoped to (per-code eligibility + identity). */
export type CatalogViewer = { id: string; role: "bidder" | "admin"; codes: string[] } | null;

export async function getCatalogLots(
  filters: {
    species?: string;
    status?: string;
    aimag?: string;
    q?: string;
    sort?: string;
  },
  viewer: CatalogViewer = null,
): Promise<{ lots: CatalogLot[]; aimags: string[] }> {
  const rows = await db
    .select({ lot: schema.lots, category: schema.categories })
    .from(schema.lots)
    .innerJoin(schema.categories, eq(schema.lots.categoryId, schema.categories.id))
    .where(inArray(schema.lots.status, CATALOG_STATUSES));

  // Winner identity is kept server-side; only the anonymised label leaves here.
  const winnerById = new Map(rows.map((r) => [r.lot.id, r.lot.winnerUserId]));

  // Only lots in the two valid categories are ever shown.
  let lots = rows.map(toCatalogLot).filter((l) => VALID_CATEGORY_CODES.has(l.categoryCode));

  // Per-code eligibility: a bidder only ever sees lots whose code they hold.
  // Admins (and unscoped server calls passing no viewer) see everything.
  if (viewer && viewer.role !== "admin") {
    const codes = new Set(viewer.codes);
    lots = lots.filter((l) => codes.has(l.code));
  }
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

  // Anonymised winner labels for ended lots (one bids query for the whole set).
  const endedWithWinner = lots.filter((l) => l.status === "ended" && winnerById.get(l.id));
  const nums = await participantNumbers(endedWithWinner.map((l) => l.id));
  for (const l of lots) {
    const winner = l.status === "ended" ? (winnerById.get(l.id) ?? null) : null;
    if (!winner) continue;
    l.iWon = !!viewer?.id && winner === viewer.id;
    l.winnerLabel = l.iWon ? "Та" : `Оролцогч #${nums.get(l.id)?.get(winner) ?? "?"}`;
  }
  return { lots, aimags };
}

export interface LotDetail extends CatalogLot {
  title: string;
  description: string | null;
  bidders: number;
  /** currentPrice when there are bids, otherwise the reserve (the resolved price). */
  finalPrice: number;
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

  // All bids ascending → stable per-user participant numbers; show the last 8.
  const allBids = await db
    .select()
    .from(schema.bids)
    .where(eq(schema.bids.lotId, id))
    .orderBy(asc(schema.bids.seq));

  const num = new Map<string, number>();
  for (const b of allBids) if (!num.has(b.userId)) num.set(b.userId, num.size + 1);

  const now = Date.now();
  const history = allBids
    .slice(-8)
    .reverse()
    .map((b) => ({
      label: viewerId && b.userId === viewerId ? "Та" : `Оролцогч #${num.get(b.userId)}`,
      amount: b.amount,
      agoSec: Math.max(0, Math.floor((now - b.createdAt.getTime()) / 1000)),
      mine: !!viewerId && b.userId === viewerId,
    }));

  const status = displayStatus(row.lot.status, row.lot.startsAt, row.lot.endsAt);
  const winner = row.lot.winnerUserId;
  const iWon = status === "ended" && !!viewerId && winner === viewerId;
  const winnerLabel =
    status !== "ended" || !winner ? null : iWon ? "Та" : `Оролцогч #${num.get(winner) ?? "?"}`;

  return {
    ...toCatalogLot(row),
    title: row.lot.title,
    description: row.lot.description,
    bidders: num.size,
    finalPrice: row.lot.currentPrice ?? row.lot.reserve,
    winnerLabel,
    iWon,
    history,
  };
}

/* ------------------------------ admin side -------------------------------- */

export interface AdminLot {
  id: string;
  code: string;
  categoryId: string;
  species: string;
  aimag: string | null;
  reserve: number;
  status: LotStatus; // raw lifecycle (draft / published-scheduled / …)
  phase: Phase; // computed phase for display
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
  return rows
    .filter(({ category }) => VALID_CATEGORY_CODES.has(category.code))
    .map(({ lot, category }) => ({
    id: lot.id,
    code: lot.code,
    categoryId: lot.categoryId,
    species: category.name,
    aimag: lot.aimag,
    reserve: lot.reserve,
    status: lot.status,
    phase: lotPhase(lot.status, lot.startsAt, lot.endsAt),
    startsAt: lot.startsAt,
    endsAt: lot.endsAt,
    description: lot.description,
    images: lot.images ?? [],
  }));
}

/** Real bidder name (admin-only). Mirrors apps/web/lib/results.ts `bidderName`. */
function realBidderName(u: {
  accountType: string;
  email: string;
  individualProfile: { surname: string | null; givenName: string | null } | null;
  legalEntityProfile: { registeredName: string | null } | null;
} | null): string {
  if (!u) return "—";
  if (u.accountType === "legal_entity") return u.legalEntityProfile?.registeredName ?? u.email;
  return [u.individualProfile?.surname, u.individualProfile?.givenName].filter(Boolean).join(" ") || u.email;
}

export interface AdminBidRow {
  seq: number;
  name: string;
  amount: number;
  agoSec: number;
}

export interface AdminLotDetail {
  id: string;
  code: string;
  categoryCode: string;
  species: string;
  latin: string | null;
  aimag: string | null;
  title: string;
  description: string | null;
  reserve: number;
  currentPrice: number | null;
  finalPrice: number;
  inc1: number;
  inc2: number;
  status: LotStatus;
  phase: Phase;
  startsAt: Date | null;
  endsAt: Date | null;
  image: string | null;
  payment: "pending" | "paid" | "defaulted";
  winnerUserId: string | null;
  winnerName: string | null;
  bidders: number;
  history: AdminBidRow[];
}

/**
 * Full lot detail for the admin monitor page — includes REAL bidder names and
 * the complete bid history (admins only; never exposed to bidders).
 */
export async function getAdminLotDetail(id: string): Promise<AdminLotDetail | null> {
  const [row] = await db
    .select({ lot: schema.lots, category: schema.categories })
    .from(schema.lots)
    .innerJoin(schema.categories, eq(schema.lots.categoryId, schema.categories.id))
    .where(eq(schema.lots.id, id))
    .limit(1);
  if (!row) return null;
  const { lot, category } = row;

  const bids = await db
    .select()
    .from(schema.bids)
    .where(eq(schema.bids.lotId, id))
    .orderBy(desc(schema.bids.seq));

  const userIds = [
    ...new Set([...bids.map((b) => b.userId), lot.winnerUserId].filter(Boolean) as string[]),
  ];
  const users = userIds.length
    ? await db.query.users.findMany({
        where: inArray(schema.users.id, userIds),
        with: { individualProfile: true, legalEntityProfile: true },
      })
    : [];
  const nameById = new Map(users.map((u) => [u.id, realBidderName(u)]));

  const now = Date.now();
  const history: AdminBidRow[] = bids.map((b) => ({
    seq: b.seq,
    name: nameById.get(b.userId) ?? "—",
    amount: b.amount,
    agoSec: Math.max(0, Math.floor((now - b.createdAt.getTime()) / 1000)),
  }));

  const [inc1, inc2] = incrementsForCode(lot.code);
  return {
    id: lot.id,
    code: lot.code,
    categoryCode: category.code,
    species: category.name,
    latin: category.latinName,
    aimag: lot.aimag,
    title: lot.title,
    description: lot.description,
    reserve: lot.reserve,
    currentPrice: lot.currentPrice,
    finalPrice: lot.currentPrice ?? lot.reserve,
    inc1,
    inc2,
    status: lot.status,
    phase: lotPhase(lot.status, lot.startsAt, lot.endsAt),
    startsAt: lot.startsAt,
    endsAt: lot.endsAt,
    image: lot.images?.[0] ?? null,
    payment: lot.payment,
    winnerUserId: lot.winnerUserId,
    winnerName: lot.winnerUserId ? (nameById.get(lot.winnerUserId) ?? null) : null,
    bidders: new Set(bids.map((b) => b.userId)).size,
    history,
  };
}

export async function getCategoryOptions() {
  return db
    .select({
      id: schema.categories.id,
      code: schema.categories.code,
      name: schema.categories.name,
      defaultReserve: schema.categories.defaultReserve,
    })
    .from(schema.categories)
    // Only the two valid categories may ever appear in a selection, regardless
    // of any legacy rows still in the table.
    .where(inArray(schema.categories.code, [...CATEGORY_CODES]))
    .orderBy(asc(schema.categories.sortOrder));
}

export interface CodeAvailability {
  /** category code → { code, taken } for every code in that category */
  [category: string]: { code: string; taken: boolean }[];
}

/**
 * Per-category lot codes with a flag for codes already used by a lot, so the
 * admin lot form can offer only free codes (single + bulk create).
 */
export async function getCodeAvailability(): Promise<CodeAvailability> {
  const rows = await db.select({ code: schema.lots.code }).from(schema.lots);
  const taken = new Set(rows.map((r) => r.code));
  const out: CodeAvailability = {};
  for (const cat of CATEGORY_CODES as CategoryCode[]) {
    out[cat] = CATEGORIES[cat].codes.map((code) => ({ code, taken: taken.has(code) }));
  }
  return out;
}
