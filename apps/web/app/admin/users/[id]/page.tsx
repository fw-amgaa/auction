import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { db, schema } from "@auction/db";
import { formatTugrug } from "@auction/shared";

import { getUserView } from "@/lib/admin";

import { type DetailUser, UserDetailClient } from "./UserDetailClient";

export const dynamic = "force-dynamic";

const LEDGER_META: Record<string, { icon: string; label: string; positive: boolean }> = {
  admin_issue: { icon: "↑", label: "Лимит олгосон", positive: true },
  admin_raise: { icon: "↑", label: "Лимит нэмэгдсэн", positive: true },
  admin_lower: { icon: "↓", label: "Лимит хорогдсон", positive: false },
  hold: { icon: "🔨", label: "Барьцаа суутгасан", positive: false },
  release: { icon: "↩", label: "Барьцаа буцаагдсан", positive: true },
  consume: { icon: "✓", label: "Ялалт — суутгасан", positive: false },
  offline_refund: { icon: "↩", label: "Офлайн буцаалт", positive: false },
};

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const view = await getUserView(id);
  if (!view) notFound();

  const raw = await db.query.users.findFirst({
    where: eq(schema.users.id, id),
    with: { individualProfile: true, legalEntityProfile: true },
  });

  const ind = raw?.individualProfile;
  const leg = raw?.legalEntityProfile;
  const editFields =
    view.accountType === "legal_entity"
      ? [
          { key: "email", label: "И-мэйл (нэвтрэх хаяг)", value: view.email, full: true },
          { key: "registeredName", label: "Байгууллагын нэр", value: leg?.registeredName ?? "", full: true },
          { key: "stateCertNumber", label: "Улсын бүртгэл", value: leg?.stateCertNumber ?? "" },
          { key: "registryNumber", label: "Регистр (ТТД)", value: leg?.registryNumber ?? "" },
          { key: "directorName", label: "Захирал", value: leg?.directorName ?? "" },
          { key: "phone", label: "Утас", value: view.phone === "—" ? "" : view.phone },
          { key: "address", label: "Хаяг", value: leg?.address ?? "", full: true },
        ]
      : [
          { key: "email", label: "И-мэйл (нэвтрэх хаяг)", value: view.email, full: true },
          { key: "surname", label: "Овог", value: ind?.surname ?? "" },
          { key: "givenName", label: "Нэр", value: ind?.givenName ?? "" },
          { key: "registryNumber", label: "Регистр", value: ind?.registryNumber ?? "" },
          { key: "phone", label: "Утас", value: view.phone === "—" ? "" : view.phone },
          { key: "address", label: "Хаяг", value: ind?.address ?? "", full: true },
        ];

  const ledger = await db
    .select()
    .from(schema.limitLedger)
    .where(eq(schema.limitLedger.userId, id))
    .orderBy(desc(schema.limitLedger.createdAt))
    .limit(6);

  const activity: DetailUser["activity"] = ledger.map((l) => {
    const m = LEDGER_META[l.type] ?? { icon: "•", label: l.type, positive: false };
    return {
      icon: m.icon,
      label: l.note ?? m.label,
      date: l.createdAt.toISOString(),
      amount: `${m.positive ? "+" : ""}${formatTugrug(l.delta)}`,
      positive: m.positive,
    };
  });

  const user: DetailUser = {
    id: view.id,
    name: view.name,
    accountType: view.accountType,
    kyc: view.kyc,
    source: view.source,
    created: view.createdAt.toISOString(),
    limit: view.limit,
    committed: view.committed,
    disabled: view.disabled,
    editFields,
    docs: view.docs,
    codes: view.codes,
    activity,
  };

  return <UserDetailClient user={user} />;
}
