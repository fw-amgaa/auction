import { eq } from "drizzle-orm";

import { db, schema } from "@auction/db";

import { requireUser } from "@/lib/session";

import { type ProfileData, ProfileView } from "./ProfileView";

export const dynamic = "force-dynamic";

const DOC_LABELS: Record<string, string> = {
  idFront: "Иргэний үнэмлэх (урд)",
  idBack: "Иргэний үнэмлэх (ар)",
  cert: "Улсын бүртгэлийн гэрчилгээ",
  directorId: "Захирлын үнэмлэх",
  poa: "Нотариатын итгэмжлэл",
};

export default async function ProfilePage() {
  const sessionUser = await requireUser();
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, sessionUser.id),
    with: { individualProfile: true, legalEntityProfile: true, documents: true },
  });
  if (!user) return null;

  const isLegal = user.accountType === "legal_entity";
  const ind = user.individualProfile;
  const leg = user.legalEntityProfile;

  const name = isLegal
    ? (leg?.registeredName ?? user.email)
    : [ind?.surname, ind?.givenName].filter(Boolean).join(" ") || user.email;

  const lockedFields = isLegal
    ? [
        { label: "Байгууллага", value: leg?.registeredName ?? "—" },
        { label: "Улсын бүртгэл", value: leg?.stateCertNumber ?? "—" },
        { label: "Регистр (ТТД)", value: leg?.registryNumber ?? "—" },
        { label: "И-мэйл", value: user.email },
      ]
    : [
        { label: "Овог", value: ind?.surname ?? "—" },
        { label: "Нэр", value: ind?.givenName ?? "—" },
        { label: "Регистр", value: ind?.registryNumber ?? "—" },
        { label: "И-мэйл", value: user.email },
      ];

  const data: ProfileData = {
    name,
    typeLabel: isLegal ? "Хуулийн этгээд" : "Иргэн",
    memberSince: user.createdAt.toISOString(),
    kyc: user.kyc,
    lockedFields,
    phone: user.phone ?? "",
    address: (isLegal ? leg?.address : ind?.address) ?? "",
    docs: user.documents.map((d) => ({
      id: d.id,
      label: DOC_LABELS[d.docType] ?? d.docType,
      kind: d.fileName?.toLowerCase().endsWith(".pdf") ? "PDF" : "ЗУРАГ",
    })),
    available: user.limit - user.committedCache,
    committed: user.committedCache,
    limit: user.limit,
  };

  return <ProfileView data={data} />;
}
