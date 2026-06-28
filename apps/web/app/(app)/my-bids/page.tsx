import Link from "next/link";

import { formatTugrug } from "@auction/shared";

import { getMyBids, type MyBidRow } from "@/lib/mybids";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const TABS: [string, string][] = [
  ["active", "Идэвхтэй"],
  ["won", "Хожсон"],
  ["lost", "Хожигдсон"],
];

function Row({ r, tab }: { r: MyBidRow; tab: string }) {
  return (
    <Link
      href={tab === "active" ? `/lots/${r.lotId}/live` : `/lots/${r.lotId}`}
      className="flex items-center justify-between gap-4 border-b border-line px-5 py-4 last:border-0 hover:bg-sand"
    >
      <div>
        <div className="font-semibold text-navy">
          {r.species}:{r.code}
        </div>
        <div className="text-[12px] text-muted">
          Миний санал: <span className="tnum">{formatTugrug(r.myAmount)}</span>
        </div>
      </div>
      <div className="text-right">
        <div className="tnum font-semibold text-navy">{formatTugrug(r.price)}</div>
        <div className="text-[12px]" style={{ color: tab === "won" ? "#1F8A5B" : tab === "active" ? "#C8312C" : "#8A93A3" }}>
          {tab === "active" ? "Шууд" : tab === "won" ? "Та хожсон" : "Дууссан"}
        </div>
      </div>
    </Link>
  );
}

export default async function MyBidsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const tab = sp.tab ?? "active";
  const { active, won, lost } = await getMyBids(user.id);
  const counts: Record<string, number> = { active: active.length, won: won.length, lost: lost.length };
  const rows = tab === "won" ? won : tab === "lost" ? lost : active;

  return (
    <main>
      <h1 className="text-2xl font-bold text-navy">Миний санал</h1>
      <div className="mt-5 flex gap-2">
        {TABS.map(([k, label]) => {
          const on = k === tab;
          return (
            <Link
              key={k}
              href={`/my-bids?tab=${k}`}
              className="rounded-lg border px-4 py-2 text-sm"
              style={{
                background: on ? "#14294A" : "#FFF",
                color: on ? "#FFF" : "#5B6677",
                borderColor: on ? "#14294A" : "#E6E1D6",
                fontWeight: on ? 700 : 500,
              }}
            >
              {label} ({counts[k] ?? 0})
            </Link>
          );
        })}
      </div>

      <div className="mt-4 overflow-hidden rounded-card border border-line bg-card">
        {rows.map((r) => (
          <Row key={r.lotId} r={r} tab={tab} />
        ))}
        {rows.length === 0 && (
          <div className="px-5 py-12 text-center text-sm text-muted">Энд харуулах санал алга байна.</div>
        )}
      </div>
    </main>
  );
}
