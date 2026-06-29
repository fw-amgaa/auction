"use client";

import { useEffect, useRef, useState } from "react";

import {
  ANTI_SNIPE_EXTENSION_SEC,
  ANTI_SNIPE_WINDOW_SEC,
  type ClientMessage,
  formatTugrug,
  type ServerMessage,
} from "@auction/shared";

interface FeedRow {
  seq: number;
  label: string;
  amount: number;
  ts: number;
}

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Read-only admin monitor for a single live lot. Same WebSocket wiring as the
 * bidder live room, but shows REAL participant names and never bids. Mirrors the
 * bidder's final-seconds emphasis so admins feel the same clock pressure.
 */
export function AdminLotMonitor({
  lotId,
  ticket,
  wsBase,
  initialPrice,
  initialEndsAt,
}: {
  lotId: string;
  ticket: string;
  wsBase: string;
  initialPrice: number;
  initialEndsAt: number;
}) {
  const [conn, setConn] = useState<"connecting" | "live" | "reconnecting">("connecting");
  const [price, setPrice] = useState(initialPrice);
  const [leaderLabel, setLeaderLabel] = useState<string | null>(null);
  const [endsAt, setEndsAt] = useState(initialEndsAt);
  const [spectators, setSpectators] = useState(0);
  const [feed, setFeed] = useState<FeedRow[]>([]);
  const [status, setStatus] = useState<"live" | "ended">("live");
  const [extendFlash, setExtendFlash] = useState(0);
  const [priceFlash, setPriceFlash] = useState(0);
  const [now, setNow] = useState(Date.now());
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let closed = false;
    let retry = 0;
    let pingTimer: ReturnType<typeof setInterval> | null = null;

    const connect = () => {
      const ws = new WebSocket(`${wsBase}/ws?ticket=${encodeURIComponent(ticket)}`);
      wsRef.current = ws;
      ws.onopen = () => {
        retry = 0;
        setConn("live");
        ws.send(JSON.stringify({ t: "subscribe", lotId } satisfies ClientMessage));
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
        switch (msg.t) {
          case "snapshot":
            setPrice(msg.price);
            setLeaderLabel(msg.leaderLabel);
            setEndsAt(msg.endsAt);
            setSpectators(msg.spectators);
            setStatus(msg.status);
            setFeed(msg.feed.map((f) => ({ seq: f.seq, label: f.label, amount: f.amount, ts: f.ts })));
            break;
          case "bid":
            setPrice(msg.price);
            setLeaderLabel(msg.leaderLabel);
            setEndsAt(msg.endsAt);
            setPriceFlash((n) => n + 1);
            setFeed((f) =>
              [{ seq: msg.feedItem.seq, label: msg.feedItem.label, amount: msg.feedItem.amount, ts: msg.feedItem.ts }, ...f].slice(0, 30),
            );
            if (msg.extended) setExtendFlash((n) => n + 1);
            break;
          case "spectators":
            setSpectators(msg.count);
            break;
          case "closed":
            setStatus("ended");
            setPrice(msg.price);
            if (msg.leaderLabel !== undefined) setLeaderLabel(msg.leaderLabel);
            break;
        }
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
  }, [lotId, ticket, wsBase]);

  const timeLeft = Math.max(0, Math.floor((endsAt - now) / 1000));
  const critical = status === "live" && timeLeft > 0 && timeLeft <= ANTI_SNIPE_WINDOW_SEC;
  const timerColor = status === "ended" ? "#8A93A3" : timeLeft > 30 ? "#1F8A5B" : timeLeft > 10 ? "#C77A0A" : "#C8312C";
  const connColor = conn === "live" ? "#1F8A5B" : "#C77A0A";

  return (
    <div className="overflow-hidden rounded-2xl border border-line-cool bg-white">
      <div className="flex items-center justify-between border-b border-[#EBEEF3] px-5 py-3.5">
        <h2 className="flex items-center gap-2 text-sm font-bold text-navy">
          <span className="size-2 rounded-full bg-crimson" style={{ animation: "livedot 1.5s infinite" }} />
          Шууд хяналт
        </h2>
        <span className="flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: connColor }}>
          <span className="size-2 rounded-full" style={{ background: connColor, animation: "livedot 1.5s infinite" }} />
          {conn === "live" ? "Холбогдсон" : "Холбогдож байна…"}
        </span>
      </div>

      {/* live stats */}
      <div className="grid gap-px bg-[#EBEEF3] sm:grid-cols-3">
        <div className="bg-white px-5 py-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Одоогийн үнэ</div>
          <div
            key={priceFlash}
            className="tnum mt-1 text-[24px] font-bold text-navy"
            style={{ animation: priceFlash ? "extendPop .5s ease" : undefined }}
          >
            {formatTugrug(price)}
          </div>
          <div className="mt-0.5 truncate text-[12px] text-ink-soft">
            Тэргүүлэгч: <strong className="text-navy">{leaderLabel ?? "—"}</strong>
          </div>
        </div>
        <div className="bg-white px-5 py-4">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
            Үлдсэн хугацаа
            {critical && (
              <span
                className="rounded-full px-1.5 py-0.5 text-[10px] font-bold text-crimson"
                style={{ background: "#FBEAE9", animation: "livedot 1s infinite" }}
              >
                Дуусч байна!
              </span>
            )}
            {extendFlash > 0 && !critical && (
              <span key={extendFlash} className="tnum rounded-full bg-[#FBF1DF] px-1.5 py-0.5 text-[10px] font-bold text-[#C77A0A]">
                +{ANTI_SNIPE_EXTENSION_SEC} сек
              </span>
            )}
          </div>
          <div
            className="tnum mt-1 text-[24px] font-bold"
            style={{ color: timerColor, animation: critical ? "heartbeat 1s ease-in-out infinite" : undefined }}
          >
            {status === "ended" ? "Дууссан" : fmt(timeLeft)}
          </div>
        </div>
        <div className="bg-white px-5 py-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Ажиглаж буй</div>
          <div className="tnum mt-1 text-[24px] font-bold text-navy">{spectators}</div>
          <div className="mt-0.5 text-[12px] text-ink-soft">оролцогч танхимд</div>
        </div>
      </div>

      {/* live feed (real names) */}
      <div className="border-t border-[#EBEEF3]">
        <div className="flex items-center justify-between px-5 py-2.5 text-[11px] font-bold uppercase tracking-wide text-muted">
          <span>Шууд саналын урсгал — бодит нэр</span>
          <span className="tnum">{feed.length}</span>
        </div>
        <div className="max-h-[360px] overflow-y-auto">
          {feed.map((f) => (
            <div
              key={`${f.seq}-${f.ts}`}
              className="flex items-center gap-3 border-t border-[#F1F3F6] px-5 py-2.5"
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#EEF1F5] text-[10px] font-bold text-navy">
                #{f.seq}
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-navy">{f.label}</span>
              <span className="tnum text-[13px] font-semibold text-navy">{formatTugrug(f.amount)}</span>
            </div>
          ))}
          {feed.length === 0 && (
            <div className="px-5 py-8 text-center text-[12.5px] text-muted">Одоогоор санал ирээгүй байна.</div>
          )}
        </div>
      </div>
    </div>
  );
}
