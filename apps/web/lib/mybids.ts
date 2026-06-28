import "server-only";

import { desc, eq, inArray } from "drizzle-orm";

import { db, schema } from "@auction/db";

export interface MyBidRow {
  lotId: string;
  code: string;
  species: string;
  price: number;
  myAmount: number;
  status: "live" | "ended";
}

async function lotsWith(ids: string[]) {
  if (ids.length === 0) return [];
  return db
    .select({ lot: schema.lots, category: schema.categories })
    .from(schema.lots)
    .innerJoin(schema.categories, eq(schema.lots.categoryId, schema.categories.id))
    .where(inArray(schema.lots.id, ids));
}

export async function getMyBids(userId: string): Promise<{
  active: MyBidRow[];
  won: MyBidRow[];
  lost: MyBidRow[];
}> {
  // my bids → distinct lots + my highest amount per lot
  const myBids = await db
    .select()
    .from(schema.bids)
    .where(eq(schema.bids.userId, userId))
    .orderBy(desc(schema.bids.seq));

  const myMax = new Map<string, number>();
  for (const b of myBids) if (!myMax.has(b.lotId)) myMax.set(b.lotId, b.amount);

  const lots = await lotsWith([...myMax.keys()]);
  const active: MyBidRow[] = [];
  const won: MyBidRow[] = [];
  const lost: MyBidRow[] = [];

  for (const { lot, category } of lots) {
    const row: MyBidRow = {
      lotId: lot.id,
      code: lot.code,
      species: category.name,
      price: lot.currentPrice ?? lot.reserve,
      myAmount: myMax.get(lot.id) ?? 0,
      status: lot.status === "live" ? "live" : "ended",
    };
    if (lot.status === "live") active.push(row);
    else if (lot.winnerUserId === userId) won.push(row);
    else lost.push(row);
  }
  return { active, won, lost };
}
