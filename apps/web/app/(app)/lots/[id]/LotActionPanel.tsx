"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { formatTugrug } from "@auction/shared";

export interface PanelProps {
  lotId: string;
  species: string;
  aimag: string | null;
  status: "live" | "upcoming" | "ended";
  currentPrice: number;
  reserve: number;
  bidders: number;
  startsAt: number | null;
  endsAt: number | null;
  eligible: { loggedIn: boolean; approved: boolean; available: number };
}

function fmt(ms: number): string {
  if (ms <= 0) return "00:00";
  const s = Math.floor(ms / 1000);
  if (s < 3600) return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  if (s < 86400) return `${Math.floor(s / 3600)}ц ${Math.floor((s % 3600) / 60)}м`;
  return `${Math.floor(s / 86400)} өдөр ${Math.floor((s % 86400) / 3600)}ц`;
}

export function LotActionPanel(p: PanelProps) {
  const [now, setNow] = useState<number | null>(null);
  const [watched, setWatched] = useState(false);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const live = p.status === "live";
  const upcoming = p.status === "upcoming";
  const target = live ? p.endsAt : upcoming ? p.startsAt : null;
  const countdown = now !== null && target ? fmt(target - now) : "—";

  const canBid = p.eligible.loggedIn && p.eligible.approved && p.eligible.available >= p.currentPrice;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-line bg-white p-[22px] shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-ink-soft">
            {p.species} · {p.aimag ?? "—"}
          </span>
          <button
            onClick={() => setWatched((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[12px] font-semibold"
            style={
              watched
                ? { borderColor: "#EAD9A8", background: "#FBF3DF", color: "#A9760E" }
                : { borderColor: "#CDD4DE", background: "#FFF", color: "#5B6677" }
            }
          >
            {watched ? "★ Ажиглаж байна" : "☆ Ажиглах"}
          </button>
        </div>

        <div className="mt-4">
          <div className="text-[12px] font-medium text-muted">
            {live ? "Одоогийн үнэ" : "Босго үнэ"}
          </div>
          <div className="tnum mt-0.5 text-[34px] font-bold leading-none text-navy">
            {formatTugrug(live ? p.currentPrice : p.reserve)}
          </div>
          <div className="mt-1 text-[12.5px] text-ink-soft">
            Босго үнэ: <span className="tnum">{formatTugrug(p.reserve)}</span> · {p.bidders} оролцогч
          </div>
        </div>

        {target && (
          <div
            className="mt-4 flex items-center justify-between rounded-[10px] border px-3.5 py-3"
            style={live ? { background: "#FBEFEE", borderColor: "#F2D6D4" } : { background: "#F7F8FA", borderColor: "#E6E1D6" }}
          >
            <span className="flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: live ? "#A02622" : "#5B6677" }}>
              {live && <span className="size-1.5 rounded-full bg-crimson" style={{ animation: "livedot 1.4s infinite" }} />}
              {live ? "Дуусахад" : "Эхлэхэд"}
            </span>
            <span className="tnum text-lg font-bold" style={{ color: live ? "#C8312C" : "#14294A" }}>
              {countdown}
            </span>
          </div>
        )}

        {live ? (
          <Link
            href={`/lots/${p.lotId}/live`}
            className="mt-3.5 block rounded-[11px] bg-crimson py-4 text-center text-[15px] font-bold text-white hover:bg-crimson-hover"
          >
            Шууд танхимд орох →
          </Link>
        ) : (
          <div className="mt-3.5 rounded-[11px] bg-[#F3F0E9] py-4 text-center text-[14px] font-semibold text-ink-soft">
            {upcoming ? "Удахгүй эхэлнэ" : "Дууссан"}
          </div>
        )}
        {live && (
          <div className="mt-2.5 text-center text-[11.5px] text-muted">
            Танхимд орсноор санал өгөх боломжтой
          </div>
        )}
      </div>

      {/* eligibility */}
      <div
        className="rounded-[14px] border bg-white p-4"
        style={{ borderColor: canBid ? "#C7E5D5" : "#EAD9A8" }}
      >
        <div className="flex items-start gap-3">
          <span
            className="grid size-9 shrink-0 place-items-center rounded-full"
            style={canBid ? { background: "#E5F4EC", color: "#1F8A5B" } : { background: "#FBF1DF", color: "#C77A0A" }}
          >
            {canBid ? "✓" : "!"}
          </span>
          <div>
            {!p.eligible.loggedIn ? (
              <>
                <div className="text-sm font-bold text-[#C77A0A]">Нэвтэрнэ үү</div>
                <div className="mt-0.5 text-[12.5px] text-ink-soft">Санал өгөхийн тулд нэвтэрч, KYC баталгаажуулна.</div>
              </>
            ) : !p.eligible.approved ? (
              <>
                <div className="text-sm font-bold text-[#C77A0A]">KYC хүлээгдэж байна</div>
                <div className="mt-0.5 text-[12.5px] text-ink-soft">
                  Баталгаажсаны дараа санал өгөх боломжтой болно.
                </div>
              </>
            ) : (
              <>
                <div className="text-sm font-bold text-[#197a50]">Та оролцох эрхтэй</div>
                <div className="mt-0.5 text-[12.5px] text-ink-soft">
                  KYC баталгаажсан. Боломжит үлдэгдэл:{" "}
                  <strong className="tnum text-navy">{formatTugrug(p.eligible.available)}</strong>
                  {p.eligible.available < p.currentPrice && " — энэ лотод хүрэлцэхгүй байна."}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
