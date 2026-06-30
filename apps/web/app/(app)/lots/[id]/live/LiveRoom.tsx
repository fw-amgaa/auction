"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  ANTI_SNIPE_EXTENSION_SEC,
  ANTI_SNIPE_WINDOW_SEC,
  type BidOptionId,
  type ClientMessage,
  FINAL_STRETCH_SEC,
  formatTugrug,
  incrementForOption,
  isFastOption,
  liveBidAmount,
  type ServerMessage,
} from "@auction/shared";

import { Confetti } from "@/components/Confetti";

export interface LiveRoomProps {
  lotId: string;
  code: string;
  species: string;
  latin: string | null;
  aimag: string | null;
  reserve: number;
  /** the two fixed ascending bid increments for this lot's category */
  increments: [number, number];
  title: string;
  image: string | null;
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

/* ── premium "obsidian auction floor" palette ───────────────────────── */
const A = {
  fg: "#F2F4F8",
  body: "#AEB9CB",
  dim: "#6E7C92",
  faint: "#47536A",
  hair: "rgba(255,255,255,0.06)",
  hairStrong: "rgba(255,255,255,0.11)",
  accent: "#E03B4B",
  accentHover: "#F1505F",
  accentSoft: "#FF96A0",
  success: "#27C779",
  successSoft: "#74E7AC",
  amber: "#F0B440",
  amberSoft: "#F6D58A",
  danger: "#FF5C61",
  gold: "#E7B24B",
  goldSoft: "#F2C97A",
};

const REASON_TEXT: Record<string, string> = {
  closed: "Дуудлага хаагдсан",
  self: "Та аль хэдийн тэргүүлж байна",
  bad_increment: "Алхам буруу байна",
  insufficient: "Үлдэгдэл хүрэлцэхгүй",
  not_eligible: "Оролцох эрхгүй",
  rate_limited: "Хэт олон санал — түр хүлээнэ үү",
  locked: "Энэ товч сүүлийн 3 минутад нээгдэнэ",
};

const TOAST_PALETTE: Record<
  Toast["kind"],
  { bg: string; border: string; color: string; dot: string }
> = {
  success: { bg: "rgba(11,30,22,.92)", border: "rgba(39,199,121,.45)", color: A.successSoft, dot: A.success },
  danger: { bg: "rgba(34,11,15,.92)", border: "rgba(255,92,97,.5)", color: A.accentSoft, dot: A.danger },
  warn: { bg: "rgba(34,26,9,.92)", border: "rgba(240,180,64,.45)", color: A.amberSoft, dot: A.amber },
  info: { bg: "rgba(15,19,29,.92)", border: "rgba(255,255,255,.14)", color: "#C4D0E2", dot: "#8AA0C0" },
};

const SHORTCUTS: [string, string][] = [
  ["1 / 2", "Үндсэн дүнгээр санал нэмэх"],
  ["3 / 4", "Хурдан (×2) дүн — зөвхөн сүүлийн 3 минутад"],
  ["Enter / Space", "Эхний дүнгээр санал нэмэх"],
  ["Esc", "Цонх хаах"],
  ["W", "Ажиглах"],
  ["?", "Энэ товчлолын цонх"],
];

/* ── icons: one consistent 1.7px hairline stroke set ────────────────── */
type IconProps = React.SVGProps<SVGSVGElement>;
const svg = (size: number, p: IconProps, body: React.ReactNode) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.7}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...p}
  >
    {body}
  </svg>
);
const IconEye = (p: IconProps) =>
  svg(14, p, <>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </>);
const IconStar = ({ filled, ...p }: IconProps & { filled?: boolean }) =>
  svg(15, { fill: filled ? "currentColor" : "none", ...p },
    <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17.8 6.6 21l1-6.1L3.2 9.5l6.1-.9Z" />);
const IconClock = (p: IconProps) =>
  svg(14, p, <><circle cx="12" cy="12" r="9" /><path d="M12 7.5V12l3 2" /></>);
const IconBolt = (p: IconProps) =>
  svg(14, { fill: "currentColor", stroke: "none", ...p },
    <path d="M13 2 4.5 13.4c-.3.4 0 1 .5 1H10l-1 6.6c-.1.7.8 1 1.2.4L20 9.6c.3-.4 0-1-.5-1H14l1-6.4c.1-.7-.8-1-1.2-.2Z" />);
const IconTrophy = (p: IconProps) =>
  svg(30, p, <>
    <path d="M7 4h10v4a5 5 0 0 1-10 0Z" />
    <path d="M7 5H4v1.2A3 3 0 0 0 7 9M17 5h3v1.2A3 3 0 0 1 17 9" />
    <path d="M10 13.5V17M14 13.5V17M8.5 20.5h7M9.5 17h5" />
  </>);

export function LiveRoom(p: LiveRoomProps) {
  const wsRef = useRef<WebSocket | null>(null);
  const [conn, setConn] = useState<"connecting" | "live" | "reconnecting">("connecting");
  const [price, setPrice] = useState(p.reserve);
  const [displayPrice, setDisplayPrice] = useState(p.reserve);
  const [increments, setIncrements] = useState<[number, number]>(p.increments);
  const [reserve] = useState(p.reserve);
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
        setIncrements([msg.inc1, msg.inc2]);
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
        setLeaderLabel(msg.leaderLabel);
        setYouLead(msg.youLead);
        setEndsAt(msg.endsAt);
        setFeed((f) => [msg.feedItem, ...f].slice(0, 14));
        if (msg.extended) {
          setExtendFlash((n) => n + 1);
          addToast("warn", `Хугацаа сунгагдлаа +${ANTI_SNIPE_EXTENSION_SEC} сек`);
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
    (option: BidOptionId) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== ws.OPEN || ended) return;
      // Fast (×2) options unlock only in the final stretch. Compute from the live
      // clock (not render state) so the guard matches the server's own check.
      if (isFastOption(option)) {
        const secsLeft = Math.floor((endsAt - Date.now()) / 1000);
        if (secsLeft > FINAL_STRETCH_SEC) {
          addToast("info", "Хурдан дүн сүүлийн 3 минутад нээгдэнэ");
          return;
        }
      }
      if (youLead) {
        addToast("info", "Та аль хэдийн тэргүүлж байна");
        return;
      }
      const amount = liveBidAmount(price, increments, option);
      if (amount > available) {
        addToast("danger", "Үлдэгдэл хүрэлцэхгүй");
        return;
      }
      setEverBid(true);
      ws.send(JSON.stringify({ t: "bid", lotId: p.lotId, option } satisfies ClientMessage));
    },
    [price, increments, available, youLead, ended, endsAt, addToast, p.lotId],
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
      if (e.key === "1" || e.key === "2" || e.key === "3" || e.key === "4") {
        e.preventDefault();
        placeBid(Number.parseInt(e.key, 10) as BidOptionId);
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
  const timerColor = timeLeft > 30 ? A.success : timeLeft > 10 ? A.amber : A.danger;
  // Final-seconds tension — tied to the anti-snipe window so the drama lines up
  // with the moment a late bid can still extend the clock.
  const critical = !ended && conn === "live" && timeLeft > 0 && timeLeft <= ANTI_SNIPE_WINDOW_SEC;
  // Final stretch — the last FINAL_STRETCH_SEC, where the ×2 "fast" options unlock.
  const finalStretch = !ended && conn === "live" && timeLeft > 0 && timeLeft <= FINAL_STRETCH_SEC;
  const timeFrac = Math.max(0, Math.min(1, timeLeft / 60));
  const overReserve = Math.max(0, Math.round(displayPrice) - reserve);

  // The hero number must stay inside its card even at billions. Monospace gives
  // predictable width, so step the size down by digit count (commas included).
  const priceStr = Math.round(displayPrice).toLocaleString("en-US");
  const priceFont = priceStr.length <= 9 ? "clamp(30px,4.6vw,44px)" : priceStr.length <= 11 ? "clamp(25px,3.8vw,36px)" : "clamp(20px,3vw,29px)";
  const tugrugFont = priceStr.length <= 9 ? "clamp(20px,3vw,28px)" : priceStr.length <= 11 ? "clamp(17px,2.6vw,24px)" : "clamp(15px,2.2vw,20px)";

  // banner — state-coloured, single light source
  const banner = youLead
    ? { bg: "linear-gradient(135deg,#0E2B1D,#0A1E15)", border: "rgba(39,199,121,.45)", glow: "rgba(39,199,121,.12)", icon: "✓", iconBg: A.success, iconFg: "#06180E", title: "Та тэргүүлж байна", sub: `Таны санал хамгийн өндөр. Барьцаа: ${formatTugrug(committed)}`, titleColor: A.successSoft, subColor: "#9FCFB6" }
    : everBid
      ? { bg: "linear-gradient(135deg,#2A0E14,#1C0A0F)", border: "rgba(255,92,97,.5)", glow: "rgba(224,59,75,.14)", icon: "!", iconBg: A.accent, iconFg: "#2A0708", title: "Таны саналыг давсан", sub: "Барьцаалсан мөнгө буцаагдлаа. Дахин үнэ нэмэх үү?", titleColor: A.accentSoft, subColor: "#E0A6A9" }
      : { bg: "linear-gradient(135deg,#101521,#0C0F18)", border: A.hairStrong, glow: "transparent", icon: "›", iconBg: "#1B2332", iconFg: "#8AA0C0", title: "Та оролцоонд ороогүй байна", sub: "Доорх товчоор үнэ нэмж оролцоно уу.", titleColor: A.fg, subColor: A.dim };

  // The two MAIN options are equally valid bids (just different fixed
  // increments), so they share one neutral treatment. They stay distinguishable
  // by amount and the 1/2 badge.
  const mainButtons = ([1, 2] as const).map((option) => {
    const increment = incrementForOption(increments, option);
    const amount = liveBidAmount(price, increments, option);
    const disabled = youLead || !!ended || conn !== "live" || amount > available;
    return { option, increment, amount, disabled };
  });
  // The two FAST (×2) options unlock only in the final stretch. Before then they
  // render compact + greyed (locked); inside the window they expand and take a
  // gold accent to flag the faster step.
  const fastButtons = ([3, 4] as const).map((option) => {
    const increment = incrementForOption(increments, option);
    const amount = liveBidAmount(price, increments, option);
    const locked = !finalStretch;
    const disabled = locked || youLead || !!ended || conn !== "live" || amount > available;
    return { option, increment, amount, disabled, locked };
  });

  const connColor = conn === "live" ? A.success : A.amber;
  const connText = conn === "live" ? "Холбогдсон" : "Холбогдож байна…";

  const chip = "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold";

  return (
    <div className="arena-grain relative min-h-[100dvh]" style={{ color: A.fg }}>
      <div className="arena-field" aria-hidden />

      <div className="relative z-10 mx-auto max-w-[1320px] px-5 pb-24 pt-6 sm:px-7">
        {/* ── status strip ──────────────────────────────────────────── */}
        <section
          aria-label="Дуудлагын төлөв"
          className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b pb-5"
          style={{ borderColor: A.hair }}
        >
          <Link href={`/lots/${p.lotId}`} title="Лот руу буцах" className="group flex min-w-0 items-center gap-2.5">
            <span
              className="grid size-8 shrink-0 place-items-center rounded-full border text-[16px] leading-none transition-colors group-hover:bg-white/5"
              style={{ borderColor: A.hairStrong, color: A.body }}
            >
              ‹
            </span>
            <span className="min-w-0">
              <span className="tnum block truncate text-[15px] font-semibold tracking-tight">
                {p.species} <span style={{ color: A.dim }}>·</span> {p.code}
              </span>
              <span className="block text-[11px]" style={{ color: A.faint }}>Лот руу буцах</span>
            </span>
          </Link>

          <div className="ml-auto flex flex-wrap items-center gap-2.5">
            <span
              className={chip}
              style={{ borderColor: "rgba(224,59,75,.5)", background: "rgba(224,59,75,.1)", color: A.accentSoft, letterSpacing: ".06em" }}
            >
              <span className="size-2 rounded-full" style={{ background: A.accent, animation: "livedot 1.4s infinite" }} />
              LIVE
            </span>
            <span className={`${chip} tnum`} style={{ borderColor: A.hair, color: A.body }}>
              <IconEye style={{ color: A.dim }} /> {spectators}
            </span>
            <span className={chip} style={{ borderColor: A.hair, color: connColor }}>
              <span className="size-2 rounded-full" style={{ background: connColor, animation: "livedot 1.4s infinite" }} />
              {connText}
            </span>
            <button
              onClick={() => setShowShortcuts(true)}
              aria-label="Гарын товчлол"
              className="grid size-[34px] place-items-center rounded-full border text-[15px] font-bold transition-all duration-200 hover:-translate-y-px"
              style={{ borderColor: A.hair, color: A.body }}
            >
              ?
            </button>
          </div>
        </section>

        {/* ── arena ─────────────────────────────────────────────────── */}
        <div className="mt-6 flex flex-wrap items-start gap-6">
          {/* lot showcase — the item under the hammer */}
          <aside
            className="flex w-full min-w-[260px] flex-1 basis-[300px] flex-col gap-4 lg:max-w-[340px]"
            aria-label="Лотын танилцуулга"
          >
            <div className="arena-panel overflow-hidden rounded-[20px]">
              <div className="relative aspect-[16/10] w-full overflow-hidden lg:aspect-[4/5]">
                {p.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/media?key=${encodeURIComponent(p.image)}`}
                    alt={`${p.title || p.species} — ${p.code}`}
                    className="absolute inset-0 size-full object-cover"
                  />
                ) : (
                  <div
                    className="absolute inset-0 grid place-items-center"
                    style={{
                      background:
                        "radial-gradient(120% 90% at 50% -10%, rgba(224,59,75,.12), transparent 55%), repeating-linear-gradient(135deg, #131927 0 14px, #0E131D 14px 28px)",
                    }}
                  >
                    <span className="select-none text-[88px] font-semibold leading-none tracking-tight" style={{ color: "rgba(255,255,255,.06)" }}>
                      {(p.species ?? "?").slice(0, 1)}
                    </span>
                  </div>
                )}
                <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(8,10,15,0) 38%, rgba(8,10,15,.92))" }} />
                <span
                  className="tnum absolute left-3 top-3 rounded-lg px-2.5 py-1 text-[12px] font-semibold backdrop-blur"
                  style={{ background: "rgba(8,10,15,.6)", border: `1px solid ${A.hairStrong}`, color: A.fg }}
                >
                  {p.species} · {p.code}
                </span>
                <div className="absolute inset-x-4 bottom-4">
                  <div className="text-[20px] font-semibold leading-tight tracking-tight" style={{ textShadow: "0 2px 12px rgba(0,0,0,.6)" }}>
                    {p.title || p.species}
                  </div>
                  {p.latin && (
                    <div className="mt-0.5 text-[12px] italic" style={{ color: "rgba(255,255,255,.78)" }}>{p.latin}</div>
                  )}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between px-4 py-3 text-[12.5px]">
                  <span style={{ color: A.dim }}>Аймаг / бүс</span>
                  <span className="font-medium" style={{ color: A.body }}>{p.aimag ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between border-t px-4 py-3 text-[12.5px]" style={{ borderColor: A.hair }}>
                  <span style={{ color: A.dim }}>Босго үнэ</span>
                  <span className="tnum font-semibold" style={{ color: A.fg }}>{formatTugrug(reserve)}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setWatching((v) => !v)}
              className="flex items-center justify-center gap-2 rounded-[14px] border py-3 text-[13px] font-semibold transition-all duration-200 hover:-translate-y-px active:translate-y-0"
              style={{
                borderColor: watching ? "rgba(231,178,75,.5)" : A.hairStrong,
                background: watching ? "rgba(231,178,75,.1)" : "rgba(255,255,255,.02)",
                color: watching ? A.goldSoft : A.body,
              }}
            >
              <IconStar filled={watching} /> {watching ? "Ажиглаж байна" : "Ажиглах"}
            </button>
          </aside>

          <div className="flex min-w-[320px] flex-[1.4] basis-[500px] flex-col gap-5">
            {/* status banner */}
            <div
              className="relative flex items-center gap-4 overflow-hidden rounded-[20px] border p-5"
              style={{ background: banner.bg, borderColor: banner.border, boxShadow: `0 0 60px -30px ${banner.glow}, inset 0 1px 0 0 rgba(255,255,255,.04)` }}
            >
              <span
                className="grid size-[48px] shrink-0 place-items-center rounded-2xl text-[22px] font-bold"
                style={{ background: banner.iconBg, color: banner.iconFg }}
              >
                {banner.icon}
              </span>
              <div className="min-w-0">
                <div className="text-[clamp(20px,3.2vw,27px)] font-semibold leading-tight tracking-tight" style={{ color: banner.titleColor }}>
                  {banner.title}
                </div>
                <div className="mt-1 text-[13.5px] leading-snug" style={{ color: banner.subColor }}>{banner.sub}</div>
              </div>
            </div>

            {/* price + timer */}
            <div className="flex flex-wrap gap-5">
              <div className="arena-panel relative min-w-[220px] flex-1 basis-[270px] overflow-hidden rounded-[20px] p-5">
                <div className="flex items-center justify-between">
                  <div className="text-[11.5px] font-semibold uppercase tracking-[.12em]" style={{ color: A.dim }}>
                    Одоогийн үнэ
                  </div>
                  {overReserve > 0 && (
                    <span className="tnum rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: "rgba(39,199,121,.12)", color: A.successSoft }}>
                      +{overReserve.toLocaleString("en-US")} босгоос
                    </span>
                  )}
                </div>
                <div className="mt-2 flex min-w-0 items-baseline gap-1">
                  <span className="tnum whitespace-nowrap font-semibold leading-none tracking-tight" style={{ fontSize: priceFont }}>
                    {priceStr}
                  </span>
                  <span className="tnum font-medium" style={{ fontSize: tugrugFont, color: A.dim }}>₮</span>
                </div>
                <div className="mt-3.5 flex items-center gap-2 border-t pt-3 text-[13px]" style={{ borderColor: A.hair, color: A.body }}>
                  <span style={{ color: A.dim }}>Тэргүүлэгч</span>
                  <strong className="ml-auto truncate font-semibold" style={{ color: youLead ? A.successSoft : A.fg }}>
                    {youLead ? "Та" : (leaderLabel ?? "—")}
                  </strong>
                </div>
              </div>

              <div className="arena-panel relative min-w-[180px] flex-1 basis-[200px] overflow-hidden rounded-[20px] p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-[.12em]" style={{ color: A.dim }}>
                    <IconClock /> Үлдсэн хугацаа
                  </div>
                  {critical && (
                    <span
                      className="rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase tracking-[.06em]"
                      style={{ borderColor: "rgba(255,92,97,.5)", background: "rgba(255,92,97,.14)", color: A.accentSoft, animation: "livedot 1s infinite" }}
                    >
                      Дуусч байна!
                    </span>
                  )}
                  {extendFlash > 0 && !critical && (
                    <span
                      key={extendFlash}
                      className="tnum rounded-full border px-2 py-0.5 text-[11px] font-bold"
                      style={{ borderColor: "rgba(240,180,64,.4)", background: "rgba(240,180,64,.12)", color: A.amber, animation: "badgeFloat 1.8s ease forwards" }}
                    >
                      +{ANTI_SNIPE_EXTENSION_SEC} сек
                    </span>
                  )}
                </div>
                <div
                  key={extendFlash}
                  className="tnum mt-2 text-[clamp(40px,7vw,58px)] font-semibold leading-none tracking-tight"
                  style={{
                    color: timerColor,
                    animation: critical
                      ? "heartbeat 1s ease-in-out infinite"
                      : extendFlash
                        ? "extendPop .6s ease"
                        : undefined,
                    textShadow: critical ? `0 0 24px ${A.danger}` : undefined,
                  }}
                >
                  {mm}:{ss}
                </div>
                <div className="mt-3.5 h-1.5 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,.06)" }}>
                  <div
                    className="h-full rounded-full transition-[width] duration-1000 ease-linear"
                    style={{ width: `${timeFrac * 100}%`, background: timerColor, boxShadow: `0 0 10px ${timerColor}` }}
                  />
                </div>
                <div className="mt-2.5 text-[11px] leading-snug" style={{ color: A.faint }}>
                  Сүүлчийн санал цаг сунгаж болзошгүй — снайп ажиллахгүй.
                </div>
              </div>
            </div>

            {/* quick-bid */}
            <div className="arena-panel rounded-[20px] p-5">
              <div className="mb-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: A.body }}>
                  <IconBolt style={{ color: A.accent }} />
                  Үнэ нэмэх{" "}
                  <span className="font-normal" style={{ color: A.faint }}>
                    · {finalStretch ? "дөрвөн дүн" : "үндсэн хоёр дүн"}
                  </span>
                </div>
                <div className="text-[11.5px]" style={{ color: A.faint }}>
                  {youLead ? "Та тэргүүлж байна" : "Нэг товшилт = нэг санал"}
                </div>
              </div>

              {/* main increments (always available) */}
              <div className="flex flex-wrap gap-2.5">
                {mainButtons.map((b) => (
                  <button
                    key={b.option}
                    onClick={() => placeBid(b.option)}
                    disabled={b.disabled}
                    className="group relative min-w-[150px] flex-1 rounded-[15px] border px-3 pb-3.5 pt-4 text-center transition-all duration-200 enabled:hover:-translate-y-0.5 enabled:active:translate-y-0 enabled:active:scale-[.985]"
                    style={{
                      background: b.disabled ? "rgba(255,255,255,.02)" : "#171D29",
                      color: b.disabled ? A.faint : "#fff",
                      borderColor: b.disabled ? A.hair : A.hairStrong,
                      boxShadow: b.disabled ? "none" : "inset 0 1px 0 0 rgba(255,255,255,.05)",
                      cursor: b.disabled ? "not-allowed" : "pointer",
                    }}
                  >
                    <span
                      className="tnum absolute right-2 top-2 rounded px-1 text-[10px] leading-[15px]"
                      style={{ border: `1px solid ${A.hairStrong}`, color: b.disabled ? A.faint : A.body }}
                    >
                      {b.option}
                    </span>
                    <div className="tnum text-[22px] font-bold leading-none tracking-tight">
                      +{b.increment.toLocaleString("en-US")}
                    </div>
                    <div className="tnum mt-1.5 text-[12px] font-semibold">= {formatTugrug(b.amount)}</div>
                  </button>
                ))}
              </div>

              {/* divider / fast-row label */}
              <div className="mt-3 flex items-center gap-2.5">
                <div className="h-px flex-1" style={{ background: A.hair }} />
                <span
                  className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[.08em]"
                  style={{ color: finalStretch ? A.goldSoft : A.faint }}
                >
                  {finalStretch ? (
                    <>
                      <IconBolt /> Хурдан ×2 дүн нээгдлээ
                    </>
                  ) : (
                    <>
                      <IconClock /> Хурдан ×2 — сүүлийн 3 минутад
                    </>
                  )}
                </span>
                <div className="h-px flex-1" style={{ background: A.hair }} />
              </div>

              {/* fast (×2) increments — unlock in the final stretch */}
              <div className="mt-2.5 flex flex-wrap gap-2.5">
                {fastButtons.map((b) => (
                  <button
                    key={b.option}
                    onClick={() => placeBid(b.option)}
                    disabled={b.disabled}
                    title={b.locked ? "Сүүлийн 3 минутад нээгдэнэ" : undefined}
                    className="group relative min-w-[150px] flex-1 rounded-[15px] border text-center transition-all duration-200 enabled:hover:-translate-y-0.5 enabled:active:translate-y-0 enabled:active:scale-[.985]"
                    style={{
                      padding: b.locked ? "9px 12px" : "16px 12px 14px",
                      background: b.locked ? "rgba(255,255,255,.015)" : "rgba(231,178,75,.10)",
                      color: b.disabled ? A.faint : A.goldSoft,
                      borderColor: b.locked ? A.hair : "rgba(231,178,75,.45)",
                      boxShadow: b.disabled ? "none" : "inset 0 1px 0 0 rgba(255,255,255,.06)",
                      cursor: b.disabled ? "not-allowed" : "pointer",
                      opacity: b.locked ? 0.62 : 1,
                    }}
                  >
                    <span
                      className="tnum absolute right-2 top-2 rounded px-1 text-[10px] leading-[15px]"
                      style={{ border: `1px solid ${A.hairStrong}`, color: b.disabled ? A.faint : A.goldSoft }}
                    >
                      {b.option}
                    </span>
                    <div
                      className="tnum font-bold leading-none tracking-tight"
                      style={{ fontSize: b.locked ? "15px" : "22px" }}
                    >
                      +{b.increment.toLocaleString("en-US")}
                    </div>
                    {b.locked ? (
                      <div className="mt-0.5 text-[10px]" style={{ color: A.faint }}>
                        ×2 хурдан · түгжээтэй
                      </div>
                    ) : (
                      <div className="tnum mt-1.5 text-[12px] font-semibold">= {formatTugrug(b.amount)}</div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* balance + kbd */}
            <div className="flex flex-wrap gap-4">
              <div className="arena-panel flex flex-1 basis-[280px] items-center justify-between gap-3 rounded-[16px] px-5 py-4">
                <div>
                  <div className="text-[11.5px] font-semibold uppercase tracking-[.1em]" style={{ color: A.dim }}>
                    Боломжит үлдэгдэл
                  </div>
                  <div className="tnum mt-1 text-[25px] font-semibold tracking-tight" style={{ color: available <= 0 ? A.danger : A.fg }}>
                    {formatTugrug(available)}
                  </div>
                </div>
                <div className="text-right text-[11.5px] leading-relaxed" style={{ color: A.faint }}>
                  Барьцаанд <span className="tnum" style={{ color: A.body }}>{formatTugrug(committed)}</span>
                  <br />
                  Лимит <span className="tnum" style={{ color: A.body }}>{formatTugrug(limit)}</span>
                </div>
              </div>
              <div className="arena-panel flex flex-1 basis-[240px] items-center gap-3 rounded-[16px] px-5 py-4">
                <div className="flex gap-1.5">
                  <span className="tnum rounded-md border px-2 py-1 text-[12px]" style={{ borderColor: A.hairStrong, color: A.body }}>1/2</span>
                  <span className="tnum rounded-md border px-2 py-1 text-[12px]" style={{ borderColor: A.hairStrong, color: A.body }}>Enter</span>
                </div>
                <div className="text-[12px] leading-snug" style={{ color: A.dim }}>
                  Хурдан санал.{" "}
                  <button onClick={() => setShowShortcuts(true)} className="font-medium underline-offset-2 hover:underline" style={{ color: A.accentSoft }}>
                    ? товчоор
                  </button>{" "}
                  бүх товчлол.
                </div>
              </div>
            </div>
          </div>

          {/* feed */}
          <aside
            className="arena-panel flex max-h-[660px] min-w-[280px] flex-1 basis-[300px] flex-col self-stretch overflow-hidden rounded-[20px] lg:max-w-[360px]"
            aria-label="Шууд саналын урсгал"
          >
            <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: A.hair }}>
              <div className="flex items-center gap-2 text-[13px] font-semibold">
                <span className="size-2 rounded-full" style={{ background: connColor, animation: "livedot 1.4s infinite" }} />
                Шууд саналууд
              </div>
              <span className="tnum text-[11px]" style={{ color: A.faint }}>{feed.length}</span>
            </div>
            <div className="arena-scroll overflow-y-auto p-2.5">
              {feed.map((f, idx) => (
                <div
                  key={`${f.seq}-${f.ts}`}
                  className="mb-1.5 flex items-center gap-3 rounded-[13px] border p-3 transition-colors"
                  style={{
                    background: f.mine ? "rgba(39,199,121,.09)" : "transparent",
                    borderColor: f.mine ? "rgba(39,199,121,.28)" : A.hair,
                    animation: idx === 0 ? "feedIn .34s cubic-bezier(.22,1,.36,1)" : undefined,
                  }}
                >
                  <span
                    className="grid size-[30px] shrink-0 place-items-center rounded-full text-[11px] font-bold"
                    style={{ background: f.mine ? A.success : "#1B2332", color: f.mine ? "#06180E" : "#8AA0C0" }}
                  >
                    {f.mine ? "Т" : "#"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold" style={{ color: f.mine ? A.successSoft : A.fg }}>{f.label}</div>
                    <div className="text-[11px]" style={{ color: A.faint }}>{relTime(f.ts, now)}</div>
                  </div>
                  <div className="tnum text-[14px] font-semibold" style={{ color: f.mine ? A.successSoft : A.fg }}>{formatTugrug(f.amount)}</div>
                </div>
              ))}
              {feed.length === 0 && (
                <div className="flex flex-col items-center gap-2 px-3 py-10 text-center">
                  <span className="grid size-10 place-items-center rounded-full" style={{ background: "#1B2332", color: A.dim }}>
                    <IconBolt />
                  </span>
                  <div className="text-[12.5px]" style={{ color: A.dim }}>Эхний санал тань байх болтугай.</div>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* final-seconds red vignette — full-screen, non-blocking */}
      {critical && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-[55]"
          style={{
            background:
              "radial-gradient(120% 90% at 50% 50%, transparent 52%, rgba(224,59,75,.16) 80%, rgba(224,59,75,.4) 100%)",
            animation: "vignettePulse 1s ease-in-out infinite",
          }}
        />
      )}

      {/* win celebration */}
      {ended?.result === "won" && <Confetti />}

      {/* toasts */}
      <div className="fixed right-4 top-20 z-[60] flex w-[min(340px,calc(100vw-32px))] flex-col gap-2.5">
        {toasts.map((t) => {
          const pal = TOAST_PALETTE[t.kind];
          return (
            <div
              key={t.id}
              className="flex items-center gap-2.5 rounded-[14px] border px-3.5 py-3 backdrop-blur-xl"
              style={{ background: pal.bg, borderColor: pal.border, color: pal.color, boxShadow: "0 16px 40px -20px rgba(0,0,0,.85)", animation: "toastIn .26s cubic-bezier(.22,1,.36,1)" }}
            >
              <span className="size-2 shrink-0 rounded-full" style={{ background: pal.dot }} />
              <span className="text-[13px] leading-snug">{t.text}</span>
            </div>
          );
        })}
      </div>

      {/* shortcuts overlay */}
      {showShortcuts && (
        <div onClick={() => setShowShortcuts(false)} className="fixed inset-0 z-[70] flex items-center justify-center p-5" style={{ background: "rgba(5,7,12,.78)", backdropFilter: "blur(4px)" }}>
          <div onClick={(e) => e.stopPropagation()} className="arena-glass w-[min(460px,100%)] rounded-[20px] border p-6" style={{ borderColor: A.hairStrong }}>
            <div className="mb-4 flex items-center justify-between">
              <div className="text-[17px] font-semibold tracking-tight">Гарын товчлол</div>
              <button onClick={() => setShowShortcuts(false)} aria-label="Хаах" className="grid size-[30px] place-items-center rounded-lg border text-[13px]" style={{ borderColor: A.hairStrong, color: A.body }}>✕</button>
            </div>
            {SHORTCUTS.map(([keys, label]) => (
              <div key={keys} className="flex items-center gap-3.5 border-b py-2.5 last:border-0" style={{ borderColor: A.hair }}>
                <span className="tnum min-w-[96px] rounded-md border px-2 py-1 text-center text-[12px]" style={{ borderColor: A.hairStrong, color: A.body }}>{keys}</span>
                <span className="text-[13px]" style={{ color: A.body }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ended overlay */}
      {ended && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center p-5" style={{ background: "rgba(5,7,12,.86)", backdropFilter: "blur(6px)" }}>
          <div
            className="arena-glass w-[min(420px,100%)] rounded-[24px] border p-8 text-center"
            style={{ borderColor: ended.result === "won" ? "rgba(231,178,75,.5)" : A.hairStrong, boxShadow: ended.result === "won" ? "0 0 80px -30px rgba(231,178,75,.5)" : "0 30px 80px -40px rgba(0,0,0,.9)" }}
          >
            <div
              className="mx-auto mb-5 grid size-16 place-items-center rounded-2xl"
              style={{ background: ended.result === "won" ? "rgba(231,178,75,.14)" : "#1B2332", color: ended.result === "won" ? A.gold : A.dim }}
            >
              {ended.result === "won" ? <IconTrophy /> : <IconClock width={28} height={28} />}
            </div>
            <div className="text-[23px] font-semibold tracking-tight" style={{ color: ended.result === "won" ? A.goldSoft : A.fg }}>
              {ended.result === "won" ? "Баяр хүргэе, та хожлоо" : "Дуудлага худалдаа дууслаа"}
            </div>
            <div className="mt-2.5 text-[13.5px] leading-relaxed" style={{ color: A.body }}>
              {ended.result === "won"
                ? `Та энэ эрхийг ${formatTugrug(ended.price)}-өөр хожлоо. Барьцаалсан мөнгө худалдан авалтад зарцуулагдана.`
                : ended.result === "lost"
                  ? `Эцсийн үнэ ${formatTugrug(ended.price)}. Таны барьцаа бүрэн буцаагдсан.`
                  : "Энэ удаад ялагч тодроогүй — лот дүрмийн дагуу дахин зарлагдана. Барьцаа байршуулсан бол буцаагдсан."}
            </div>
            <Link
              href={`/lots/${p.lotId}`}
              className="mt-6 inline-block rounded-[14px] border px-6 py-3 text-[13.5px] font-semibold transition-colors hover:bg-white/5"
              style={{ borderColor: A.hairStrong, color: A.fg }}
            >
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
