"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  type ClientMessage,
  formatTugrug,
  liveBidAmount,
  type ServerMessage,
} from "@auction/shared";

export interface LiveRoomProps {
  lotId: string;
  code: string;
  species: string;
  latin: string | null;
  aimag: string | null;
  reserve: number;
  ticket: string;
  wsBase: string;
}

interface FeedRow {
  seq: number;
  label: string;
  amount: number;
  ts: number;
  mine: boolean;
}
interface Toast {
  id: number;
  kind: "success" | "danger" | "warn" | "info";
  text: string;
}

const REASON_TEXT: Record<string, string> = {
  closed: "Дуудлага хаагдсан",
  self: "Та аль хэдийн тэргүүлж байна",
  bad_increment: "Алхам буруу байна",
  insufficient: "Үлдэгдэл хүрэлцэхгүй",
  not_eligible: "Оролцох эрхгүй",
  rate_limited: "Хэт олон санал — түр хүлээнэ үү",
};

const TOAST_PALETTE: Record<Toast["kind"], { bg: string; border: string; color: string }> = {
  success: { bg: "#10301F", border: "rgba(43,208,122,.5)", color: "#9BEEC2" },
  danger: { bg: "#2A0E14", border: "rgba(255,90,95,.55)", color: "#FF9AA0" },
  warn: { bg: "#3A2A0A", border: "rgba(255,176,46,.5)", color: "#FFD27A" },
  info: { bg: "#142036", border: "rgba(255,255,255,.16)", color: "#C4D0E2" },
};

const SHORTCUTS: [string, string][] = [
  ["1 – 5", "+N алхмаар санал нэмэх"],
  ["Enter / Space", "Хамгийн бага санал (+1)"],
  ["Esc", "Цонх хаах"],
  ["W", "Ажиглах"],
  ["?", "Энэ товчлолын цонх"],
];

export function LiveRoom(p: LiveRoomProps) {
  const wsRef = useRef<WebSocket | null>(null);
  const [conn, setConn] = useState<"connecting" | "live" | "reconnecting">("connecting");
  const [price, setPrice] = useState(p.reserve);
  const [displayPrice, setDisplayPrice] = useState(p.reserve);
  const [step, setStep] = useState(Math.round(p.reserve * 0.1));
  const [reserve] = useState(p.reserve);
  const [hasBids, setHasBids] = useState(false);
  const [leaderLabel, setLeaderLabel] = useState<string | null>(null);
  const [youLead, setYouLead] = useState(false);
  const [everBid, setEverBid] = useState(false);
  const [endsAt, setEndsAt] = useState(Date.now() + 60_000);
  const [now, setNow] = useState(Date.now());
  const [spectators, setSpectators] = useState(0);
  const [feed, setFeed] = useState<FeedRow[]>([]);
  const [available, setAvailable] = useState(0);
  const [committed, setCommitted] = useState(0);
  const [limit, setLimit] = useState(0);
  const [ended, setEnded] = useState<{ result: "won" | "lost" | "ended"; price: number } | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [watching, setWatching] = useState(false);
  const [extendFlash, setExtendFlash] = useState(0);
  const toastId = useRef(0);
  const rafRef = useRef<number | null>(null);

  const addToast = useCallback((kind: Toast["kind"], text: string) => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600);
  }, []);

  const animatePrice = useCallback((from: number, to: number) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setDisplayPrice(to);
      return;
    }
    const start = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / 460);
      const e = 1 - Math.pow(1 - k, 3);
      setDisplayPrice(Math.round(from + (to - from) * e));
      if (k < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  // WebSocket connection (with reconnect)
  useEffect(() => {
    let closed = false;
    let retry = 0;
    let pingTimer: ReturnType<typeof setInterval> | null = null;

    const connect = () => {
      const ws = new WebSocket(`${p.wsBase}/ws?ticket=${encodeURIComponent(p.ticket)}`);
      wsRef.current = ws;

      ws.onopen = () => {
        retry = 0;
        setConn("live");
        ws.send(JSON.stringify({ t: "subscribe", lotId: p.lotId } satisfies ClientMessage));
        pingTimer = setInterval(() => {
          if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ t: "ping" } satisfies ClientMessage));
        }, 25_000);
      };

      ws.onmessage = (ev) => {
        let msg: ServerMessage;
        try {
          msg = JSON.parse(ev.data as string) as ServerMessage;
        } catch {
          return;
        }
        handle(msg);
      };

      ws.onclose = () => {
        if (pingTimer) clearInterval(pingTimer);
        if (closed) return;
        setConn("reconnecting");
        retry += 1;
        setTimeout(connect, Math.min(5000, 500 * retry));
      };
      ws.onerror = () => ws.close();
    };

    connect();
    return () => {
      closed = true;
      if (pingTimer) clearInterval(pingTimer);
      wsRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.lotId, p.ticket, p.wsBase]);

  function handle(msg: ServerMessage) {
    switch (msg.t) {
      case "snapshot":
        setPrice(msg.price);
        setDisplayPrice(msg.price);
        setStep(msg.step);
        setHasBids(msg.hasBids);
        setLeaderLabel(msg.leaderLabel);
        setYouLead(msg.youLead);
        setEndsAt(msg.endsAt);
        setSpectators(msg.spectators);
        setFeed(msg.feed);
        setAvailable(msg.available);
        setCommitted(msg.committed);
        setLimit(msg.limit);
        if (msg.status === "ended") setEnded((e) => e ?? { result: "ended", price: msg.price });
        break;
      case "bid":
        animatePrice(price, msg.price);
        setPrice(msg.price);
        setHasBids(true);
        setLeaderLabel(msg.leaderLabel);
        setYouLead(msg.youLead);
        setEndsAt(msg.endsAt);
        setFeed((f) => [msg.feedItem, ...f].slice(0, 14));
        if (msg.extended) {
          setExtendFlash((n) => n + 1);
          addToast("warn", "Хугацаа сунгагдлаа +30 сек");
        }
        break;
      case "rejected":
        addToast("danger", REASON_TEXT[msg.reason] ?? "Санал амжилтгүй");
        break;
      case "outbid":
        addToast("danger", `Таны саналыг давсан! ${formatTugrug(msg.returned)} буцаагдлаа`);
        break;
      case "balance":
        setAvailable(msg.available);
        setCommitted(msg.committed);
        setLimit(msg.limit);
        break;
      case "spectators":
        setSpectators(msg.count);
        break;
      case "closed":
        setEnded({ result: msg.result, price: msg.price });
        break;
      case "pong":
        break;
    }
  }

  // local 1s clock
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const placeBid = useCallback(
    (n: number) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== ws.OPEN || ended) return;
      if (youLead) {
        addToast("info", "Та аль хэдийн тэргүүлж байна");
        return;
      }
      const amount = liveBidAmount(price, reserve, step, hasBids, n);
      if (amount > available) {
        addToast("danger", "Үлдэгдэл хүрэлцэхгүй");
        return;
      }
      setEverBid(true);
      ws.send(JSON.stringify({ t: "bid", lotId: p.lotId, nSteps: n } satisfies ClientMessage));
    },
    [price, reserve, step, hasBids, available, youLead, ended, addToast, p.lotId],
  );

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName ?? "";
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) return;
      if (e.key === "?" || (e.key === "/" && e.shiftKey)) {
        e.preventDefault();
        setShowShortcuts((s) => !s);
        return;
      }
      if (e.key === "Escape") {
        setShowShortcuts(false);
        return;
      }
      if (showShortcuts) return;
      if (e.key >= "1" && e.key <= "5") {
        e.preventDefault();
        placeBid(Number.parseInt(e.key, 10));
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        placeBid(1);
      } else if (e.key === "w" || e.key === "W" || e.key === "ц" || e.key === "Ц") {
        setWatching((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [placeBid, showShortcuts]);

  const timeLeft = Math.max(0, Math.floor((endsAt - now) / 1000));
  const mm = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const ss = String(timeLeft % 60).padStart(2, "0");
  const timerColor = timeLeft > 30 ? "#2BD07A" : timeLeft > 10 ? "#FFB02E" : "#FF5A5F";

  // banner
  const banner = youLead
    ? { bg: "linear-gradient(135deg,#10301F,#0C2418)", border: "rgba(43,208,122,.55)", icon: "✓", iconBg: "#2BD07A", iconFg: "#06180E", title: "Та тэргүүлж байна", sub: `Таны санал хамгийн өндөр. Барьцаа: ${formatTugrug(committed)}`, titleColor: "#7BF2B5", subColor: "#A7D8BE" }
    : everBid
      ? { bg: "linear-gradient(135deg,#2A0E14,#220A10)", border: "rgba(255,90,95,.6)", icon: "⚠", iconBg: "#FF5A5F", iconFg: "#2A0708", title: "Таны саналыг давсан!", sub: "Барьцаалсан мөнгө буцаагдлаа. Дахин үнэ нэмэх үү?", titleColor: "#FF8B91", subColor: "#E0A6A9" }
      : { bg: "#0E1729", border: "rgba(255,255,255,.1)", icon: "•", iconBg: "#1C2A44", iconFg: "#8AA0C0", title: "Та оролцоонд ороогүй байна", sub: "Доорх товчоор үнэ нэмж оролцоно уу.", titleColor: "#EEF2F8", subColor: "#92A0B6" };

  const buttons = [1, 2, 3, 4, 5].map((n) => {
    const amount = liveBidAmount(price, reserve, step, hasBids, n);
    const disabled = youLead || !!ended || conn !== "live" || amount > available;
    const primary = n === 1 && !disabled;
    return { n, amount, disabled, primary };
  });

  const connColor = conn === "live" ? "#2BD07A" : "#FFB02E";
  const connText = conn === "live" ? "Шууд" : "Холбогдож байна…";

  return (
    <div
      className="-mx-5 -my-8 min-h-screen px-5 py-6 text-[#EEF2F8]"
      style={{ background: "radial-gradient(1200px 600px at 70% -10%, #122036 0%, #070B14 60%)" }}
    >
      {/* context strip */}
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="tnum text-[15px] font-semibold">{p.species}:{p.code}</span>
            <span className="text-[11px] text-[#5E6B82]">{p.latin}</span>
          </div>
          <div className="mt-0.5 text-[12px] text-[#92A0B6]">
            Босго үнэ <span className="tnum text-[#C4D0E2]">{formatTugrug(reserve)}</span> · {p.aimag}
          </div>
        </div>
        <div className="flex-1" />
        <span className="flex items-center gap-1.5 rounded-lg border border-[rgba(230,57,80,.5)] bg-[#E6395012] px-2.5 py-1.5 text-[12px] font-bold tracking-wide text-[#FF6B78]">
          <span className="size-2 rounded-full bg-[#FF5A5F]" style={{ animation: "livedot 1.4s infinite" }} /> LIVE
        </span>
        <span className="tnum text-[13px] text-[#A9B6CC]">👁 {spectators} хүн</span>
        <span className="flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: connColor }}>
          <span className="size-2 rounded-full" style={{ background: connColor, animation: "livedot 1.4s infinite" }} /> {connText}
        </span>
        <button onClick={() => setWatching((v) => !v)} className="rounded-lg border border-[rgba(255,255,255,.12)] px-3 py-2 text-[12.5px] font-semibold" style={{ color: watching ? "#7BF2B5" : "#A9B6CC" }}>
          {watching ? "★ Ажиглаж байна" : "☆ Ажиглах"}
        </button>
        <button onClick={() => setShowShortcuts(true)} className="grid size-[38px] place-items-center rounded-lg border border-[rgba(255,255,255,.12)] text-base font-bold text-[#A9B6CC]">?</button>
      </div>

      {/* arena */}
      <div className="mx-auto mt-4 flex max-w-6xl flex-wrap items-start gap-5">
        <div className="flex min-w-[300px] flex-1 basis-[560px] flex-col gap-4">
          {/* banner */}
          <div className="flex items-center gap-4 rounded-2xl border-[1.5px] p-5" style={{ background: banner.bg, borderColor: banner.border }}>
            <span className="grid size-[46px] shrink-0 place-items-center rounded-full text-[22px] font-bold" style={{ background: banner.iconBg, color: banner.iconFg }}>
              {banner.icon}
            </span>
            <div className="min-w-0">
              <div className="text-[clamp(20px,3.4vw,28px)] font-bold leading-tight" style={{ color: banner.titleColor }}>{banner.title}</div>
              <div className="mt-0.5 text-[13.5px]" style={{ color: banner.subColor }}>{banner.sub}</div>
            </div>
          </div>

          {/* price + timer */}
          <div className="flex flex-wrap gap-4">
            <div className="min-w-[240px] flex-1 basis-[320px] rounded-2xl border border-[rgba(255,255,255,.08)] bg-[#0E1729] p-5">
              <div className="text-[12.5px] font-semibold uppercase tracking-wide text-[#7E8DA6]">Одоогийн үнэ</div>
              <div className="mt-1.5 flex items-baseline gap-1">
                <span className="tnum text-[clamp(34px,6vw,52px)] font-semibold leading-none">{Math.round(displayPrice).toLocaleString("en-US")}</span>
                <span className="tnum text-[clamp(22px,4vw,34px)] font-semibold text-[#92A0B6]">₮</span>
              </div>
              <div className="mt-3 flex items-center gap-2 text-[13px] text-[#A9B6CC]">
                Тэргүүлэгч: <strong style={{ color: youLead ? "#7BF2B5" : "#C4D0E2" }}>{leaderLabel ?? "—"}</strong>
              </div>
            </div>
            <div className="min-w-[200px] flex-1 basis-[220px] rounded-2xl border border-[rgba(255,255,255,.08)] bg-[#0E1729] p-5">
              <div className="flex items-center justify-between">
                <div className="text-[12.5px] font-semibold uppercase tracking-wide text-[#7E8DA6]">Үлдсэн хугацаа</div>
                {extendFlash > 0 && (
                  <span key={extendFlash} className="rounded-full border border-[rgba(255,176,46,.4)] bg-[#FFB02E1A] px-2 py-0.5 text-[11.5px] font-bold text-[#FFB02E]" style={{ animation: "badgeFloat 1.8s ease forwards" }}>
                    +30 сек
                  </span>
                )}
              </div>
              <div key={extendFlash} className="tnum mt-2 text-[clamp(40px,7vw,58px)] font-semibold leading-none" style={{ color: timerColor, animation: extendFlash ? "extendPop .6s ease" : undefined }}>
                {mm}:{ss}
              </div>
              <div className="mt-3 text-[11.5px] text-[#5E6B82]">Сүүлчийн санал цаг сунгаж болзошгүй — снайп ажиллахгүй.</div>
            </div>
          </div>

          {/* quick-bid */}
          <div className="rounded-2xl border border-[rgba(255,255,255,.08)] bg-[#0E1729] p-[18px]">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-[13px] font-semibold text-[#C4D0E2]">
                Үнэ нэмэх <span className="font-normal text-[#5E6B82]">· алхам = босго үнийн 10%</span>
              </div>
              <div className="text-[11.5px] text-[#5E6B82]">{youLead ? "Та тэргүүлж байна" : "Нэг товшилт = нэг санал"}</div>
            </div>
            <div className="flex flex-wrap gap-2.5">
              {buttons.map((b) => (
                <button
                  key={b.n}
                  onClick={() => placeBid(b.n)}
                  disabled={b.disabled}
                  className="relative min-w-[104px] flex-1 rounded-[13px] border-[1.5px] px-2.5 pb-3 pt-3.5 text-center"
                  style={{
                    background: b.disabled ? "#0B1322" : b.primary ? "#E63950" : "#16233B",
                    color: b.disabled ? "#3A465C" : "#fff",
                    borderColor: b.disabled ? "rgba(255,255,255,.05)" : b.primary ? "#FF5268" : "rgba(255,255,255,.14)",
                    cursor: b.disabled ? "not-allowed" : "pointer",
                  }}
                >
                  <span className="tnum absolute right-2 top-1.5 rounded border px-1 text-[10px] leading-[15px]" style={{ borderColor: "rgba(255,255,255,.18)", color: b.disabled ? "#33405A" : "#A9B6CC" }}>
                    {b.n}
                  </span>
                  <div className="text-[23px] font-bold leading-none">+{b.n}</div>
                  <div className="tnum mt-1.5 text-[11px]" style={{ color: b.disabled ? "#33405A" : "#92A0B6" }}>
                    +{(b.amount - price).toLocaleString("en-US")}
                  </div>
                  <div className="tnum mt-0.5 text-[13px] font-semibold">{formatTugrug(b.amount)}</div>
                </button>
              ))}
            </div>
          </div>

          {/* balance + kbd */}
          <div className="flex flex-wrap gap-3.5">
            <div className="flex flex-1 basis-[280px] items-center justify-between gap-3 rounded-[14px] border border-[rgba(255,255,255,.08)] bg-[#0E1729] px-[18px] py-3.5">
              <div>
                <div className="text-[12px] font-semibold text-[#7E8DA6]">Боломжит үлдэгдэл</div>
                <div className="tnum mt-0.5 text-[24px] font-semibold" style={{ color: available <= 0 ? "#FF5A5F" : "#EEF2F8" }}>
                  {formatTugrug(available)}
                </div>
              </div>
              <div className="text-right text-[11.5px] leading-relaxed text-[#5E6B82]">
                Барьцаанд: <span className="tnum text-[#A9B6CC]">{formatTugrug(committed)}</span>
                <br />
                Лимит: <span className="tnum text-[#A9B6CC]">{formatTugrug(limit)}</span>
              </div>
            </div>
            <div className="flex flex-1 basis-[240px] items-center gap-3 rounded-[14px] border border-[rgba(255,255,255,.08)] bg-[#0E1729] px-[18px] py-3.5">
              <div className="flex gap-1.5">
                <span className="tnum rounded-md border border-[rgba(255,255,255,.2)] px-2 py-1 text-[12px] text-[#C4D0E2]">1–5</span>
                <span className="tnum rounded-md border border-[rgba(255,255,255,.2)] px-2 py-1 text-[12px] text-[#C4D0E2]">Enter</span>
              </div>
              <div className="text-[12px] leading-snug text-[#92A0B6]">
                Хурдан санал.{" "}
                <button onClick={() => setShowShortcuts(true)} className="text-[#FF6B78] underline">? товчоор</button> бүх товчлол.
              </div>
            </div>
          </div>
        </div>

        {/* feed */}
        <div className="flex max-h-[680px] min-w-[280px] flex-1 basis-[320px] flex-col self-stretch overflow-hidden rounded-2xl border border-[rgba(255,255,255,.08)] bg-[#0E1729]">
          <div className="flex items-center justify-between border-b border-[rgba(255,255,255,.07)] px-[18px] py-[15px]">
            <div className="flex items-center gap-2 text-[13px] font-bold">
              <span className="size-2 rounded-full" style={{ background: connColor, animation: "livedot 1.4s infinite" }} /> Шууд саналууд
            </div>
            <span className="text-[11px] text-[#5E6B82]">{feed.length} санал</span>
          </div>
          <div className="overflow-y-auto p-2">
            {feed.map((f, idx) => (
              <div
                key={`${f.seq}-${f.ts}`}
                className="mb-1.5 flex items-center gap-3 rounded-[11px] border p-3"
                style={{
                  background: f.mine ? "rgba(43,208,122,.1)" : "transparent",
                  borderColor: f.mine ? "rgba(43,208,122,.3)" : "rgba(255,255,255,.05)",
                  animation: idx === 0 ? "feedIn .32s ease" : undefined,
                }}
              >
                <span className="grid size-[30px] shrink-0 place-items-center rounded-full text-[11px] font-bold" style={{ background: f.mine ? "#2BD07A" : "#1C2A44", color: f.mine ? "#06180E" : "#8AA0C0" }}>
                  {f.mine ? "Т" : "#"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold" style={{ color: f.mine ? "#7BF2B5" : "#C4D0E2" }}>{f.label}</div>
                  <div className="text-[11px] text-[#5E6B82]">{relTime(f.ts, now)}</div>
                </div>
                <div className="tnum text-[14px] font-semibold" style={{ color: f.mine ? "#7BF2B5" : "#EEF2F8" }}>{formatTugrug(f.amount)}</div>
              </div>
            ))}
            {feed.length === 0 && <div className="px-3 py-8 text-center text-[12.5px] text-[#5E6B82]">Эхний санал тань байх болтугай.</div>}
          </div>
        </div>
      </div>

      {/* toasts */}
      <div className="fixed right-4 top-4 z-[60] flex w-[min(340px,calc(100vw-32px))] flex-col gap-2.5">
        {toasts.map((t) => {
          const pal = TOAST_PALETTE[t.kind];
          return (
            <div key={t.id} className="flex items-center gap-2.5 rounded-xl border px-3.5 py-3 shadow-lg" style={{ background: pal.bg, borderColor: pal.border, color: pal.color, animation: "toastIn .22s ease" }}>
              <span className="text-[13px]">{t.text}</span>
            </div>
          );
        })}
      </div>

      {/* shortcuts overlay */}
      {showShortcuts && (
        <div onClick={() => setShowShortcuts(false)} className="fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(6,10,18,.78)] p-5">
          <div onClick={(e) => e.stopPropagation()} className="w-[min(460px,100%)] rounded-[18px] border border-[rgba(255,255,255,.12)] bg-[#101B2E] p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-lg font-bold">Гарын товчлол</div>
              <button onClick={() => setShowShortcuts(false)} className="grid size-[30px] place-items-center rounded-lg border border-[rgba(255,255,255,.14)] text-[#A9B6CC]">✕</button>
            </div>
            {SHORTCUTS.map(([keys, label]) => (
              <div key={keys} className="flex items-center gap-3.5 border-b border-[rgba(255,255,255,.06)] py-2.5">
                <span className="tnum min-w-[90px] text-[12.5px]">{keys}</span>
                <span className="text-[13px] text-[#A9B6CC]">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ended overlay */}
      {ended && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-[rgba(6,10,18,.85)] p-5">
          <div className="w-[min(420px,100%)] rounded-[20px] border-[1.5px] p-8 text-center" style={{ background: "#101B2E", borderColor: ended.result === "won" ? "rgba(43,208,122,.5)" : "rgba(255,255,255,.12)" }}>
            <div className="mx-auto mb-4 grid size-16 place-items-center rounded-full text-[30px]" style={{ background: ended.result === "won" ? "#2BD07A" : "#1C2A44", color: ended.result === "won" ? "#06180E" : "#8AA0C0" }}>
              {ended.result === "won" ? "🏆" : "⏱"}
            </div>
            <div className="text-2xl font-bold" style={{ color: ended.result === "won" ? "#7BF2B5" : "#EEF2F8" }}>
              {ended.result === "won" ? "Баяр хүргэе! Та хожлоо" : "Дуудлага худалдаа дууслаа"}
            </div>
            <div className="mt-2 text-sm leading-relaxed text-[#A9B6CC]">
              {ended.result === "won"
                ? `Та энэ эрхийг ${formatTugrug(ended.price)}-өөр хожлоо. Барьцаалсан мөнгө худалдан авалтад зарцуулагдана.`
                : ended.result === "lost"
                  ? `Эцсийн үнэ ${formatTugrug(ended.price)}. Таны барьцаа бүрэн буцаагдсан.`
                  : "Энэ лот дээр санал ирээгүй тул дуусгавар боллоо."}
            </div>
            <Link href={`/lots/${p.lotId}`} className="mt-6 inline-block rounded-xl border border-[rgba(255,255,255,.16)] bg-[#16233B] px-6 py-3 text-sm font-semibold">
              Лот руу буцах
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function relTime(ts: number, now: number): string {
  const d = Math.max(0, Math.round((now - ts) / 1000));
  if (d < 2) return "дөнгөж сая";
  if (d < 60) return `${d} сек өмнө`;
  return `${Math.floor(d / 60)} мин өмнө`;
}
