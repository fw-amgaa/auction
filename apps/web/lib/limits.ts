import "server-only";

import { and, count, desc, eq, ilike, inArray, ne, or, sum } from "drizzle-orm";

import { db, schema } from "@auction/db";

export type LedgerType = (typeof schema.limitLedger.type.enumValues)[number];

export interface LedgerEntry {
  id: string;
  type: LedgerType;
  delta: number;
  note: string | null;
  createdAt: Date;
}

export interface LimitUser {
  id: string;
  accountType: "individual" | "legal_entity";
  name: string;
  limit: number;
  committed: number;
  available: number;
  history: LedgerEntry[];
}

const ADMIN_TYPES: LedgerType[] = ["admin_issue", "admin_raise", "admin_lower", "offline_refund"];

/**
 * Page of the limits table — previously an unbounded `findMany()` fetching every
 * non-admin user (plus their full ledger history) on every request. Search now
 * runs in SQL and only the requested page's users/ledger rows are ever fetched.
 */
export async function getLimitsPage(params: {
  q?: string;
  limit: number;
  offset: number;
}): Promise<{ rows: LimitUser[]; hasNext: boolean }> {
  const conds = [ne(schema.users.role, "admin")];
  if (params.q?.trim()) {
    const q = `%${params.q.trim()}%`;
    conds.push(
      or(
        ilike(schema.users.email, q),
        ilike(schema.individualProfiles.surname, q),
        ilike(schema.individualProfiles.givenName, q),
        ilike(schema.legalEntityProfiles.registeredName, q),
      )!,
    );
  }

  // Resolve the page of ids (sorted by limit, filtered incl. joined profile
  // fields for `q`) first — the relational query API can't filter on joined
  // tables directly — then fetch full profile + ledger data for just those ids.
  const idRows = await db
    .selectDistinct({ id: schema.users.id, limit: schema.users.limit })
    .from(schema.users)
    .leftJoin(schema.individualProfiles, eq(schema.individualProfiles.userId, schema.users.id))
    .leftJoin(schema.legalEntityProfiles, eq(schema.legalEntityProfiles.userId, schema.users.id))
    .where(and(...conds))
    .orderBy(desc(schema.users.limit))
    .limit(params.limit + 1)
    .offset(params.offset);

  const hasNext = idRows.length > params.limit;
  const ids = idRows.slice(0, params.limit).map((r) => r.id);
  if (ids.length === 0) return { rows: [], hasNext: false };

  const [rows, ledger] = await Promise.all([
    db.query.users.findMany({
      where: inArray(schema.users.id, ids),
      with: { individualProfile: true, legalEntityProfile: true },
    }),
    db
      .select()
      .from(schema.limitLedger)
      .where(and(inArray(schema.limitLedger.userId, ids), inArray(schema.limitLedger.type, ADMIN_TYPES)))
      .orderBy(desc(schema.limitLedger.createdAt)),
  ]);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const ordered = ids.map((id) => byId.get(id)).filter((u): u is (typeof rows)[number] => !!u);

  const byUser = new Map<string, LedgerEntry[]>();
  for (const l of ledger) {
    const list = byUser.get(l.userId) ?? [];
    if (list.length < 6) list.push({ id: l.id, type: l.type, delta: l.delta, note: l.note, createdAt: l.createdAt });
    byUser.set(l.userId, list);
  }

  return {
    rows: ordered.map((u) => {
      const name =
        u.accountType === "legal_entity"
          ? (u.legalEntityProfile?.registeredName ?? u.email)
          : [u.individualProfile?.surname, u.individualProfile?.givenName].filter(Boolean).join(" ") || u.email;
      return {
        id: u.id,
        accountType: u.accountType,
        name,
        limit: u.limit,
        committed: u.committedCache,
        available: u.limit - u.committedCache,
        history: byUser.get(u.id) ?? [],
      };
    }),
    hasNext,
  };
}

/** Unfiltered totals across every non-admin user, for the KPI strip (independent of search/pagination). */
export async function getLimitsTotals(): Promise<{ users: number; totalLimit: number; totalCommitted: number }> {
  const [row] = await db
    .select({ n: count(), totalLimit: sum(schema.users.limit), totalCommitted: sum(schema.users.committedCache) })
    .from(schema.users)
    .where(ne(schema.users.role, "admin"));
  return {
    users: Number(row?.n ?? 0),
    totalLimit: Number(row?.totalLimit ?? 0),
    totalCommitted: Number(row?.totalCommitted ?? 0),
  };
}

export async function getUserLedger(userId: string): Promise<LedgerEntry[]> {
  const rows = await db
    .select()
    .from(schema.limitLedger)
    .where(eq(schema.limitLedger.userId, userId))
    .orderBy(desc(schema.limitLedger.createdAt))
    .limit(100);
  return rows.map((l) => ({ id: l.id, type: l.type, delta: l.delta, note: l.note, createdAt: l.createdAt }));
}
