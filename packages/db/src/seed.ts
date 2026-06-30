/**
 * Seed reference data: the two categories (Алтайн угалз, Алтайн тэх) and the
 * initial Terms version + admin user. This is a RESET seed — it removes any
 * stale lots and legacy categories and does NOT create demo lots.
 *
 * Run: pnpm --filter @auction/db seed
 */
import { randomUUID } from "node:crypto";

import { hash } from "@node-rs/argon2";
import { eq, isNotNull, notInArray, or } from "drizzle-orm";

import { ALL_PERMISSIONS, CATEGORIES, CATEGORY_CODES } from "@auction/shared";

import { db } from "./client";
import {
  accounts,
  bids,
  categories,
  limitLedger,
  lots,
  termsVersions,
  userPermissions,
  users,
} from "./schema";

const SPECIES = CATEGORY_CODES.map((code, i) => ({
  code,
  name: CATEGORIES[code].name,
  // a sensible default reserve used to prefill the lot form (admin can override)
  defaultReserve: code === "ugalz" ? 22_200_000 : 5_300_000,
  sortOrder: i + 1,
}));

async function main() {
  console.log("Resetting lots + legacy categories…");
  // FKs with no cascade reference lots/bids (limit_ledger.lot_id / .bid_id), so
  // clear the lot-scoped ledger rows and bids before lots. Limit-grant ledger
  // rows (no lot/bid) are kept so credit history survives the reset. Finally
  // prune categories that are no longer part of the two-category scheme.
  await db.delete(limitLedger).where(or(isNotNull(limitLedger.lotId), isNotNull(limitLedger.bidId)));
  await db.delete(bids);
  await db.delete(lots);
  await db.delete(categories).where(notInArray(categories.code, [...CATEGORY_CODES]));

  console.log("Seeding categories…");
  for (const s of SPECIES) {
    await db
      .insert(categories)
      .values(s)
      .onConflictDoUpdate({
        target: categories.code,
        set: { name: s.name, defaultReserve: s.defaultReserve, sortOrder: s.sortOrder },
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
    const [admin] = await db
      .insert(users)
      .values({
        email: adminEmail,
        name: "Админ",
        emailVerified: true,
        role: "admin",
        accountType: "individual",
        kyc: "approved",
        source: "admin",
      })
      .returning({ id: users.id });
    // better-auth credential account holds the password hash
    await db.insert(accounts).values({
      id: randomUUID(),
      accountId: admin!.id,
      providerId: "credential",
      userId: admin!.id,
      password: await hash(adminPassword),
    });
    console.log(`  admin created: ${adminEmail} / ${adminPassword}`);
  } else {
    console.log("  admin already exists, skipping");
  }

  // Dashboard access is gated by per-user permissions (no roles), so the admin
  // must hold every permission. Idempotent — safe to re-run.
  console.log("Granting admin permissions…");
  const [adminRow] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, adminEmail))
    .limit(1);
  if (adminRow) {
    await db
      .insert(userPermissions)
      .values(ALL_PERMISSIONS.map((permission) => ({ userId: adminRow.id, permission })))
      .onConflictDoNothing();
    console.log(`  granted ${ALL_PERMISSIONS.length} permissions to ${adminEmail}`);
  }

  console.log("Seed complete (no demo lots).");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
