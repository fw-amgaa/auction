"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export interface NotifPreview {
  id: string;
  icon: string;
  iconBg: string;
  iconFg: string;
  title: string;
  body: string;
  createdAt: string; // ISO
  read: boolean;
}

function ago(iso: string): string {
  const d = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (d < 60) return "дөнгөж сая";
  if (d < 3600) return `${Math.floor(d / 60)} мин өмнө`;
  if (d < 86400) return `${Math.floor(d / 3600)} цаг өмнө`;
  return `${Math.floor(d / 86400)} өдрийн өмнө`;
}

export function NotificationBell({
  items,
  unread,
  arena = false,
}: {
  items: NotifPreview[];
  unread: number;
  arena?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const t = arena
    ? {
        btn: "bg-white/[0.06] text-[#C4D0E2] hover:bg-white/10",
        panel: "border-white/10 bg-[#0F131B]/95 text-[#F2F4F8] backdrop-blur-xl",
        divider: "border-white/[0.06]",
        unreadBg: "bg-white/[0.04]",
        rowHover: "hover:bg-white/[0.04]",
        muted: "text-[#8E9AAE]",
        faint: "text-[#5C6A82]",
        viewAll: "text-[#FF96A0] hover:bg-white/5",
        accent: "#E03B4B",
      }
    : {
        btn: "bg-sand text-ink hover:bg-line",
        panel: "border-line bg-white text-ink",
        divider: "border-line",
        unreadBg: "bg-sand/70",
        rowHover: "hover:bg-sand/50",
        muted: "text-ink-soft",
        faint: "text-muted",
        viewAll: "text-crimson hover:bg-sand",
        accent: "#c8312c",
      };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Мэдэгдэл"
        aria-haspopup="menu"
        aria-expanded={open}
        className={`relative grid size-9 place-items-center rounded-full transition-colors ${t.btn}`}
      >
        <span aria-hidden>🔔</span>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-crimson px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className={`absolute right-0 z-50 mt-2 w-[min(360px,calc(100vw-24px))] overflow-hidden rounded-2xl border shadow-xl ${t.panel}`}
        >
          <div className={`flex items-center justify-between border-b px-4 py-3 ${t.divider}`}>
            <span className="text-sm font-semibold">Мэдэгдэл</span>
            {unread > 0 && <span className={`text-[11.5px] ${t.muted}`}>{unread} шинэ</span>}
          </div>

          <div className="max-h-[360px] overflow-y-auto">
            {items.length === 0 ? (
              <div className={`px-4 py-12 text-center text-[13px] ${t.muted}`}>Мэдэгдэл алга байна.</div>
            ) : (
              items.map((n) => (
                <Link
                  key={n.id}
                  href="/notifications"
                  onClick={() => setOpen(false)}
                  className={`flex gap-3 border-b px-4 py-3 transition-colors ${t.divider} ${t.rowHover} ${!n.read ? t.unreadBg : ""}`}
                >
                  <span
                    className="grid size-9 shrink-0 place-items-center rounded-full text-[14px]"
                    style={{ background: n.iconBg, color: n.iconFg }}
                  >
                    {n.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[13px] font-semibold">{n.title}</span>
                      {!n.read && <span className="size-1.5 shrink-0 rounded-full" style={{ background: t.accent }} />}
                    </div>
                    <div className={`mt-0.5 line-clamp-2 text-[12px] leading-snug ${t.muted}`}>{n.body}</div>
                    <div className={`mt-1 text-[11px] ${t.faint}`}>{ago(n.createdAt)}</div>
                  </div>
                </Link>
              ))
            )}
          </div>

          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className={`block border-t px-4 py-3 text-center text-[13px] font-semibold transition-colors ${t.divider} ${t.viewAll}`}
          >
            Бүгдийг харах
          </Link>
        </div>
      )}
    </div>
  );
}
