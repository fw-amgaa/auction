"use client";

import { useState, useTransition } from "react";

import { LocalTime } from "@/components/LocalTime";
import { localDayKey } from "@/lib/datetime";

import { markAllRead, markRead } from "./actions";

export interface NotifItem {
  id: string;
  group: "outbid" | "result" | "auction" | "system";
  icon: string;
  iconBg: string;
  iconFg: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
}

function dayLabel(iso: string): string {
  const k = localDayKey(iso);
  const now = Date.now();
  if (k === localDayKey(now)) return "Өнөөдөр";
  if (k === localDayKey(now - 86400000)) return "Өчигдөр";
  return k;
}

const FILTERS: [string, string][] = [
  ["all", "Бүгд"],
  ["outbid", "Давсан санал"],
  ["result", "Үр дүн"],
  ["auction", "Дуудлага"],
  ["system", "Систем"],
];

export function NotificationsView({ items }: { items: NotifItem[] }) {
  const [filter, setFilter] = useState("all");
  const [, startTransition] = useTransition();

  const visible = items.filter((i) => filter === "all" || i.group === filter);
  const unread = items.filter((i) => !i.read).length;
  const days = [...new Set(visible.map((i) => dayLabel(i.createdAt)))];

  return (
    <main>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold text-navy">Мэдэгдэл</h1>
          <p className="mt-1.5 text-sm text-ink-soft">
            <strong className="text-crimson">{unread}</strong> уншаагүй мэдэгдэл байна.
          </p>
        </div>
        <button
          onClick={() => startTransition(() => markAllRead())}
          className="rounded-[9px] border border-[#CDD4DE] bg-white px-3.5 py-2 text-[13px] font-semibold text-navy hover:border-navy"
        >
          ✓ Бүгдийг уншсан болгох
        </button>
      </div>

      <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map(([k, label]) => {
          const on = k === filter;
          return (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className="shrink-0 rounded-[9px] border px-3.5 py-2 text-[13px]"
              style={{ background: on ? "#14294A" : "#FFF", color: on ? "#FFF" : "#5B6677", borderColor: on ? "#14294A" : "#E6E1D6", fontWeight: on ? 700 : 500 }}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex flex-col gap-6">
        {days.map((day) => (
          <div key={day}>
            <div className="mb-2.5 text-[12px] font-bold uppercase tracking-wide text-muted">{day}</div>
            <div className="overflow-hidden rounded-[14px] border border-line bg-white">
              {visible
                .filter((i) => dayLabel(i.createdAt) === day)
                .map((n) => (
                  <button
                    key={n.id}
                    onClick={() => !n.read && startTransition(() => markRead(n.id))}
                    className="flex w-full items-start gap-3 border-b border-[#F3EFE5] px-[18px] py-[15px] text-left last:border-0 hover:bg-[#FAF8F3]"
                    style={{ background: n.read ? "#FFF" : "#FCF6F5" }}
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-[11px]" style={{ background: n.iconBg, color: n.iconFg }}>
                      {n.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-navy" style={{ fontWeight: n.read ? 600 : 700 }}>{n.title}</span>
                        {!n.read && <span className="size-2 shrink-0 rounded-full bg-crimson" />}
                      </div>
                      <div className="mt-0.5 text-[13px] leading-relaxed text-ink-soft">{n.body}</div>
                    </div>
                    <LocalTime value={n.createdAt} mode="time" className="tnum shrink-0 text-[11.5px] text-muted" />
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>

      {visible.length === 0 && (
        <div className="mt-6 rounded-[14px] border border-dashed border-[#D8D2C4] bg-white px-5 py-14 text-center">
          <div className="text-base font-semibold text-ink-strong">Энэ төрлийн мэдэгдэл алга</div>
          <div className="mt-1.5 text-[13.5px] text-muted">Шинэ мэдэгдэл ирэхэд энд харагдана.</div>
        </div>
      )}
    </main>
  );
}
