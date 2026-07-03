"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { formatTugrug } from "@auction/shared";

import { AdminTopbar } from "@/components/AdminTopbar";
import { AdminButton } from "@/components/admin/Button";
import { Pagination } from "@/components/admin/Pagination";
import { usePermissions } from "@/components/admin/Permissions";

import { defaultWinner, generatePermit, markPaid } from "./actions";
import type { Payment, ResultRow } from "@/lib/results";

const PAY_META: Record<Payment, { label: string; bg: string; fg: string }> = {
  paid: { label: "Төлсөн", bg: "#E5F4EC", fg: "#197a50" },
  pending: { label: "Хүлээгдэж буй", bg: "#FBF1DF", fg: "#C77A0A" },
  defaulted: { label: "Төлбөргүй", bg: "#FBEAE9", fg: "#C8312C" },
};

const TABS: [string, string][] = [
  ["all", "Бүгд"],
  ["paid", "Төлсөн"],
  ["pending", "Хүлээгдэж буй"],
  ["defaulted", "Төлбөргүй"],
];

const COLS = "grid grid-cols-[90px_1.3fr_1.3fr_1fr_120px_180px] gap-3";
const PAGE_SIZE = 20;

export function ResultsManager({
  rows,
  kpis,
}: {
  rows: ResultRow[];
  kpis: { ended: number; collected: number; pending: number; permitsLeft: number };
}) {
  const [tab, setTab] = useState("all");
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { can } = usePermissions();
  const filtered = rows.filter((r) => tab === "all" || r.payment === tab);
  const hasNext = page * PAGE_SIZE < filtered.length;
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function flash(m: string) {
    setToast(m);
    setTimeout(() => setToast(null), 3000);
  }
  // `key` identifies the clicked button (`${lotId}:${action}`) so only it spins.
  const run = (key: string, fn: () => Promise<void>, msg: string) => {
    setBusy(key);
    startTransition(async () => {
      await fn();
      setBusy(null);
      flash(msg);
    });
  };

  const KPIS = [
    { label: "Дууссан лот", value: String(kpis.ended), color: "#14294A" },
    { label: "Цуглуулсан төлбөр", value: formatTugrug(kpis.collected), color: "#1F8A5B" },
    { label: "Төлбөр хүлээж буй", value: String(kpis.pending), color: "#C77A0A" },
    { label: "Эрх олгох шаардлагатай", value: String(kpis.permitsLeft), color: "#C8312C" },
  ];

  return (
    <div>
      <AdminTopbar title="Үр дүн ба экспорт">
        {can("results.export") && (
          <a
            href="/api/admin/results/export"
            className="rounded-[9px] border border-line-cool bg-white px-3.5 py-2 text-[13px] font-semibold text-navy transition-colors hover:bg-[#F3F5F8]"
          >
            ⤓ CSV татах
          </a>
        )}
      </AdminTopbar>

      <div className="p-6">
        <div className="mb-4 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3.5">
          {KPIS.map((k) => (
            <div key={k.label} className="rounded-xl border border-line-cool bg-white p-4">
              <div className="text-[11.5px] font-semibold text-muted">{k.label}</div>
              <div className="tnum mt-1.5 text-[22px] font-bold" style={{ color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>

        <div className="overflow-hidden rounded-2xl border border-line-cool bg-white">
          <div className="flex items-center justify-between border-b border-[#EBEEF3] px-[18px] py-3.5">
            <h2 className="text-[14.5px] font-bold text-navy">Дууссан дуудлагын үр дүн</h2>
            <div className="flex gap-1.5">
              {TABS.map(([k, label]) => {
                const on = k === tab;
                return (
                  <button
                    key={k}
                    onClick={() => {
                      setTab(k);
                      setPage(1);
                    }}
                    className="rounded-[7px] border px-3 py-1.5 text-[12px]"
                    style={{ background: on ? "#14294A" : "#FFF", color: on ? "#FFF" : "#5B6677", borderColor: on ? "#14294A" : "#E1E5EC", fontWeight: on ? 700 : 500 }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className={`${COLS} border-b border-[#EBEEF3] bg-[#F7F8FA] px-[18px] py-2.5 text-[11px] font-bold uppercase tracking-wide text-muted`}>
            <span>Код</span>
            <span>Зүйл</span>
            <span>Хожсон оролцогч</span>
            <span className="text-right">Хожсон үнэ</span>
            <span className="text-center">Төлбөр</span>
            <span className="text-right">Үйлдэл</span>
          </div>

          {visible.map((r) => {
            const pm = PAY_META[r.payment];
            return (
              <div key={r.lotId} className={`${COLS} items-center border-b border-[#F1F3F6] px-[18px] py-3 last:border-0`}>
                <span className="tnum text-[12.5px] font-semibold text-navy">{r.code}</span>
                <span className="truncate text-[13px] text-navy">{r.species}</span>
                <span className="truncate text-[12.5px] text-ink-strong">{r.winnerName ?? "— (санал ирээгүй)"}</span>
                <span className="tnum text-right text-[13px] font-semibold text-navy">{formatTugrug(r.price)}</span>
                <span className="flex justify-center">
                  {r.winnerUserId ? (
                    <span className="rounded-md px-2 py-1 text-[11px] font-bold" style={{ background: pm.bg, color: pm.fg }}>{pm.label}</span>
                  ) : (
                    <span className="text-[11px] text-muted">—</span>
                  )}
                </span>
                <span className="flex items-center justify-end gap-1.5">
                  {r.winnerUserId && r.payment === "pending" && (
                    <>
                      {can("results.mark_paid") && (
                        <AdminButton
                          variant="success"
                          size="sm"
                          onClick={() => run(`${r.lotId}:paid`, () => markPaid(r.lotId), "Төлбөр бүртгэгдлээ")}
                          loading={busy === `${r.lotId}:paid`}
                          disabled={pending}
                        >
                          Төлсөн
                        </AdminButton>
                      )}
                      {can("results.default") && (
                        <AdminButton
                          variant="danger"
                          size="sm"
                          onClick={() => { if (confirm("Хожигчийг төлбөргүй гэж дефолт болгож, дараагийн оролцогчид санал болгох уу?")) run(`${r.lotId}:default`, () => defaultWinner(r.lotId), "Дараагийн оролцогчид шилжүүлэв"); }}
                          loading={busy === `${r.lotId}:default`}
                          disabled={pending}
                        >
                          Дефолт
                        </AdminButton>
                      )}
                    </>
                  )}
                  {r.payment === "paid" && !r.permitIssued && can("results.permit") && (
                    <AdminButton
                      variant="success"
                      size="sm"
                      onClick={() => run(`${r.lotId}:permit`, () => generatePermit(r.lotId), "Агнуурын эрх олгогдлоо")}
                      loading={busy === `${r.lotId}:permit`}
                      disabled={pending}
                    >
                      📜 Эрх үүсгэх
                    </AdminButton>
                  )}
                  {r.permitIssued && (
                    <Link href={`/permits/${r.lotId}`} target="_blank" className="rounded-[7px] border border-[#C7E5D5] bg-[#E5F4EC] px-2.5 py-1.5 text-[12px] font-semibold text-[#197a50] transition-colors hover:bg-[#D8EFE3]">✓ Эрх харах</Link>
                  )}
                </span>
              </div>
            );
          })}
          {visible.length === 0 && <div className="px-5 py-12 text-center text-[13px] text-muted">Үр дүн алга.</div>}
        </div>

        <Pagination page={page} hasNext={hasNext} onPage={setPage} />
      </div>

      {toast && <div className="fixed right-5 top-5 z-[80] rounded-xl border border-[#C7E5D5] bg-[#E5F4EC] px-4 py-3 text-[13.5px] font-semibold text-[#197a50] shadow-lg">✅ {toast}</div>}
    </div>
  );
}
