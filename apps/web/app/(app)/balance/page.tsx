import { formatTugrug } from "@auction/shared";

import { fmtMnDateTime } from "@/lib/datetime";
import { getUserLedger } from "@/lib/limits";
import { requireUser } from "@/lib/session";

import { BalanceLedger, type LedgerRow } from "./BalanceLedger";

export const dynamic = "force-dynamic";

const EXPLAINER = [
  { icon: "🔒", bg: "#FBF1DF", fg: "#C77A0A", title: "Санал өгөхөд барьцаална", body: "Санал өгмөгц тухайн дүн боломжит үлдэгдлээс түр хасагдаж барьцаанд орно." },
  { icon: "↩", bg: "#E5F4EC", fg: "#1F8A5B", title: "Саналыг давбал буцаана", body: "Өөр оролцогч таныг давсан тэр даруйд барьцаалсан мөнгө бүрэн буцаж ирнэ." },
  { icon: "✓", bg: "#EEF1F5", fg: "#14294A", title: "Хожвол зарцуулагдана", body: "Та лотыг хожвол барьцаалсан дүн худалдан авалтад зарцуулагдана." },
];

export default async function BalancePage() {
  const user = await requireUser();
  const ledger = await getUserLedger(user.id);
  const limit = user.limit;
  const committed = user.committedCache;
  const available = limit - committed;
  const usagePct = limit > 0 ? Math.round((committed / limit) * 100) : 0;

  const rows: LedgerRow[] = ledger.map((l) => ({
    id: l.id,
    type: l.type,
    delta: l.delta,
    note: l.note,
    date: fmtMnDateTime(l.createdAt),
  }));

  return (
    <main>
      <h1 className="text-[28px] font-bold text-navy">Үлдэгдэл</h1>
      <p className="mt-1.5 text-sm text-ink-soft">
        Таны бэлэн мөнгөгүйгээр санал өгөх лимит. Захиргаанаас олгосон лимитийн хүрээнд барьцаа
        байршуулж оролцоно.
      </p>

      <div className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
        <div className="rounded-2xl bg-[#0E2A1E] p-[22px] text-white">
          <div className="text-[12.5px] font-semibold text-[#8FD4AE]">Боломжит үлдэгдэл</div>
          <div className="tnum mt-2 text-[34px] font-bold leading-none">{formatTugrug(available)}</div>
          <div className="mt-1.5 text-[12px] text-[#9DB8AB]">Шинэ санал өгөхөд ашиглах боломжтой</div>
        </div>
        <div className="rounded-2xl border border-line bg-white p-[22px]">
          <div className="text-[12.5px] font-semibold text-[#C77A0A]">Барьцаанд</div>
          <div className="tnum mt-2 text-[34px] font-bold leading-none text-navy">{formatTugrug(committed)}</div>
          <div className="mt-1.5 text-[12px] text-muted">Идэвхтэй саналуудад түр барьцаалсан</div>
        </div>
        <div className="rounded-2xl border border-line bg-white p-[22px]">
          <div className="text-[12.5px] font-semibold text-ink-soft">Нийт лимит</div>
          <div className="tnum mt-2 text-[34px] font-bold leading-none text-navy">{formatTugrug(limit)}</div>
          <div className="mt-1.5 text-[12px] text-muted">Захиргаанаас олгосон дээд хязгаар</div>
        </div>
      </div>

      {/* usage bar */}
      <div className="mt-4 rounded-[14px] border border-line bg-white p-5">
        <div className="mb-2.5 flex items-center justify-between text-[12.5px]">
          <span className="text-ink-soft">Лимитийн ашиглалт</span>
          <span className="tnum font-semibold text-navy">{usagePct}% барьцаанд</span>
        </div>
        <div className="flex h-3 overflow-hidden rounded-lg bg-[#EFEBE1]">
          <div className="h-full bg-[#C77A0A]" style={{ width: `${usagePct}%` }} />
          <div className="h-full flex-1 bg-success" />
        </div>
      </div>

      {/* explainer */}
      <div className="mt-4 rounded-[14px] border border-[#EAE0C9] bg-[#FBF7EE] p-[22px]">
        <h2 className="mb-3.5 text-base font-bold text-navy">Барьцаа хэрхэн ажилладаг вэ?</h2>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3.5">
          {EXPLAINER.map((e) => (
            <div key={e.title} className="flex items-start gap-3">
              <span className="grid size-[34px] shrink-0 place-items-center rounded-[9px] text-[17px] font-bold" style={{ background: e.bg, color: e.fg }}>
                {e.icon}
              </span>
              <div>
                <div className="text-[13.5px] font-bold text-navy">{e.title}</div>
                <div className="mt-0.5 text-[12.5px] leading-relaxed text-ink-soft">{e.body}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <BalanceLedger entries={rows} />
    </main>
  );
}
