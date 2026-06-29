import Link from "next/link";
import { notFound } from "next/navigation";

import { formatTugrug, incrementsForCode } from "@auction/shared";

import { LocalTime } from "@/components/LocalTime";
import { getUserCodes } from "@/lib/eligibility";
import { getLotDetail } from "@/lib/lots";
import { getCurrentUser } from "@/lib/session";

import { LotActionPanel } from "./LotActionPanel";

export const dynamic = "force-dynamic";

const STRIPE: Record<string, [string, string]> = {
  ugalz: ["#2C4A6B", "#26405F"],
  tekh: ["#274463", "#1F3A56"],
};

export default async function LotDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const lot = await getLotDetail(id, user?.id);
  if (!lot) notFound();

  // Per-code eligibility: a logged-in bidder may only see lots whose code they
  // hold. Admins (and logged-out public viewers) are not restricted here.
  if (user && user.role !== "admin") {
    const codes = await getUserCodes(user.id);
    if (!codes.includes(lot.code)) notFound();
  }

  const [sa, sb] = STRIPE[lot.categoryCode] ?? ["#2C4A6B", "#26405F"];
  const base = lot.currentPrice ?? lot.reserve;
  const [inc1, inc2] = incrementsForCode(lot.code);
  const steps = [inc1, inc2].map((inc) => ({ inc, amount: base + inc }));

  const facts: [string, string][] = [
    ["Лотын код", `${lot.species}:${lot.code}`],
    ["Зүйл", lot.latin ?? lot.species],
    ["Аймаг / бүс", lot.aimag ?? "—"],
    ["Босго үнэ", formatTugrug(lot.reserve)],
    ["Үнийн алхам", `${formatTugrug(inc1)} / ${formatTugrug(inc2)}`],
    ["Төлөв", lot.status === "live" ? "Шууд явагдаж байна" : lot.status === "upcoming" ? "Удахгүй" : "Дууссан"],
  ];

  return (
    <main>
      <Link href="/catalog" className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-ink-soft hover:text-navy">
        ‹ Каталог руу буцах
      </Link>

      <div className="flex flex-wrap items-start gap-6">
        {/* left */}
        <div className="flex min-w-[300px] flex-1 basis-[540px] flex-col gap-[18px]">
          <div
            className="relative flex h-[360px] items-end rounded-2xl border border-line bg-cover bg-center p-6"
            style={
              lot.image
                ? { backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0) 45%, rgba(0,0,0,.6)), url(/api/media?key=${encodeURIComponent(lot.image)})` }
                : { backgroundImage: `repeating-linear-gradient(135deg, ${sa} 0 16px, ${sb} 16px 32px)` }
            }
          >
            <span className="tnum absolute left-4 top-4 rounded-lg bg-white/90 px-3 py-1.5 text-[13px] font-semibold text-navy">
              {lot.species}:{lot.code}
            </span>
            {lot.status === "live" && (
              <span className="absolute right-4 top-4 flex items-center gap-1.5 rounded-lg bg-crimson px-3 py-1.5 text-[12px] font-bold tracking-wide text-white">
                <span className="size-1.5 rounded-full bg-white" style={{ animation: "livedot 1.4s infinite" }} />
                ШУУД ЯВАГДАЖ БАЙНА
              </span>
            )}
            <div className="relative text-white">
              <div className="text-[26px] font-bold drop-shadow">{lot.title}</div>
              {lot.latin && <div className="text-sm italic opacity-90 drop-shadow">{lot.latin}</div>}
            </div>
          </div>

          {/* info */}
          <div className="rounded-[14px] border border-line bg-white p-[22px]">
            <h2 className="text-lg font-bold text-navy">Лотын мэдээлэл</h2>
            {lot.description && <p className="mt-1 mb-4 text-[13.5px] leading-relaxed text-ink-soft">{lot.description}</p>}
            <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-px overflow-hidden rounded-[10px] border border-[#EFEBE1] bg-[#EFEBE1]">
              {facts.map(([k, v]) => (
                <div key={k} className="bg-white px-4 py-3">
                  <div className="text-[11.5px] font-medium text-muted">{k}</div>
                  <div className="tnum mt-0.5 text-sm font-semibold text-navy">{v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* increment band */}
          <div className="rounded-[14px] border border-line bg-white p-[22px]">
            <h2 className="text-lg font-bold text-navy">Үнийн алхам хэрхэн ажилладаг вэ?</h2>
            <p className="mt-1 mb-4 text-[13.5px] leading-relaxed text-ink-soft">
              Энэ ангилалд санал бүр одоогийн үнэн дээр <strong className="tnum text-navy">{formatTugrug(inc1)}</strong>{" "}
              эсвэл <strong className="tnum text-navy">{formatTugrug(inc2)}</strong> нэмнэ. Өөр алхам байхгүй.
            </p>
            <div className="flex flex-wrap gap-2.5">
              {steps.map((s) => (
                <div
                  key={s.inc}
                  className="min-w-[120px] flex-1 rounded-[10px] border border-line p-3 text-center"
                  style={{ background: s.inc === inc1 ? "#FBEFEE" : "#FFF" }}
                >
                  <div className="tnum text-[11px] font-semibold text-muted">+{formatTugrug(s.inc)}</div>
                  <div className="tnum mt-1 text-[13px] font-bold text-navy">{formatTugrug(s.amount)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* history */}
          <div className="rounded-[14px] border border-line bg-white p-[22px]">
            <div className="mb-3.5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-navy">Саналын түүх</h2>
              <span className="text-[12px] text-muted">Сүүлийн {lot.history.length} санал</span>
            </div>
            {lot.history.length === 0 ? (
              <div className="text-[13px] text-muted">Одоогоор санал ирээгүй байна.</div>
            ) : (
              lot.history.map((h, i) => (
                <div key={i} className="flex items-center gap-3 border-b border-[#F0ECE2] py-2.5 last:border-0">
                  <span
                    className="grid size-[30px] place-items-center rounded-full text-[11px] font-bold"
                    style={h.mine ? { background: "#E5F4EC", color: "#1F8A5B" } : { background: "#EEF1F5", color: "#14294A" }}
                  >
                    {h.mine ? "Та" : "#"}
                  </span>
                  <div className="flex-1">
                    <div className="text-[13.5px] font-semibold" style={{ color: h.mine ? "#197a50" : "#14294A" }}>
                      {h.label}
                    </div>
                    <div className="text-[11.5px] text-muted">
                      {h.agoSec < 60 ? `${h.agoSec} сек өмнө` : `${Math.floor(h.agoSec / 60)} мин өмнө`}
                    </div>
                  </div>
                  <span className="tnum text-sm font-semibold text-navy">{formatTugrug(h.amount)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* right */}
        <div className="w-full md:sticky md:top-[88px] md:w-[360px]">
          <LotActionPanel
            lotId={lot.id}
            species={lot.species}
            aimag={lot.aimag}
            status={lot.status}
            currentPrice={lot.currentPrice ?? lot.reserve}
            reserve={lot.reserve}
            bidders={lot.bidders}
            startsAt={lot.startsAt}
            endsAt={lot.endsAt}
            eligible={{
              loggedIn: !!user,
              approved: user?.kyc === "approved",
              available: user ? user.limit - user.committedCache : 0,
            }}
          />
          <div className="mt-4 rounded-[14px] border border-line bg-white p-[18px]">
            <h3 className="mb-3 text-sm font-bold text-navy">Хуваарь</h3>
            {(
              [
                ["Эхлэх", lot.startsAt, "#1F8A5B"],
                ["Дуусах (ойролцоо)", lot.endsAt, "#C8312C"],
              ] as const
            ).map(([label, time, dot]) => (
              <div key={label} className="flex items-center gap-3 py-1.5">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: dot }} />
                <span className="flex-1 text-[13px] text-ink-soft">{label}</span>
                <LocalTime value={time} mode="datetime" className="tnum text-[13px] font-semibold text-navy" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
