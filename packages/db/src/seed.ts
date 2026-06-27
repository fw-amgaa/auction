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
import { categories, termsVersions, users } from "./schema";

const SPECIES = [
  { code: "tekh", name: "Тэх", defaultReserve: 5_300_000, sortOrder: 1 },
  { code: "chono", name: "Чоно", defaultReserve: null, sortOrder: 2 },
  { code: "yangir", name: "Янгир", defaultReserve: null, sortOrder: 3 },
  { code: "zagas", name: "Загас", defaultReserve: null, sortOrder: 4 },
  { code: "ugalz", name: "Угалз", defaultReserve: 22_200_000, sortOrder: 5 },
  { code: "gakhai", name: "Гахай", defaultReserve: null, sortOrder: 6 },
  { code: "shuvuu", name: "Шувуу", defaultReserve: null, sortOrder: 7 },
  { code: "bulga", name: "Булга", defaultReserve: null, sortOrder: 8 },
];

async function main() {
  console.log("Seeding categories…");
  for (const s of SPECIES) {
    await db.insert(categories).values(s).onConflictDoNothing();
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

  console.log("Seed complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
