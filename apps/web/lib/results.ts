import "server-only";

import { desc, eq, inArray } from "drizzle-orm";

import { db, schema } from "@auction/db";

export type Payment = "pending" | "paid" | "defaulted";

export interface ResultRow {
  lotId: string;
  code: string;
  species: string;
  aimag: string | null;
  winnerName: string | null;
  winnerUserId: string | null;
  price: number;
  payment: Payment;
  permitIssued: boolean;
}

function bidderName(u: { accountType: string; legalEntityProfile: { registeredName: string | null } | null; individualProfile: { surname: string | null; givenName: string | null } | null; email: string } | null): string | null {
  if (!u) return null;
  if (u.accountType === "legal_entity") return u.legalEntityProfile?.registeredName ?? u.email;
  return [u.individualProfile?.surname, u.individualProfile?.givenName].filter(Boolean).join(" ") || u.email;
}

export async function getResults(): Promise<{ rows: ResultRow[]; kpis: { ended: number; collected: number; pending: number; permitsLeft: number } }> {
  const lots = await db
    .select({ lot: schema.lots, category: schema.categories })
    .from(schema.lots)
    .innerJoin(schema.categories, eq(schema.lots.categoryId, schema.categories.id))
    .where(inArray(schema.lots.status, ["ended", "settled"]))
    .orderBy(desc(schema.lots.endsAt));

  const winnerIds = [...new Set(lots.map((l) => l.lot.winnerUserId).filter(Boolean) as string[])];
  const winners = winnerIds.length
    ? await db.query.users.findMany({
        where: inArray(schema.users.id, winnerIds),
        with: { individualProfile: true, legalEntityProfile: true },
      })
    : [];
  const wmap = new Map(winners.map((w) => [w.id, w]));

  const rows: ResultRow[] = lots.map(({ lot, category }) => ({
    lotId: lot.id,
    code: lot.code,
    species: category.name,
    aimag: lot.aimag,
    winnerUserId: lot.winnerUserId,
    winnerName: lot.winnerUserId ? bidderName(wmap.get(lot.winnerUserId) ?? null) : null,
    price: lot.currentPrice ?? lot.reserve,
    payment: lot.payment,
    permitIssued: lot.permitIssuedAt != null,
  }));

  const collected = rows.filter((r) => r.payment === "paid").reduce((a, r) => a + r.price, 0);
  const pending = rows.filter((r) => r.payment === "pending" && r.winnerUserId).length;
  const permitsLeft = rows.filter((r) => r.payment === "paid" && !r.permitIssued).length;
  return { rows, kpis: { ended: rows.length, collected, pending, permitsLeft } };
}
