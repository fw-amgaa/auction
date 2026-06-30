"use client";

import { useState } from "react";

import { LocalTime } from "@/components/LocalTime";
import { actionLabel } from "@/lib/audit-actions";

export interface AuditEntry {
  id: string;
  createdAt: string; // ISO
  actorEmail: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  targetLabel: string | null;
  meta: Record<string, unknown>;
}

const COLS = "grid grid-cols-[150px_1.2fr_1.3fr_1.3fr_28px] gap-3";

export function AuditTable({ rows }: { rows: AuditEntry[] }) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="overflow-hidden rounded-2xl border border-line-cool bg-white">
      <div
        className={`${COLS} border-b border-[#EBEEF3] bg-[#F7F8FA] px-[18px] py-3 text-[11px] font-bold uppercase tracking-wide text-muted`}
      >
        <span>Огноо</span>
        <span>Админ</span>
        <span>Үйлдэл</span>
        <span>Бай</span>
        <span />
      </div>

      {rows.map((r) => {
        const isOpen = open === r.id;
        const hasMeta = r.meta && Object.keys(r.meta).length > 0;
        const expandable = hasMeta || !!r.targetId;
        return (
          <div key={r.id} className="border-b border-[#F1F3F6] last:border-0">
            <button
              type="button"
              onClick={() => expandable && setOpen(isOpen ? null : r.id)}
              className={`${COLS} w-full items-center px-[18px] py-2.5 text-left text-[13px] transition-colors ${
                expandable ? "hover:bg-[#F7F8FA]" : "cursor-default"
              }`}
            >
              <LocalTime value={r.createdAt} mode="datetime" className="tnum text-ink-soft" />
              <span className="truncate text-navy">{r.actorEmail ?? "систем"}</span>
              <span className="truncate font-medium text-ink-strong" title={r.action}>
                {actionLabel(r.action)}
              </span>
              <span className="tnum truncate text-muted">
                {r.targetLabel ?? (r.targetType ? `${r.targetType}:${r.targetId?.slice(0, 8)}` : "—")}
              </span>
              <span className="text-center text-muted">
                {expandable ? (isOpen ? "▾" : "▸") : ""}
              </span>
            </button>

            {isOpen && (
              <div className="border-t border-[#F1F3F6] bg-[#FAFBFC] px-[18px] py-3 text-[12.5px]">
                <div className="grid gap-1.5 sm:grid-cols-2">
                  <Field label="Үйлдлийн код" value={r.action} mono />
                  {r.targetType && <Field label="Бай төрөл" value={r.targetType} />}
                  {r.targetId && <Field label="Бай ID" value={r.targetId} mono />}
                  {r.targetLabel && <Field label="Бай" value={r.targetLabel} />}
                </div>
                {hasMeta && (
                  <div className="mt-3">
                    <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted">
                      Дэлгэрэнгүй
                    </div>
                    <pre className="overflow-x-auto rounded-lg border border-line-cool bg-white p-3 text-[12px] leading-relaxed text-ink-strong">
                      {JSON.stringify(r.meta, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {rows.length === 0 && (
        <div className="px-5 py-12 text-center text-[13px] text-muted">
          Тохирох бичлэг алга. Шүүлтүүрээ өөрчилнө үү.
        </div>
      )}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex gap-2">
      <span className="shrink-0 text-muted">{label}:</span>
      <span className={`min-w-0 break-all text-ink-strong ${mono ? "font-mono text-[12px]" : ""}`}>
        {value}
      </span>
    </div>
  );
}
