import "server-only";

import { desc, eq, inArray, ne } from "drizzle-orm";

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

export async function getLimitsOverview(): Promise<LimitUser[]> {
  const rows = await db.query.users.findMany({
    where: ne(schema.users.role, "admin"),
    with: { individualProfile: true, legalEntityProfile: true },
    orderBy: (u, { desc: d }) => [d(u.limit)],
  });
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const ledger = await db
    .select()
    .from(schema.limitLedger)
    .where(inArray(schema.limitLedger.userId, ids))
    .orderBy(desc(schema.limitLedger.createdAt));

  const byUser = new Map<string, LedgerEntry[]>();
  for (const l of ledger) {
    if (!ADMIN_TYPES.includes(l.type)) continue;
    const list = byUser.get(l.userId) ?? [];
    if (list.length < 6) list.push({ id: l.id, type: l.type, delta: l.delta, note: l.note, createdAt: l.createdAt });
    byUser.set(l.userId, list);
  }

  return rows.map((u) => {
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
  });
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
