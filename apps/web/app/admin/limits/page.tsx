import { fmtMnDate } from "@/lib/datetime";
import { getLimitsOverview } from "@/lib/limits";

import { LimitsManager, type LimitRow } from "./LimitsManager";

export const dynamic = "force-dynamic";

export default async function AdminLimitsPage() {
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
      date: fmtMnDate(h.createdAt),
    })),
  }));
  return <LimitsManager users={rows} />;
}
