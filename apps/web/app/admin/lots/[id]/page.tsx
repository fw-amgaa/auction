import Link from "next/link";
import { notFound } from "next/navigation";

import { formatTugrug } from "@auction/shared";

import { AdminTopbar } from "@/components/AdminTopbar";
import { LocalTime } from "@/components/LocalTime";
import { getAdminLotDetail } from "@/lib/lots";
import { requireAdmin } from "@/lib/session";
import { mintTicket, wsUrl } from "@/lib/ws-ticket";

import { AdminLotMonitor } from "./AdminLotMonitor";

export const dynamic = "force-dynamic";

const PHASE: Record<string, { label: string; bg: string; fg: string }> = {
  draft: { label: "Ноорог", bg: "#EEF1F5", fg: "#5B6677" },
  upcoming: { label: "Удахгүй", bg: "#E7F0FB", fg: "#1B5FA8" },
  live: { label: "ШУУД ЯВАГДАЖ БАЙНА", bg: "#FBEAE9", fg: "#C8312C" },
  ended: { label: "Дууссан", bg: "#EEF1F5", fg: "#5B6677" },
  cancelled: { label: "Цуцалсан", bg: "#F3F0E9", fg: "#8A93A3" },
  settled: { label: "Төлбөр хийгдсэн", bg: "#E5F4EC", fg: "#1F8A5B" },
};

const PAYMENT: Record<string, { label: string; bg: string; fg: string }> = {
  pending: { label: "Төлбөр хүлээгдэж буй", bg: "#FBF1DF", fg: "#C77A0A" },
  paid: { label: "Төлбөр төлсөн", bg: "#E5F4EC", fg: "#1F8A5B" },
  defaulted: { label: "Төлбөр төлөгдөөгүй", bg: "#FBEAE9", fg: "#C8312C" },
};

export default async function AdminLotDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = await requireAdmin();
  const lot = await getAdminLotDetail(id);
  if (!lot) notFound();

  const live = lot.phase === "live";
  const ended = lot.phase === "ended" || lot.phase === "settled";
  const ph = PHASE[lot.phase] ?? PHASE.ended!;
  const ticket = live ? mintTicket({ uid: admin.id, role: admin.role, kyc: admin.kyc, limit: admin.limit }) : null;

  const kpis: [string, string][] = [
    [live ? "Одоогийн үнэ" : "Эцсийн үнэ", formatTugrug(lot.finalPrice)],
    ["Босго үнэ", formatTugrug(lot.reserve)],
    ["Оролцогч", String(lot.bidders)],
    ["Үнийн алхам", `${formatTugrug(lot.inc1)} / ${formatTugrug(lot.inc2)}`],
  ];

  return (
    <div>
      <AdminTopbar title={`${lot.species} · ${lot.code}`}>
        <Link
          href="/admin/lots"
          className="rounded-[9px] border border-line-cool bg-white px-4 py-2.5 text-[13.5px] font-bold text-navy hover:bg-[#F3F5F8]"
        >
          ← Лот удирдлага
        </Link>
      </AdminTopbar>

      <div className="space-y-5 p-6">
        {/* header */}
        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-line-cool bg-white p-4">
          {lot.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/media?key=${encodeURIComponent(lot.image)}`}
              alt=""
              className="size-16 shrink-0 rounded-xl object-cover"
            />
          ) : (
            <span
              className="size-16 shrink-0 rounded-xl"
              style={{ backgroundImage: "repeating-linear-gradient(135deg,#26405F 0 8px,#1F3753 8px 16px)" }}
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5">
              <span className="tnum text-[15px] font-bold text-navy">{lot.code}</span>
              <span className="rounded-md px-2 py-0.5 text-[11px] font-bold" style={{ background: ph.bg, color: ph.fg }}>
                {ph.label}
              </span>
            </div>
            <div className="mt-0.5 text-[14px] font-semibold text-navy">{lot.title || lot.species}</div>
            <div className="text-[12.5px] text-muted">
              {lot.species}
              {lot.latin && <span className="italic"> · {lot.latin}</span>} · 📍 {lot.aimag ?? "—"}
            </div>
          </div>
          {ended && (
            <div
              className="rounded-xl border px-4 py-2.5 text-right"
              style={lot.winnerName ? { background: "#FBF3DF", borderColor: "#EAD9A8" } : { background: "#F5F2EB", borderColor: "#E6E1D6" }}
            >
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Ялагч</div>
              <div className="text-[14px] font-bold" style={{ color: lot.winnerName ? "#A9760E" : "#8A93A3" }}>
                {lot.winnerName ? `🏆 ${lot.winnerName}` : "Ялагчгүй"}
              </div>
            </div>
          )}
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line-cool bg-[#EBEEF3] sm:grid-cols-4">
          {kpis.map(([k, v]) => (
            <div key={k} className="bg-white px-5 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">{k}</div>
              <div className="tnum mt-1 text-[18px] font-bold text-navy">{v}</div>
            </div>
          ))}
        </div>

        {/* live monitor (real-time) — only while live */}
        {live && ticket && (
          <AdminLotMonitor
            lotId={lot.id}
            ticket={ticket}
            wsBase={wsUrl()}
            initialPrice={lot.currentPrice ?? lot.reserve}
            initialEndsAt={lot.endsAt?.getTime() ?? Date.now()}
          />
        )}

        {/* full bid history with REAL names */}
        <div className="overflow-hidden rounded-2xl border border-line-cool bg-white">
          <div className="flex items-center justify-between border-b border-[#EBEEF3] px-5 py-3.5">
            <h2 className="text-sm font-bold text-navy">
              Саналын бүрэн түүх — бодит нэр
              {live && <span className="ml-2 font-normal text-muted">(агшны зураг)</span>}
            </h2>
            <span className="text-[12px] text-muted">{lot.history.length} санал</span>
          </div>
          {lot.history.length === 0 ? (
            <div className="px-5 py-10 text-center text-[13px] text-muted">Одоогоор санал ирээгүй байна.</div>
          ) : (
            <div className="max-h-[460px] overflow-y-auto">
              {lot.history.map((b) => (
                <div
                  key={b.seq}
                  className="grid grid-cols-[44px_1fr_auto] items-center gap-3 border-b border-[#F1F3F6] px-5 py-2.5 last:border-0"
                >
                  <span className="tnum grid size-7 place-items-center rounded-full bg-[#EEF1F5] text-[10.5px] font-bold text-navy">
                    #{b.seq}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold text-navy">{b.name}</div>
                    <div className="text-[11px] text-muted">
                      {b.agoSec < 60 ? `${b.agoSec} сек өмнө` : `${Math.floor(b.agoSec / 60)} мин өмнө`}
                    </div>
                  </div>
                  <span className="tnum text-[13px] font-semibold text-navy">{formatTugrug(b.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* schedule + payment */}
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-line-cool bg-white p-5">
            <h3 className="mb-3 text-sm font-bold text-navy">Хуваарь</h3>
            {(
              [
                ["Эхлэх", lot.startsAt],
                ["Дуусах", lot.endsAt],
              ] as const
            ).map(([label, time]) => (
              <div key={label} className="flex items-center justify-between py-1.5 text-[13px]">
                <span className="text-ink-soft">{label}</span>
                <LocalTime
                  value={time ? time.toISOString() : null}
                  mode="datetime"
                  className="tnum font-semibold text-navy"
                />
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-line-cool bg-white p-5">
            <h3 className="mb-3 text-sm font-bold text-navy">Төлбөрийн төлөв</h3>
            <span
              className="inline-block rounded-md px-3 py-1.5 text-[12.5px] font-bold"
              style={{
                background: (PAYMENT[lot.payment] ?? PAYMENT.pending!).bg,
                color: (PAYMENT[lot.payment] ?? PAYMENT.pending!).fg,
              }}
            >
              {(PAYMENT[lot.payment] ?? PAYMENT.pending!).label}
            </span>
            {lot.description && <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">{lot.description}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
