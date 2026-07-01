import "server-only";

import { and, asc, count, desc, eq, ilike, inArray, ne, or } from "drizzle-orm";

import { db, schema } from "@auction/db";

import { DOC_LABELS } from "./docs";

export type KycStatus = "pending" | "approved" | "rejected";
export type AccountType = "individual" | "legal_entity";

export interface AdminUserView {
  id: string;
  accountType: AccountType;
  name: string;
  email: string;
  phone: string;
  registry: string;
  kyc: KycStatus;
  limit: number;
  committed: number;
  source: "self" | "admin";
  disabled: boolean;
  createdAt: Date;
  fields: { k: string; v: string }[];
  docs: { id: string; label: string; kind: string }[];
  codes: string[];
}

function docKind(fileName: string | null): string {
  return fileName && fileName.toLowerCase().endsWith(".pdf") ? "PDF" : "ЗУРАГ";
}

type UserRow = typeof schema.users.$inferSelect & {
  individualProfile: typeof schema.individualProfiles.$inferSelect | null;
  legalEntityProfile: typeof schema.legalEntityProfiles.$inferSelect | null;
  documents: (typeof schema.kycDocuments.$inferSelect)[];
  codes: (typeof schema.userCodes.$inferSelect)[];
};

function toView(u: UserRow): AdminUserView {
  const ind = u.individualProfile;
  const leg = u.legalEntityProfile;
  const isLegal = u.accountType === "legal_entity";

  const name = isLegal
    ? (leg?.registeredName ?? "—")
    : [ind?.surname, ind?.givenName].filter(Boolean).join(" ") || "—";
  const registry = isLegal ? (leg?.registryNumber ?? "—") : (ind?.registryNumber ?? "—");

  const fields = isLegal
    ? [
        { k: "Байгууллага", v: leg?.registeredName ?? "—" },
        { k: "Улсын бүртгэл", v: leg?.stateCertNumber ?? "—" },
        { k: "Регистр (ТТД)", v: leg?.registryNumber ?? "—" },
        { k: "Захирал", v: leg?.directorName ?? "—" },
        { k: "Утас", v: u.phone ?? leg?.contactPhone ?? "—" },
        { k: "И-мэйл", v: u.email },
        { k: "Хаяг", v: leg?.address ?? "—" },
      ]
    : [
        { k: "Овог", v: ind?.surname ?? "—" },
        { k: "Нэр", v: ind?.givenName ?? "—" },
        { k: "Регистр", v: ind?.registryNumber ?? "—" },
        { k: "Утас", v: u.phone ?? "—" },
        { k: "И-мэйл", v: u.email },
        { k: "Хаяг", v: ind?.address ?? "—" },
      ];

  return {
    id: u.id,
    accountType: u.accountType,
    name,
    email: u.email,
    phone: u.phone ?? "—",
    registry,
    kyc: u.kyc,
    limit: u.limit,
    committed: u.committedCache,
    source: u.source,
    disabled: u.disabled,
    createdAt: u.createdAt,
    fields,
    docs: u.documents.map((d) => ({
      id: d.id,
      label: DOC_LABELS[d.docType] ?? d.docType,
      kind: docKind(d.fileName),
    })),
    codes: u.codes.map((c) => c.code),
  };
}

export type ApplicantsSort = "created" | "limitDesc" | "limitAsc";

const APPLICANTS_SORTS = {
  created: desc(schema.users.createdAt),
  limitDesc: desc(schema.users.limit),
  limitAsc: asc(schema.users.limit),
} as const;

const APPLICANTS_SORT_COLUMNS = {
  created: schema.users.createdAt,
  limitDesc: schema.users.limit,
  limitAsc: schema.users.limit,
} as const;

export interface ApplicantsFilter {
  kyc?: KycStatus;
  type?: AccountType;
  /** Matched against name, registry number, email, phone (server-side, case-insensitive). */
  q?: string;
  sort?: ApplicantsSort;
}

/**
 * Page of applicants for the KYC queue / users list — both were previously backed by
 * an unbounded `findMany()` that shipped every non-admin user (with all profile/doc/
 * code relations) to the browser on every request. Filters/sort now run in SQL and
 * only the requested page's full relations are ever fetched.
 */
export async function getApplicantsPage(
  filter: ApplicantsFilter & { limit: number; offset: number },
): Promise<{ rows: AdminUserView[]; hasNext: boolean }> {
  const conds = [ne(schema.users.role, "admin")];
  if (filter.kyc) conds.push(eq(schema.users.kyc, filter.kyc));
  if (filter.type) conds.push(eq(schema.users.accountType, filter.type));
  if (filter.q?.trim()) {
    const q = `%${filter.q.trim()}%`;
    conds.push(
      or(
        ilike(schema.users.email, q),
        ilike(schema.users.phone, q),
        ilike(schema.individualProfiles.surname, q),
        ilike(schema.individualProfiles.givenName, q),
        ilike(schema.individualProfiles.registryNumber, q),
        ilike(schema.legalEntityProfiles.registeredName, q),
        ilike(schema.legalEntityProfiles.registryNumber, q),
      )!,
    );
  }

  // Resolve the page of ids (with sort/filter incl. joined profile fields for `q`)
  // first, then fetch full relations only for those ids — the relational query API
  // can't filter/sort on joined tables directly.
  const sort = filter.sort ?? "created";
  const idRows = await db
    .selectDistinct({ id: schema.users.id, sort: APPLICANTS_SORT_COLUMNS[sort] })
    .from(schema.users)
    .leftJoin(schema.individualProfiles, eq(schema.individualProfiles.userId, schema.users.id))
    .leftJoin(schema.legalEntityProfiles, eq(schema.legalEntityProfiles.userId, schema.users.id))
    .where(and(...conds))
    .orderBy(APPLICANTS_SORTS[sort])
    .limit(filter.limit + 1)
    .offset(filter.offset);

  const hasNext = idRows.length > filter.limit;
  const ids = idRows.slice(0, filter.limit).map((r) => r.id);
  if (ids.length === 0) return { rows: [], hasNext: false };

  const rows = await db.query.users.findMany({
    where: inArray(schema.users.id, ids),
    with: { individualProfile: true, legalEntityProfile: true, documents: true, codes: true },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const ordered = ids.map((id) => byId.get(id)).filter((r): r is UserRow => !!r);
  return { rows: ordered.map(toView), hasNext };
}

/** Per-status counts for the KYC tab labels (pending/approved/rejected), independent of pagination. */
export async function getApplicantCounts(): Promise<Record<KycStatus, number>> {
  const rows = await db
    .select({ kyc: schema.users.kyc, n: count() })
    .from(schema.users)
    .where(ne(schema.users.role, "admin"))
    .groupBy(schema.users.kyc);
  const out: Record<KycStatus, number> = { pending: 0, approved: 0, rejected: 0 };
  for (const r of rows) out[r.kyc] = Number(r.n);
  return out;
}

export async function getUserView(id: string): Promise<AdminUserView | null> {
  const row = await db.query.users.findFirst({
    where: eq(schema.users.id, id),
    with: { individualProfile: true, legalEntityProfile: true, documents: true, codes: true },
  });
  return row ? toView(row) : null;
}
