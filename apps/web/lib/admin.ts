import "server-only";

import { eq, ne } from "drizzle-orm";

import { db, schema } from "@auction/db";

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
}

const DOC_LABELS: Record<string, string> = {
  idFront: "Үнэмлэх (урд)",
  idBack: "Үнэмлэх (ар)",
  cert: "Улсын бүртгэлийн гэрчилгээ",
  directorId: "Захирлын үнэмлэх",
  poa: "Нотариатын итгэмжлэл",
};

function docKind(fileName: string | null): string {
  return fileName && fileName.toLowerCase().endsWith(".pdf") ? "PDF" : "ЗУРАГ";
}

type UserRow = typeof schema.users.$inferSelect & {
  individualProfile: typeof schema.individualProfiles.$inferSelect | null;
  legalEntityProfile: typeof schema.legalEntityProfiles.$inferSelect | null;
  documents: (typeof schema.kycDocuments.$inferSelect)[];
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
  };
}

export async function getApplicants(): Promise<AdminUserView[]> {
  const rows = await db.query.users.findMany({
    where: ne(schema.users.role, "admin"),
    with: { individualProfile: true, legalEntityProfile: true, documents: true },
    orderBy: (u, { desc }) => [desc(u.createdAt)],
  });
  return rows.map(toView);
}

export async function getUserView(id: string): Promise<AdminUserView | null> {
  const row = await db.query.users.findFirst({
    where: eq(schema.users.id, id),
    with: { individualProfile: true, legalEntityProfile: true, documents: true },
  });
  return row ? toView(row) : null;
}
