"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { type ClientMessage, formatTugrug, type ServerMessage } from "@auction/shared";

export interface LiveBoardLot {
  id: string;
  code: string;
  species: string;
  reserve: number;
  currentPrice: number | null;
  endsAt: number | null;
}

interface Row {
  id: string;
  code: string;
  species: string;
  price: number;
  leaderLabel: string | null;
  endsAt: number;
  spectators: number;
  status: "live" | "ended";
  flash: number;
}

function fmtLeft(ms: number): string {
  if (ms <= 0) return "00:00";
  const s = Math.floor(ms / 1000);
  if (s < 3600) return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  return `${Math.floor(s / 3600)}ц ${Math.floor((s % 3600) / 60)}м`;
}

/**
 * Real-time admin board over the bid WebSocket. One connection subscribes to
 * every live lot and shows prices, real leader names, countdowns and spectator
 * counts ticking live. Read-only (admins never bid). Rows link to the per-lot
 * monitor at /admin/lots/{id}.
 */
export function AdminLiveBoard({
  initial,
  ticket,
  wsBase,
}: {
  initial: LiveBoardLot[];
  ticket: string;
  wsBase: string;
}) {
  const [conn, setConn] = useState<"connecting" | "live" | "reconnecting">("connecting");
  const [now, setNow] = useState(Date.now());
  const [rows, setRows] = useState<Record<string, Row>>(() =>
    Object.fromEntries(
      initial.map((l) => [
        l.id,
        {
          id: l.id,
          code: l.code,
          species: l.species,
          price: l.currentPrice ?? l.reserve,
          leaderLabel: null,
          endsAt: l.endsAt ?? Date.now(),
          spectators: 0,
          status: "live" as const,
          flash: 0,
        },
      ]),
    ),
  );
  const wsRef = useRef<WebSocket | null>(null);
  const lotIds = useRef(initial.map((l) => l.id));

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (lotIds.current.length === 0) return;
    let closed = false;
    let retry = 0;
    let pingTimer: ReturnType<typeof setInterval> | null = null;

    const patch = (id: string, fn: (r: Row) => Row) =>
      setRows((prev) => (prev[id] ? { ...prev, [id]: fn(prev[id]!) } : prev));

    const connect = () => {
      const ws = new WebSocket(`${wsBase}/ws?ticket=${encodeURIComponent(ticket)}`);
      wsRef.current = ws;

      ws.onopen = () => {
        retry = 0;
        setConn("live");
        for (const id of lotIds.current) {
          ws.send(JSON.stringify({ t: "subscribe", lotId: id } satisfies ClientMessage));
        }
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
            patch(msg.lotId, (r) => ({
              ...r,
              price: msg.price,
              leaderLabel: msg.leaderLabel,
              endsAt: msg.endsAt,
              spectators: msg.spectators,
              status: msg.status,
            }));
            break;
          case "bid":
            patch(msg.lotId, (r) => ({
              ...r,
              price: msg.price,
              leaderLabel: msg.leaderLabel,
              endsAt: msg.endsAt,
              flash: r.flash + 1,
            }));
            break;
          case "spectators":
            patch(msg.lotId, (r) => ({ ...r, spectators: msg.count }));
            break;
          case "closed":
            patch(msg.lotId, (r) => ({
              ...r,
              status: "ended",
              price: msg.price,
              leaderLabel: msg.leaderLabel ?? r.leaderLabel,
            }));
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
  }, [ticket, wsBase]);

  const list = Object.values(rows).sort(
    (a, b) => Number(a.status === "ended") - Number(b.status === "ended") || a.endsAt - b.endsAt,
  );

  const connColor = conn === "live" ? "#1F8A5B" : "#C77A0A";
  const connText = conn === "live" ? "Шууд холбогдсон" : "Холбогдож байна…";

  return (
    <div className="overflow-hidden rounded-2xl border border-line-cool bg-white">
      <div className="flex items-center justify-between border-b border-[#EBEEF3] px-5 py-3.5">
        <h2 className="text-sm font-bold text-navy">Шууд явагдаж буй дуудлага</h2>
        <span className="flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: connColor }}>
          <span className="size-2 rounded-full" style={{ background: connColor, animation: "livedot 1.5s infinite" }} />
          {connText}
        </span>
      </div>
      <div className="grid grid-cols-[60px_1fr_auto_auto_auto_auto] gap-3 border-b border-[#EBEEF3] bg-[#F7F8FA] px-5 py-2.5 text-[11px] font-bold uppercase tracking-wide text-muted">
        <span>Код</span>
        <span>Зүйл / тэргүүлэгч</span>
        <span className="text-right">Одоогийн үнэ</span>
        <span className="text-right">Дуусахад</span>
        <span className="text-right">Ажиглаж буй</span>
        <span className="text-right">Үйлдэл</span>
      </div>
      {list.map((r) => {
        const left = r.endsAt - now;
        const urgent = r.status === "live" && left > 0 && left <= 10_000;
        return (
          <Link
            key={r.id}
            href={`/admin/lots/${r.id}`}
            className="grid grid-cols-[60px_1fr_auto_auto_auto_auto] items-center gap-3 border-b border-[#F1F3F6] px-5 py-3 last:border-0 hover:bg-[#F7F8FA]"
          >
            <span className="tnum text-[12.5px] font-semibold text-navy">{r.code}</span>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold text-navy">{r.species}</div>
              <div className="truncate text-[11.5px] text-muted">
                {r.status === "ended"
                  ? r.leaderLabel
                    ? `🔨 ${r.leaderLabel} хожлоо`
                    : "Дуусгавар болсон"
                  : r.leaderLabel
                    ? `Тэргүүлэгч: ${r.leaderLabel}`
                    : "Санал хүлээгдэж байна"}
              </div>
            </div>
            <span
              key={r.flash}
              className="tnum text-right text-[13px] font-semibold text-navy"
              style={{ animation: r.flash ? "extendPop .5s ease" : undefined }}
            >
              {formatTugrug(r.price)}
            </span>
            <span
              className="tnum text-right text-[12.5px] font-semibold"
              style={{ color: r.status === "ended" ? "#8A93A3" : urgent ? "#C8312C" : "#14294A" }}
            >
              {r.status === "ended" ? "Дууссан" : fmtLeft(left)}
            </span>
            <span className="tnum text-right text-[12.5px] text-ink-soft">{r.spectators}</span>
            <span className="text-right text-[12px] font-semibold text-crimson">Хянах →</span>
          </Link>
        );
      })}
      {list.length === 0 && (
        <div className="px-5 py-10 text-center text-[13px] text-muted">Одоогоор шууд лот алга.</div>
      )}
    </div>
  );
}
