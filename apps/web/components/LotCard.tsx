"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { formatTugrug } from "@auction/shared";

export interface LotCardData {
  id: string;
  code: string;
  categoryCode: string;
  species: string;
  latin: string | null;
  aimag: string | null;
  reserve: number;
  currentPrice: number | null;
  status: "live" | "upcoming" | "ended";
  startsAt: number | null;
  endsAt: number | null;
  image: string | null;
  /** Ended lots only: "Та" / "Оролцогч #N" / null (no winner). */
  winnerLabel: string | null;
  /** Ended lots only: the viewer is the winner. */
  iWon: boolean;
}

const STRIPES: Record<string, [string, string]> = {
  ugalz: ["#2C4A6B", "#26405F"],
  tekh: ["#274463", "#1F3A56"],
};

function fmtDuration(ms: number): string {
  if (ms <= 0) return "—";
  const s = Math.floor(ms / 1000);
  if (s < 3600) return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  if (s < 86400) return `${Math.floor(s / 3600)}ц ${Math.floor((s % 3600) / 60)}м`;
  return `${Math.floor(s / 86400)} өдөр ${Math.floor((s % 86400) / 3600)}ц`;
}

export function LotCard({ lot }: { lot: LotCardData }) {
  const [now, setNow] = useState<number | null>(null);
  const [watched, setWatched] = useState(false);

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const [stripeA, stripeB] = STRIPES[lot.categoryCode] ?? ["#26405F", "#1F3753"];
  const live = lot.status === "live";
  const upcoming = lot.status === "upcoming";

  const statusLabel = live ? "ШУУД" : upcoming ? "УДАХГҮЙ" : "ДУУССАН";
  const statusBg = live ? "#C8312C" : upcoming ? "rgba(20,41,74,.85)" : "rgba(90,102,119,.9)";

  const priceLabel = live ? "Одоогийн үнэ" : upcoming ? "Босго үнэ" : "Эцсийн үнэ";
  const priceVal = live ? (lot.currentPrice ?? lot.reserve) : lot.reserve;

  // countdown (null until mounted to avoid hydration mismatch)
  let cdLabel = "Төлөв";
  let cdText = "—";
  let cdColor = "#5B6677";
  if (now !== null) {
    if (live && lot.endsAt) {
      cdLabel = "Дуусахад";
      const r = lot.endsAt - now;
      cdText = fmtDuration(r);
      cdColor = r < 300000 ? "#C8312C" : "#14294A";
    } else if (upcoming && lot.startsAt) {
      cdLabel = "Эхлэхэд";
      cdText = fmtDuration(lot.startsAt - now);
    } else {
      cdLabel = "Төлөв";
      cdText = "Дууссан";
      cdColor = "#8A93A3";
    }
  }

  const cta = live
    ? { text: "Танхимд орох", href: `/lots/${lot.id}/live`, bg: "#C8312C", fg: "#fff", bd: "#C8312C" }
    : upcoming
      ? { text: "Дэлгэрэнгүй", href: `/lots/${lot.id}`, bg: "#fff", fg: "#14294A", bd: "#CDD4DE" }
      : { text: "Үр дүн харах", href: `/lots/${lot.id}`, bg: "#F3F0E9", fg: "#5B6677", bd: "#E6E1D6" };

  // Ended-lot outcome band (won / who won anonymously / no winner).
  const ended = lot.status === "ended";
  const result = !ended
    ? null
    : lot.iWon
      ? { text: "Та хожлоо", icon: "🏆", bg: "#FBF3DF", bd: "#EAD9A8", fg: "#A9760E" }
      : lot.winnerLabel
        ? { text: `${lot.winnerLabel} хожлоо`, icon: "🔨", bg: "#F4F6F9", bd: "#E2E7EE", fg: "#14294A" }
        : { text: "Дуусгавар болсон", icon: "—", bg: "#F5F2EB", bd: "#E6E1D6", fg: "#8A93A3" };

  return (
    <div
      className="flex flex-col overflow-hidden rounded-[14px] border border-line bg-white shadow-sm"
      style={
        live
          ? { animation: "cardLiveRing 2s ease-in-out infinite" }
          : lot.iWon
            ? { borderColor: "#EAD9A8", boxShadow: "0 1px 3px rgba(20,41,74,.08), 0 0 0 1px rgba(231,178,75,.45)" }
            : undefined
      }
    >
      <div
        className="relative flex h-[168px] items-end bg-cover bg-center p-3.5"
        style={
          lot.image
            ? { backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,.55)), url(/api/media?key=${encodeURIComponent(lot.image)})` }
            : { backgroundImage: `repeating-linear-gradient(135deg, ${stripeA} 0 12px, ${stripeB} 12px 24px)` }
        }
      >
        <span className="tnum absolute left-3 top-3 rounded-md bg-white/90 px-2.5 py-1 text-[12px] font-semibold text-navy">
          {lot.species}:{lot.code}
        </span>
        <div className="absolute right-3 top-3 flex items-center gap-2">
          <span
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-bold tracking-wide text-white"
            style={{ background: statusBg }}
          >
            {live && <span className="size-1.5 rounded-full bg-white" style={{ animation: "livedot 1.4s infinite" }} />}
            {statusLabel}
          </span>
          <button
            onClick={() => setWatched((v) => !v)}
            title="Ажиглах"
            className="grid size-[30px] place-items-center rounded-lg bg-white/90 text-base"
          >
            <span style={{ color: watched ? "#E0A11E" : "#8A93A3" }}>{watched ? "★" : "☆"}</span>
          </button>
        </div>
        <div className="relative text-white">
          <div className="text-[17px] font-bold drop-shadow">{lot.species}</div>
          {lot.latin && <div className="text-[11.5px] italic opacity-90 drop-shadow">{lot.latin}</div>}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-center gap-1.5 text-[12.5px] text-ink-soft">📍 {lot.aimag ?? "—"}</div>
        <div className="flex items-end justify-between gap-2.5">
          <div>
            <div className="text-[11px] font-medium text-muted">{priceLabel}</div>
            <div className="tnum mt-px text-xl font-bold text-navy">{formatTugrug(priceVal)}</div>
          </div>
          {!ended && (
            <div className="text-right">
              <div className="text-[11px] font-medium text-muted">{cdLabel}</div>
              <div className="tnum mt-0.5 text-sm font-semibold" style={{ color: cdColor }}>
                {cdText}
              </div>
            </div>
          )}
        </div>
        {result && (
          <div
            className="flex items-center gap-2 rounded-[9px] border px-3 py-2 text-[12.5px] font-semibold"
            style={{ background: result.bg, borderColor: result.bd, color: result.fg }}
          >
            <span className="text-[13px] leading-none">{result.icon}</span>
            <span className="truncate">{result.text}</span>
          </div>
        )}
        <Link
          href={cta.href}
          className="mt-auto rounded-[9px] border py-2.5 text-center text-[13.5px] font-semibold"
          style={{ background: cta.bg, color: cta.fg, borderColor: cta.bd }}
        >
          {cta.text}
        </Link>
      </div>
    </div>
  );
}
