/**
 * KYC document definitions — the files a bidder must provide when registering
 * (and that an admin uploads when creating a bidder account).
 *
 * Pure data, no server deps — imported by both client forms and server actions.
 */

export type AccountType = "individual" | "legal_entity";

export interface DocDef {
  key: string;
  label: string;
}

/** Required for every applicant, regardless of account type. */
export const COMMON_DOCS: DocDef[] = [
  { key: "applicationForm", label: "Оролцох хүсэлтийн маягт" },
  {
    key: "participationRequest",
    label: "Оролцох хүсэлт (ААНБ албан бичиг / иргэн өргөдөл)",
  },
  { key: "depositReceipt", label: "Дэнчин төлсөн баримтын хуулбар" },
];

/** Full, ordered doc list per account type. */
export const ACCOUNT_DOCS: Record<AccountType, DocDef[]> = {
  individual: [
    ...COMMON_DOCS,
    { key: "idCopy", label: "Иргэний үнэмлэхийн хуулбар" },
  ],
  legal_entity: [
    ...COMMON_DOCS,
    { key: "stateCertCopy", label: "Улсын бүртгэлийн гэрчилгээний хуулбар" },
    { key: "powerOfAttorney", label: "Нотариатаар баталгаажуулсан итгэмжлэл" },
  ],
};

/** The doc-type keys required for an account type. */
export function docKeysFor(accountType: string): string[] {
  return (ACCOUNT_DOCS[accountType as AccountType] ?? []).map((d) => d.key);
}

/** Friendly labels by docType — includes legacy keys so old records still read well. */
export const DOC_LABELS: Record<string, string> = {
  // current scheme
  applicationForm: "Оролцох хүсэлтийн маягт",
  participationRequest: "Оролцох хүсэлт",
  depositReceipt: "Дэнчин төлсөн баримт",
  idCopy: "Иргэний үнэмлэхийн хуулбар",
  stateCertCopy: "Улсын бүртгэлийн гэрчилгээ",
  powerOfAttorney: "Нотариатаар баталгаажуулсан итгэмжлэл",
  // legacy keys (pre-existing documents)
  idFront: "Үнэмлэх (урд)",
  idBack: "Үнэмлэх (ар)",
  cert: "Улсын бүртгэлийн гэрчилгээ",
  directorId: "Захирлын үнэмлэх",
  poa: "Нотариатын итгэмжлэл",
};
