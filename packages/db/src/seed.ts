/**
 * Seed reference data: the 8 species categories (from the design's category
 * rail) and the initial Terms version. Reserves from the Khovd auction notice
 * where known; others left null until an admin sets them.
 *
 * Run: pnpm --filter @auction/db seed
 */
import { hash } from "@node-rs/argon2";
import { eq } from "drizzle-orm";

import { db } from "./client";
import { categories, lots, termsVersions, users } from "./schema";

const SPECIES = [
  { code: "tekh", name: "Тэх", latinName: "Capra sibirica", defaultReserve: 5_300_000, sortOrder: 1 },
  { code: "chono", name: "Чоно", latinName: "Canis lupus", defaultReserve: null, sortOrder: 2 },
  { code: "yangir", name: "Янгир", latinName: "Capra sibirica", defaultReserve: null, sortOrder: 3 },
  { code: "zagas", name: "Загас", latinName: "Hucho taimen", defaultReserve: null, sortOrder: 4 },
  { code: "ugalz", name: "Угалз", latinName: "Ovis ammon (argali)", defaultReserve: 22_200_000, sortOrder: 5 },
  { code: "gakhai", name: "Гахай", latinName: "Sus scrofa", defaultReserve: null, sortOrder: 6 },
  { code: "shuvuu", name: "Шувуу", latinName: "Falco cherrug", defaultReserve: null, sortOrder: 7 },
  { code: "bulga", name: "Булга", latinName: "Martes zibellina", defaultReserve: null, sortOrder: 8 },
];

async function main() {
  console.log("Seeding categories…");
  for (const s of SPECIES) {
    await db
      .insert(categories)
      .values(s)
      .onConflictDoUpdate({
        target: categories.code,
        set: { name: s.name, latinName: s.latinName, defaultReserve: s.defaultReserve, sortOrder: s.sortOrder },
      });
  }

  console.log("Seeding terms version…");
  await db
    .insert(termsVersions)
    .values({
      version: "v2.3",
      body: "Үйлчилгээний нөхцөл (анхны хувилбар). Засварлахаар орхив.",
    })
    .onConflictDoNothing();

  console.log("Seeding admin user…");
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@auction.mn";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "admin12345";
  const [existingAdmin] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, adminEmail))
    .limit(1);
  if (!existingAdmin) {
    await db.insert(users).values({
      email: adminEmail,
      name: "Админ",
      passwordHash: await hash(adminPassword),
      role: "admin",
      accountType: "individual",
      kyc: "approved",
      source: "admin",
    });
    console.log(`  admin created: ${adminEmail} / ${adminPassword}`);
  } else {
    console.log("  admin already exists, skipping");
  }

  console.log("Seeding sample lots…");
  const cats = await db.select().from(categories);
  const byCode = new Map(cats.map((c) => [c.code, c.id]));
  const now = Date.now();
  const at = (ms: number) => new Date(now + ms);
  const MIN = 60_000;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;

  const SAMPLE_LOTS = [
    { code: "U9", cat: "ugalz", aimag: "Баян-Өлгий", reserve: 22_200_000, status: "live" as const, starts: -10 * MIN, ends: 30 * MIN },
    { code: "T101", cat: "tekh", aimag: "Ховд", reserve: 5_300_000, status: "live" as const, starts: -5 * MIN, ends: 45 * MIN },
    { code: "U12", cat: "ugalz", aimag: "Завхан", reserve: 22_200_000, status: "scheduled" as const, starts: 1 * DAY, ends: 1 * DAY + HOUR },
    { code: "Y2", cat: "yangir", aimag: "Говь-Алтай", reserve: 2_400_000, status: "scheduled" as const, starts: 2 * DAY, ends: 2 * DAY + HOUR },
    { code: "T102", cat: "tekh", aimag: "Ховд", reserve: 5_300_000, status: "ended" as const, starts: -2 * DAY, ends: -1 * DAY },
  ];

  for (const l of SAMPLE_LOTS) {
    const categoryId = byCode.get(l.cat);
    if (!categoryId) continue;
    const cat = cats.find((c) => c.code === l.cat)!;
    const values = {
      code: l.code,
      categoryId,
      title: cat.name,
      aimag: l.aimag,
      reserve: l.reserve,
      step: Math.round(l.reserve * 0.1),
      status: l.status,
      startsAt: at(l.starts),
      endsAt: at(l.ends),
    };
    await db
      .insert(lots)
      .values(values)
      .onConflictDoUpdate({
        target: lots.code,
        // refresh the demo window + clear auction state so re-seeding gives a clean live lot
        set: {
          status: l.status,
          startsAt: at(l.starts),
          endsAt: at(l.ends),
          currentPrice: null,
          leaderUserId: null,
          winnerUserId: null,
        },
      });
  }

  console.log("Seed complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
