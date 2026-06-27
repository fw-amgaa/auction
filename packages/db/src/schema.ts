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
    .$onUpdate(() => sql`now()`),
};

/* ---------------------------------- users --------------------------------- */

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // auth identity
    email: text("email").notNull(),
    emailVerified: timestamp("email_verified", { withTimezone: true }),
    name: text("name"),
    image: text("image"),
    passwordHash: text("password_hash"),
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
  individualProfile: one(individualProfiles, {
    fields: [users.id],
    references: [individualProfiles.userId],
  }),
  legalEntityProfile: one(legalEntityProfiles, {
    fields: [users.id],
    references: [legalEntityProfiles.userId],
  }),
  documents: many(kycDocuments),
  bids: many(bids),
  ledger: many(limitLedger),
  notifications: many(notifications),
}));

/* ------------------------------- profiles --------------------------------- */

export const individualProfiles = pgTable("individual_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  citizenship: text("citizenship"),
  clanName: text("clan_name"), // ургийн овог
  fatherName: text("father_name"), // эцэг/эх-ийн нэр
  givenName: text("given_name"),
  registryNumber: text("registry_number"), // регистрийн дугаар
  // address hierarchy
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
  registryNumber: text("registry_number"), // регистрийн дугаар
  stateCertNumber: text("state_cert_number"), // улсын бүртгэлийн гэрчилгээ
  contactPhone: text("contact_phone"),
  // address hierarchy
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

/* ------------------------------- categories ------------------------------- */

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull(), // e.g. ugalz, tekh, chono
  name: text("name").notNull(), // Угалз, Тэх ...
  defaultReserve: bigint("default_reserve", { mode: "number" }),
  icon: text("icon"),
  sortOrder: integer("sort_order").notNull().default(0),
  ...timestamps,
});

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
    reserve: bigint("reserve", { mode: "number" }).notNull(),
    step: bigint("step", { mode: "number" }).notNull(), // denormalized = 10% reserve
    status: lotStatus("status").notNull().default("draft"),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    currentPrice: bigint("current_price", { mode: "number" }), // mirrors Redis while live
    leaderUserId: uuid("leader_user_id").references(() => users.id),
    winnerUserId: uuid("winner_user_id").references(() => users.id),
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

/* ----------------------------- Auth.js tables ----------------------------- */
/* Database sessions + OAuth/verification scaffolding for Auth.js v5. */

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);
