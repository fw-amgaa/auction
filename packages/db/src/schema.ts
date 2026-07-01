/**
 * Database schema (ARCHITECTURE.md §5).
 *
 * Conventions:
 *  - All money columns are bigint whole tögrög (mode: "number"; safe < 2^53).
 *  - `bids` and `limit_ledger` are APPEND-ONLY (never UPDATE/DELETE rows that
 *    represent history; status transitions on bids are the one exception).
 *  - Column names are snake_case in the DB (see drizzle casing config).
 */

import { relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/* --------------------------------- enums ---------------------------------- */

export const accountType = pgEnum("account_type", ["individual", "legal_entity"]);
export const userRole = pgEnum("user_role", ["bidder", "admin"]);
export const kycStatus = pgEnum("kyc_status", ["pending", "approved", "rejected"]);
export const userSource = pgEnum("user_source", ["self", "admin"]);
export const docReviewStatus = pgEnum("doc_review_status", ["pending", "approved", "rejected"]);
export const lotStatus = pgEnum("lot_status", [
  "draft",
  "scheduled",
  "live",
  "ended",
  "settled",
  "cancelled",
]);
export const bidStatus = pgEnum("bid_status", ["accepted", "superseded", "winning", "void"]);
export const paymentStatus = pgEnum("payment_status", ["pending", "paid", "defaulted"]);
export const ledgerType = pgEnum("ledger_type", [
  "admin_issue",
  "admin_raise",
  "admin_lower",
  "hold",
  "release",
  "consume",
  "offline_refund",
]);
export const notificationType = pgEnum("notification_type", [
  "outbid",
  "bid_placed",
  "won",
  "lost",
  "extended",
  "starting_soon",
  "ending_soon",
  "limit_issued",
  "limit_raised",
  "kyc_approved",
  "kyc_rejected",
]);

/* --------------------------- timestamps helper ---------------------------- */

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/* ---------------------------------- users --------------------------------- */

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // auth identity (password hash lives in `accounts`, provider "credential")
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    name: text("name"),
    image: text("image"),
    phone: text("phone"),
    // domain
    role: userRole("role").notNull().default("bidder"),
    accountType: accountType("account_type").notNull(),
    kyc: kycStatus("kyc").notNull().default("pending"),
    source: userSource("source").notNull().default("self"),
    createdBy: uuid("created_by"),
    // credit limit (admin-issued); committed is derived (Redis + ledger)
    limit: bigint("limit", { mode: "number" }).notNull().default(0),
    committedCache: bigint("committed_cache", { mode: "number" }).notNull().default(0),
    disabled: boolean("disabled").notNull().default(false),
    ...timestamps,
  },
  (t) => [uniqueIndex("users_email_uniq").on(t.email)],
);

export const usersRelations = relations(users, ({ one, many }) => ({
  individualProfile: one(individualProfiles),
  legalEntityProfile: one(legalEntityProfiles),
  documents: many(kycDocuments),
  codes: many(userCodes),
  permissions: many(userPermissions),
  bids: many(bids),
  ledger: many(limitLedger),
  notifications: many(notifications),
}));

/* ------------------------------- profiles --------------------------------- */

export const individualProfiles = pgTable("individual_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  surname: text("surname"), // Овог
  givenName: text("given_name"), // Нэр
  registryNumber: text("registry_number"), // регистрийн дугаар
  address: text("address"), // free-text address (design captures a single field)
  // richer docx fields, populated later by admin if needed
  citizenship: text("citizenship"),
  clanName: text("clan_name"), // ургийн овог
  fatherName: text("father_name"), // эцэг/эх-ийн нэр
  aimag: text("aimag"),
  sum: text("sum"),
  bag: text("bag"),
  street: text("street"),
  building: text("building"),
  altContact: text("alt_contact"),
  ...timestamps,
});

export const legalEntityProfiles = pgTable("legal_entity_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  registeredName: text("registered_name"), // оноосон нэр
  registryNumber: text("registry_number"), // регистрийн дугаар (ТТД)
  stateCertNumber: text("state_cert_number"), // улсын бүртгэлийн дугаар
  directorName: text("director_name"), // захирлын овог нэр
  contactPhone: text("contact_phone"),
  address: text("address"), // free-text address (design captures a single field)
  // address hierarchy (populated later by admin if needed)
  aimag: text("aimag"),
  sum: text("sum"),
  bag: text("bag"),
  street: text("street"),
  building: text("building"),
  ...timestamps,
});

/* ----------------------------- kyc documents ------------------------------ */

export const kycDocuments = pgTable(
  "kyc_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    docType: text("doc_type").notNull(), // id_card | state_cert | power_of_attorney
    s3Key: text("s3_key").notNull(),
    fileName: text("file_name"),
    review: docReviewStatus("review").notNull().default("pending"),
    reviewerId: uuid("reviewer_id").references(() => users.id),
    reason: text("reason"),
    ...timestamps,
  },
  (t) => [index("kyc_documents_user_idx").on(t.userId)],
);

/* ------------------------------- user codes ------------------------------- */
/**
 * The lot codes a bidder is eligible for. A bidder may only see/bid lots whose
 * code is in this set (per-code eligibility). Selected at registration; editable
 * by an admin. Codes are validated against @auction/shared CATEGORIES.
 */
export const userCodes = pgTable(
  "user_codes",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    code: text("code").notNull(), // U1 … U11 | T101 … T124
    ...timestamps,
  },
  (t) => [primaryKey({ columns: [t.userId, t.code] }), index("user_codes_user_idx").on(t.userId)],
);

export const userCodesRelations = relations(userCodes, ({ one }) => ({
  user: one(users, { fields: [userCodes.userId], references: [users.id] }),
}));

/* --------------------------- admin permissions ---------------------------- */
/**
 * Per-user admin permissions. There are no roles — a permission is granted
 * directly to a dashboard/staff user (role = "admin"); bidders hold none. Each
 * permission gates one admin action/section and is validated against
 * @auction/shared PERMISSIONS. Mirrors the user_codes pattern.
 */
export const userPermissions = pgTable(
  "user_permissions",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    permission: text("permission").notNull(), // e.g. "lots.create" (see @auction/shared)
    ...timestamps,
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.permission] }),
    index("user_permissions_user_idx").on(t.userId),
  ],
);

export const userPermissionsRelations = relations(userPermissions, ({ one }) => ({
  user: one(users, { fields: [userPermissions.userId], references: [users.id] }),
}));

/* ------------------------------- categories ------------------------------- */

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(), // ugalz | tekh (see @auction/shared CATEGORIES)
    name: text("name").notNull(), // Алтайн угалз, Алтайн тэх ...
    latinName: text("latin_name"), // Ovis ammon (argali)
    defaultReserve: bigint("default_reserve", { mode: "number" }),
    icon: text("icon"),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [uniqueIndex("categories_code_uniq").on(t.code)],
);

export const categoriesRelations = relations(categories, ({ many }) => ({
  lots: many(lots),
}));

/* ---------------------------------- lots ---------------------------------- */

export const lots = pgTable(
  "lots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(), // U9, Т101 ...
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id),
    title: text("title").notNull(),
    description: text("description"),
    aimag: text("aimag"), // province/region the permit applies to
    reserve: bigint("reserve", { mode: "number" }).notNull(),
    status: lotStatus("status").notNull().default("draft"),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    currentPrice: bigint("current_price", { mode: "number" }), // mirrors Redis while live
    leaderUserId: uuid("leader_user_id").references(() => users.id),
    winnerUserId: uuid("winner_user_id").references(() => users.id),
    payment: paymentStatus("payment").notNull().default("pending"),
    permitIssuedAt: timestamp("permit_issued_at", { withTimezone: true }),
    images: jsonb("images").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("lots_code_uniq").on(t.code),
    index("lots_status_ends_idx").on(t.status, t.endsAt),
    index("lots_category_idx").on(t.categoryId),
  ],
);

export const lotsRelations = relations(lots, ({ one, many }) => ({
  category: one(categories, { fields: [lots.categoryId], references: [categories.id] }),
  bids: many(bids),
}));

/* ---------------------------------- bids ---------------------------------- */
/* Append-only authoritative bid history. */

export const bids = pgTable(
  "bids",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lotId: uuid("lot_id")
      .notNull()
      .references(() => lots.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    amount: bigint("amount", { mode: "number" }).notNull(),
    seq: integer("seq").notNull(), // per-lot monotonic sequence
    status: bidStatus("status").notNull().default("accepted"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("bids_lot_seq_uniq").on(t.lotId, t.seq),
    index("bids_lot_idx").on(t.lotId),
    index("bids_user_idx").on(t.userId),
  ],
);

export const bidsRelations = relations(bids, ({ one }) => ({
  lot: one(lots, { fields: [bids.lotId], references: [lots.id] }),
  user: one(users, { fields: [bids.userId], references: [users.id] }),
}));

/* ------------------------------ limit ledger ------------------------------ */
/* Append-only money/credit log. */

export const limitLedger = pgTable(
  "limit_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: ledgerType("type").notNull(),
    delta: bigint("delta", { mode: "number" }).notNull(), // signed
    balanceAfter: bigint("balance_after", { mode: "number" }), // limit after (for admin_* types)
    committedAfter: bigint("committed_after", { mode: "number" }), // committed after (for holds)
    lotId: uuid("lot_id").references(() => lots.id),
    bidId: uuid("bid_id").references(() => bids.id),
    actorId: uuid("actor_id").references(() => users.id), // admin or null (system)
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("limit_ledger_user_idx").on(t.userId, t.createdAt)],
);

/* ------------------------------ notifications ----------------------------- */

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: notificationType("type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.readAt)],
);

/* -------------------------------- audit log ------------------------------- */

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id").references(() => users.id),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_log_actor_idx").on(t.actorId, t.createdAt)],
);

/* ------------------------------ terms / T&C ------------------------------- */

export const termsVersions = pgTable("terms_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  version: text("version").notNull(), // e.g. v2.3
  body: text("body").notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userTermsAcceptance = pgTable(
  "user_terms_acceptance",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    termsVersionId: uuid("terms_version_id")
      .notNull()
      .references(() => termsVersions.id),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.termsVersionId] })],
);

/* ------------------------------ better-auth ------------------------------- */
/* Tables owned by better-auth (drizzle adapter). Column/JS-key names MUST match
 * better-auth's field names — the adapter introspects by the table's JS keys.
 * `user` maps to the `users` table above (via modelName in lib/auth.ts). */

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  // for credential logins: accountId === userId, providerId === "credential",
  // password === the argon2 hash (see registerAction + lib/auth.ts hashers).
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  ...timestamps,
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  token: text("token").notNull().unique(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  ...timestamps,
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ...timestamps,
});

/* ------------------------- custom email-token flows ----------------------- */
/* Single-use links for admin invites + password resets (lib/auth-tokens.ts).
 * Separate from better-auth's `verification` table — keep this untouched. */

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

/* --------------------- inverse relations (declared last) ------------------ */
/* Drizzle's relational query API needs both sides of every relation. */

export const individualProfilesRelations = relations(individualProfiles, ({ one }) => ({
  user: one(users, { fields: [individualProfiles.userId], references: [users.id] }),
}));

export const legalEntityProfilesRelations = relations(legalEntityProfiles, ({ one }) => ({
  user: one(users, { fields: [legalEntityProfiles.userId], references: [users.id] }),
}));

export const kycDocumentsRelations = relations(kycDocuments, ({ one }) => ({
  user: one(users, { fields: [kycDocuments.userId], references: [users.id] }),
}));

export const limitLedgerRelations = relations(limitLedger, ({ one }) => ({
  user: one(users, { fields: [limitLedger.userId], references: [users.id] }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));
