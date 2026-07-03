"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

import { formatTugrug } from "@auction/shared";

import { AdminTopbar } from "@/components/AdminTopbar";
import { CurrencyInput } from "@/components/CurrencyInput";
import { LocalTime } from "@/components/LocalTime";
import { AdminButton } from "@/components/admin/Button";
import { Pagination } from "@/components/admin/Pagination";
import { fmtSigned, LEDGER_META, type LedgerType } from "@/lib/ledger-meta";

import { adjustLimit, type LimitAction } from "./actions";

export interface LimitRow {
  id: string;
  accountType: "individual" | "legal_entity";
  name: string;
  limit: number;
  committed: number;
  available: number;
  history: { id: string; type: LedgerType; delta: number; note: string | null; date: string }[];
}

const ACTIONS: [LimitAction, string][] = [
  ["raise", "Нэмэх"],
  ["lower", "Бууруулах"],
  ["refund", "Офлайн буцаалт"],
];

function avatar(t: string) {
  return t === "legal_entity"
    ? { bg: "#E5F0FB", fg: "#1B5FA8", label: "Хуулийн этгээд" }
    : { bg: "#E5F4EC", fg: "#1F8A5B", label: "Иргэн" };
}

const COLS = "grid grid-cols-[1.6fr_1fr_1fr_1fr_120px] gap-3";

export function LimitsManager({
  users,
  totals,
  q: initialQ,
  page,
  hasNext,
}: {
  users: LimitRow[];
  totals: { users: number; totalLimit: number; totalCommitted: number };
  q: string;
  page: number;
  hasNext: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(initialQ);
  const [selId, setSelId] = useState<string | null>(null);
  const [action, setAction] = useState<LimitAction>("raise");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const rows = users;
  const sel = users.find((u) => u.id === selId) ?? null;

  function search(value: string) {
    setQ(value);
    const next = new URLSearchParams(params.toString());
    if (value.trim()) next.set("q", value.trim());
    else next.delete("q");
    next.delete("page");
    startTransition(() => router.replace(`${pathname}?${next.toString()}`));
  }
  const pageHref = (n: number) => {
    const next = new URLSearchParams(params.toString());
    if (n > 1) next.set("page", String(n));
    else next.delete("page");
    const s = next.toString();
    return s ? `${pathname}?${s}` : pathname;
  };

  const amt = Number.parseInt(amount.replace(/\D/g, "") || "0", 10);
  const newLimit = sel ? (action === "raise" ? sel.limit + amt : Math.max(0, sel.limit - amt)) : 0;

  function open(u: LimitRow) {
    setSelId(u.id);
    setAction("raise");
    setAmount("");
    setNote("");
    setError(null);
  }
  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }
  function apply() {
    if (!sel || amt <= 0) return;
    startTransition(async () => {
      const res = await adjustLimit(sel.id, action, amt, note);
      if (res.error) setError(res.error);
      else {
        setSelId(null);
        flash(`${sel.name} — лимит шинэчлэгдлээ`);
      }
    });
  }

  return (
    <div>
      <AdminTopbar title="Лимит удирдлага">
        <input
          value={q}
          onChange={(e) => search(e.target.value)}
          placeholder="Хэрэглэгч хайх"
          className="h-[38px] w-60 rounded-[9px] border border-line-cool bg-[#F7F8FA] px-3 text-[13px] outline-none"
        />
      </AdminTopbar>

      <div className="p-6">
        <div className="mb-4 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3.5">
          {[
            ["Нийт хэрэглэгч", String(totals.users)],
            ["Олгосон нийт лимит", formatTugrug(totals.totalLimit)],
            ["Идэвхтэй барьцаа", formatTugrug(totals.totalCommitted)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-line-cool bg-white p-4">
              <div className="text-[11.5px] font-semibold text-muted">{label}</div>
              <div className="tnum mt-1.5 text-[22px] font-bold text-navy">{value}</div>
            </div>
          ))}
        </div>

        <div className="overflow-hidden rounded-2xl border border-line-cool bg-white">
          <div className={`${COLS} border-b border-[#EBEEF3] bg-[#F7F8FA] px-[18px] py-3 text-[11px] font-bold uppercase tracking-wide text-muted`}>
            <span>Хэрэглэгч</span>
            <span className="text-right">Лимит</span>
            <span className="text-right">Барьцаанд</span>
            <span className="text-right">Боломжит</span>
            <span className="text-right">Үйлдэл</span>
          </div>
          {rows.map((u) => {
            const a = avatar(u.accountType);
            return (
              <div key={u.id} className={`${COLS} items-center border-b border-[#F1F3F6] px-[18px] py-3 last:border-0`}>
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-[34px] shrink-0 place-items-center rounded-[9px] text-xs font-bold" style={{ background: a.bg, color: a.fg }}>
                    {u.name.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-[13.5px] font-semibold text-navy">{u.name}</div>
                    <div className="text-[11px] text-muted">{a.label}</div>
                  </div>
                </div>
                <span className="tnum text-right text-[13px] font-semibold text-navy">{formatTugrug(u.limit)}</span>
                <span className="tnum text-right text-[13px] text-[#C77A0A]">{formatTugrug(u.committed)}</span>
                <span className="tnum text-right text-[13px] text-[#1F8A5B]">{formatTugrug(u.available)}</span>
                <span className="flex justify-end">
                  <AdminButton variant="subtle" size="sm" onClick={() => open(u)}>
                    Удирдах
                  </AdminButton>
                </span>
              </div>
            );
          })}
          {rows.length === 0 && <div className="px-5 py-12 text-center text-[13px] text-muted">Хэрэглэгч алга.</div>}
        </div>

        <Pagination page={page} hasNext={hasNext} hrefFor={pageHref} />
      </div>

      {sel && (
        <div onClick={() => setSelId(null)} className="fixed inset-0 z-[70] flex items-center justify-center bg-navy-deep/80 p-6">
          <div onClick={(e) => e.stopPropagation()} className="max-h-[90vh] w-full max-w-[560px] overflow-y-auto rounded-2xl bg-white">
            <div className="flex items-center justify-between border-b border-[#EBEEF3] px-[22px] py-[18px]">
              <div className="flex items-center gap-3">
                <span className="grid size-[42px] place-items-center rounded-[10px] text-[15px] font-bold" style={{ background: avatar(sel.accountType).bg, color: avatar(sel.accountType).fg }}>
                  {sel.name.slice(0, 2).toUpperCase()}
                </span>
                <div>
                  <div className="text-base font-bold text-navy">{sel.name}</div>
                  <div className="text-[12px] text-muted">{avatar(sel.accountType).label}</div>
                </div>
              </div>
              <button onClick={() => setSelId(null)} className="grid size-8 place-items-center rounded-lg border border-line-cool text-ink-soft transition-colors hover:bg-[#F7F8FA]">✕</button>
            </div>

            <div className="p-[22px]">
              <div className="mb-4 flex gap-3">
                <div className="flex-1 rounded-[10px] border border-[#EBEEF3] bg-[#F7F8FA] p-3">
                  <div className="text-[11px] font-semibold text-muted">Одоогийн лимит</div>
                  <div className="tnum mt-1 text-[19px] font-bold text-navy">{formatTugrug(sel.limit)}</div>
                </div>
                <div className="flex-1 rounded-[10px] border border-[#EBEEF3] bg-[#F7F8FA] p-3">
                  <div className="text-[11px] font-semibold text-muted">Барьцаанд</div>
                  <div className="tnum mt-1 text-[19px] font-bold text-[#C77A0A]">{formatTugrug(sel.committed)}</div>
                </div>
              </div>

              <div className="mb-3.5 flex gap-1.5 rounded-[9px] border border-line-cool bg-[#F3F5F8] p-1">
                {ACTIONS.map(([k, label]) => {
                  const on = k === action;
                  return (
                    <button
                      key={k}
                      onClick={() => setAction(k)}
                      className="flex-1 rounded-md py-2 text-[13px] transition-colors"
                      style={{ background: on ? "#FFF" : "transparent", color: on ? "#14294A" : "#5B6677", fontWeight: on ? 700 : 500 }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-strong">
                {action === "refund" ? "Буцаасан дүн" : action === "lower" ? "Бууруулах дүн" : "Нэмэх дүн"}
              </label>
              <div className="mb-1.5">
                <CurrencyInput
                  value={amount}
                  onChange={setAmount}
                  placeholder="0"
                  className="tnum h-[46px] w-full rounded-[10px] border border-line-cool bg-[#FAF8F4] pl-3.5 pr-8 text-base font-semibold text-navy outline-none"
                />
              </div>
              <div className="mb-4 text-[12px] text-ink-soft">
                Шинэ лимит: <strong className="tnum text-navy">{formatTugrug(newLimit)}</strong>
              </div>

              <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-strong">Тэмдэглэл (аудитад үлдэнэ)</label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ж: Хэрэглэгчийн хүсэлтээр"
                className="mb-4 h-[42px] w-full rounded-[9px] border border-line-cool bg-[#FAF8F4] px-3 text-[13px] outline-none"
              />

              {error && <div className="mb-3 text-[12.5px] font-semibold text-crimson">{error}</div>}

              <AdminButton
                variant="success"
                onClick={apply}
                disabled={amt <= 0}
                loading={pending}
                className="w-full rounded-[10px] py-3 text-sm"
              >
                {action === "refund" ? "Буцаалт бүртгэх" : action === "lower" ? "Лимит бууруулах" : "Лимит нэмэх"}
              </AdminButton>

              {sel.history.length > 0 && (
                <div className="mt-5">
                  <div className="mb-2.5 text-[12.5px] font-bold text-navy">Лимитийн түүх</div>
                  {sel.history.map((h) => {
                    const m = LEDGER_META[h.type];
                    return (
                      <div key={h.id} className="flex items-center gap-3 border-b border-[#F1F3F6] py-2 last:border-0">
                        <span className="grid size-[26px] shrink-0 place-items-center rounded-[7px] text-[12px]" style={{ background: m.iconBg, color: m.iconFg }}>
                          {m.icon}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[12.5px] font-medium text-navy">{m.title}</div>
                          <div className="text-[11px] text-muted"><LocalTime value={h.date} mode="date" /> · {h.note ?? "—"}</div>
                        </div>
                        <span className="tnum text-[12.5px] font-semibold" style={{ color: h.delta < 0 ? "#C8312C" : "#1F8A5B" }}>
                          {fmtSigned(h.delta)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed right-5 top-5 z-[80] rounded-xl border border-[#C7E5D5] bg-[#E5F4EC] px-4 py-3 text-[13.5px] font-semibold text-[#197a50] shadow-lg">
          ✅ {toast}
        </div>
      )}
    </div>
  );
}
