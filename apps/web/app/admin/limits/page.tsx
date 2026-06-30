import { getLimitsOverview } from "@/lib/limits";
import { requirePageAccess } from "@/lib/session";

import { LimitsManager, type LimitRow } from "./LimitsManager";

export const dynamic = "force-dynamic";

export default async function AdminLimitsPage() {
  await requirePageAccess("limits.adjust");
  const users = await getLimitsOverview();
  const rows: LimitRow[] = users.map((u) => ({
    id: u.id,
    accountType: u.accountType,
    name: u.name,
    limit: u.limit,
    committed: u.committed,
    available: u.available,
    history: u.history.map((h) => ({
      id: h.id,
      type: h.type,
      delta: h.delta,
      note: h.note,
      date: h.createdAt.toISOString(),
    })),
  }));
  return <LimitsManager users={rows} />;
}
