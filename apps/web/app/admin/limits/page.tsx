import { getLimitsPage, getLimitsTotals } from "@/lib/limits";
import { requirePageAccess } from "@/lib/session";

import { LimitsManager, type LimitRow } from "./LimitsManager";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

interface SP {
  q?: string;
  page?: string;
}

export default async function AdminLimitsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requirePageAccess("limits.adjust");
  const sp = await searchParams;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const [{ rows: users, hasNext }, totals] = await Promise.all([
    getLimitsPage({ q: sp.q, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
    getLimitsTotals(),
  ]);
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
  return <LimitsManager users={rows} totals={totals} q={sp.q ?? ""} page={page} hasNext={hasNext} />;
}
