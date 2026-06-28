"use client";

import { useState } from "react";

import { fmtSigned, LEDGER_META, type LedgerType } from "@/lib/ledger-meta";

export interface LedgerRow {
  id: string;
  type: LedgerType;
  delta: number;
  note: string | null;
  date: string;
}

const FILTERS: [string, string][] = [
  ["all", "Бүгд"],
  ["income", "Орлого"],
  ["hold", "Барьцаа"],
  ["release", "Буцаалт"],
  ["consume", "Зарцуулалт"],
];

export function BalanceLedger({ entries }: { entries: LedgerRow[] }) {
  const [filter, setFilter] = useState("all");
  const rows = entries.filter((e) => filter === "all" || LEDGER_META[e.type].group === filter);

  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3.5 border-b border-[#EFEBE1] px-[22px] py-[18px]">
        <h2 className="text-lg font-bold text-navy">Гүйлгээний түүх</h2>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map(([k, label]) => {
            const on = k === filter;
            return (
              <button
                key={k}
                onClick={() => setFilter(k)}
                className="rounded-lg border px-3 py-1.5 text-[12.5px]"
                style={{
                  background: on ? "#14294A" : "#FFF",
                  color: on ? "#FFF" : "#5B6677",
                  borderColor: on ? "#14294A" : "#E6E1D6",
                  fontWeight: on ? 600 : 500,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
      {rows.map((e) => {
        const m = LEDGER_META[e.type];
        return (
          <div key={e.id} className="flex items-center gap-3.5 border-b border-[#F3EFE5] px-[22px] py-[15px] last:border-0">
            <span
              className="grid size-[38px] shrink-0 place-items-center rounded-[10px] text-base"
              style={{ background: m.iconBg, color: m.iconFg }}
            >
              {m.icon}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-navy">{m.title}</div>
              <div className="mt-0.5 text-[12px] text-muted">{e.note ?? "—"}</div>
            </div>
            <div className="text-right">
              <div
                className="tnum text-[14.5px] font-bold"
                style={{ color: e.delta < 0 ? "#A02622" : "#1F8A5B" }}
              >
                {fmtSigned(e.delta)}
              </div>
              <div className="mt-0.5 text-[11.5px] text-muted">{e.date}</div>
            </div>
          </div>
        );
      })}
      {rows.length === 0 && (
        <div className="px-5 py-11 text-center text-[13.5px] text-muted">
          Энэ төрлийн гүйлгээ алга байна.
        </div>
      )}
    </div>
  );
}
