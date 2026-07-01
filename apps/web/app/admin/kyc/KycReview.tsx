"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { approveKyc, rejectKyc } from "@/app/admin/actions";
import { DocThumb } from "@/components/DocThumb";
import { KycBadge } from "@/components/KycBadge";

export interface Applicant {
  id: string;
  name: string;
  accountType: "individual" | "legal_entity";
  kyc: "pending" | "approved" | "rejected";
  ago: string;
  fields: { k: string; v: string }[];
  docs: { id: string; label: string; kind: string }[];
}

type KycTab = "pending" | "approved" | "rejected";

const TAB_LABELS: Record<string, string> = {
  pending: "Хүлээгдэж буй",
  approved: "Зөвшөөрсөн",
  rejected: "Татгалзсан",
};
const REASON_CHIPS = ["Зураг бүдэг/уншигдахгүй", "Мэдээлэл зөрүүтэй", "Баримт дутуу"];

function typeMeta(t: Applicant["accountType"]) {
  return t === "legal_entity"
    ? { label: "Хуулийн этгээд", fg: "#1B5FA8", bg: "#E5F0FB" }
    : { label: "Иргэн", fg: "#197a50", bg: "#E5F4EC" };
}

export function KycReview({
  applicants,
  tab,
  page,
  hasNext,
  counts,
}: {
  applicants: Applicant[];
  tab: KycTab;
  page: number;
  hasNext: boolean;
  counts: Record<KycTab, number>;
}) {
  const [selId, setSelId] = useState<string | null>(applicants[0]?.id ?? null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [viewer, setViewer] = useState<{ id: string; label: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const queue = applicants;
  const sel = applicants.find((a) => a.id === selId) ?? null;

  function doApprove(id: string) {
    startTransition(async () => {
      await approveKyc(id);
    });
  }
  function doReject(id: string) {
    if (!reason.trim()) return;
    startTransition(async () => {
      await rejectKyc(id, reason);
      setRejecting(false);
      setReason("");
    });
  }

  return (
    <div className="flex min-h-0 flex-1">
      {/* queue */}
      <div className="w-80 shrink-0 overflow-y-auto border-r border-line-cool bg-white">
        <div className="flex gap-1.5 border-b border-[#EBEEF3] p-3">
          {(["pending", "approved", "rejected"] as const).map((t) => {
            const on = t === tab;
            return (
              <Link
                key={t}
                href={`/admin/kyc?tab=${t}`}
                className="flex-1 rounded-lg border px-1 py-1.5 text-center text-xs"
                style={{
                  background: on ? "#14294A" : "#FFF",
                  color: on ? "#FFF" : "#5B6677",
                  borderColor: on ? "#14294A" : "#E1E5EC",
                  fontWeight: on ? 700 : 500,
                }}
              >
                {TAB_LABELS[t]} ({counts[t]})
              </Link>
            );
          })}
        </div>
        {queue.map((a) => {
          const m = typeMeta(a.accountType);
          const active = a.id === selId;
          return (
            <button
              key={a.id}
              onClick={() => {
                setSelId(a.id);
                setRejecting(false);
              }}
              className="flex w-full items-center gap-3 border-b border-[#F1F3F6] px-4 py-3.5 text-left hover:bg-[#F7F8FA]"
              style={{
                background: active ? "#F2F6FB" : "transparent",
                borderLeft: `3px solid ${active ? "#C8312C" : "transparent"}`,
              }}
            >
              <span
                className="grid size-9 shrink-0 place-items-center rounded-[10px] text-[13px] font-bold"
                style={{ background: m.bg, color: m.fg }}
              >
                {a.name.slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-semibold text-navy">{a.name}</div>
                <div className="mt-0.5 flex items-center gap-2">
                  <span
                    className="rounded px-1.5 py-px text-[10.5px] font-semibold"
                    style={{ background: m.bg, color: m.fg }}
                  >
                    {m.label}
                  </span>
                  <span className="text-[11px] text-muted">{a.ago}</span>
                </div>
              </div>
              {a.kyc !== "pending" && <span>{a.kyc === "approved" ? "✅" : "⛔"}</span>}
            </button>
          );
        })}
        {queue.length === 0 && (
          <div className="px-5 py-10 text-center text-[13px] text-muted">
            Энэ ангилалд хүсэлт алга.
          </div>
        )}
        {(page > 1 || hasNext) && (
          <div className="flex items-center justify-between border-t border-[#EBEEF3] px-4 py-3 text-[12.5px]">
            <span className="text-muted">Хуудас {page}</span>
            <div className="flex gap-1.5">
              {page > 1 ? (
                <Link
                  href={`/admin/kyc?tab=${tab}&page=${page - 1}`}
                  className="rounded-[7px] border border-line-cool px-2.5 py-1.5 font-medium text-ink-soft hover:bg-[#F7F8FA]"
                >
                  ← Өмнөх
                </Link>
              ) : (
                <span className="rounded-[7px] border border-line-cool px-2.5 py-1.5 font-medium text-[#C7CFD9]">← Өмнөх</span>
              )}
              {hasNext ? (
                <Link
                  href={`/admin/kyc?tab=${tab}&page=${page + 1}`}
                  className="rounded-[7px] border border-line-cool px-2.5 py-1.5 font-medium text-ink-soft hover:bg-[#F7F8FA]"
                >
                  Дараах →
                </Link>
              ) : (
                <span className="rounded-[7px] border border-line-cool px-2.5 py-1.5 font-medium text-[#C7CFD9]">Дараах →</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* detail */}
      <div className="min-w-0 flex-1 overflow-y-auto p-6">
        {!sel ? (
          <div className="text-sm text-muted">Хүсэлт сонгоно уу.</div>
        ) : (
          <div className={pending ? "opacity-70" : ""}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <span
                  className="grid size-[54px] place-items-center rounded-[13px] text-lg font-bold"
                  style={{ background: typeMeta(sel.accountType).bg, color: typeMeta(sel.accountType).fg }}
                >
                  {sel.name.slice(0, 2).toUpperCase()}
                </span>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-xl font-bold text-navy">{sel.name}</h2>
                    <KycBadge status={sel.kyc} />
                  </div>
                  <div className="mt-1 text-[12.5px] text-muted">{sel.ago} илгээсэн</div>
                </div>
              </div>
            </div>

            {/* fields */}
            <div className="mt-5 overflow-hidden rounded-xl border border-line-cool bg-white">
              <div className="border-b border-[#EBEEF3] bg-[#F7F8FA] px-4 py-3 text-[12.5px] font-bold text-navy">
                Мэдээлэл
              </div>
              <div className="grid grid-cols-2 gap-px bg-[#EBEEF3]">
                {sel.fields.map((f) => (
                  <div key={f.k} className="bg-white px-4 py-3">
                    <div className="text-[11.5px] text-muted">{f.k}</div>
                    <div className="tnum mt-0.5 text-[13.5px] font-semibold text-navy">{f.v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* documents */}
            <div className="mt-4">
              <div className="mb-2.5 text-[13px] font-bold text-navy">Хавсаргасан баримт</div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
                {sel.docs.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setViewer({ id: d.id, label: d.label })}
                    className="overflow-hidden rounded-xl border border-line-cool bg-white text-left hover:border-navy"
                  >
                    <DocThumb id={d.id} kind={d.kind} label={d.label} className="h-[108px]" />
                    <div className="px-3 py-2.5 text-[12.5px] font-semibold text-navy">{d.label}</div>
                  </button>
                ))}
                {sel.docs.length === 0 && (
                  <div className="text-[13px] text-muted">Баримт хавсаргаагүй.</div>
                )}
              </div>
            </div>

            {/* decision */}
            {sel.kyc === "pending" && (
              <div className="mt-5 rounded-xl border border-line-cool bg-white p-[18px]">
                <div className="mb-1.5 text-[13.5px] font-bold text-navy">Шийдвэр</div>
                {!rejecting ? (
                  <div>
                    <p className="mb-3.5 text-[13px] leading-relaxed text-ink-soft">
                      Баримтуудыг шалгаад баталгаажуулна уу. Зөвшөөрсний дараа өргөдөгч анхны лимит
                      авч санал өгөх боломжтой болно.
                    </p>
                    <div className="flex gap-2.5">
                      <button
                        onClick={() => doApprove(sel.id)}
                        disabled={pending}
                        className="rounded-[9px] bg-success px-5 py-3 text-sm font-bold text-white"
                      >
                        ✓ Зөвшөөрөх
                      </button>
                      <button
                        onClick={() => setRejecting(true)}
                        className="rounded-[9px] border border-[#E0908C] bg-white px-5 py-3 text-sm font-bold text-crimson"
                      >
                        ✕ Татгалзах
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="mb-2 block text-[12.5px] text-ink-soft">
                      Татгалзах шалтгаан (өргөдөгчид харагдана)
                    </label>
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Ж: Иргэний үнэмлэхний зураг бүдэг байна. Тодорхой дахин оруулна уу."
                      className="min-h-[78px] w-full resize-y rounded-[9px] border border-line bg-[#FAF8F4] px-3 py-2.5 text-[13px] outline-none"
                    />
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {REASON_CHIPS.map((c) => (
                        <button
                          key={c}
                          onClick={() => setReason(c)}
                          className="rounded-pill border border-line-cool bg-[#F3F5F8] px-3 py-1.5 text-xs text-ink-soft"
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                    <div className="mt-4 flex gap-2.5">
                      <button
                        onClick={() => doReject(sel.id)}
                        disabled={!reason.trim() || pending}
                        className="rounded-[9px] px-5 py-2.5 text-[13.5px] font-bold text-white"
                        style={{ background: reason.trim() ? "#C8312C" : "#E0A9A6" }}
                      >
                        Татгалзахыг баталгаажуулах
                      </button>
                      <button
                        onClick={() => {
                          setRejecting(false);
                          setReason("");
                        }}
                        className="rounded-[9px] border border-[#CDD4DE] bg-white px-4 py-2.5 text-[13.5px] font-semibold text-ink-soft"
                      >
                        Болих
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* doc viewer modal */}
      {viewer && (
        <div
          onClick={() => setViewer(null)}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-navy-deep/80 p-6"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white"
          >
            <div className="flex items-center justify-between border-b border-[#EBEEF3] px-4 py-3.5">
              <span className="text-sm font-bold text-navy">{viewer.label}</span>
              <button
                onClick={() => setViewer(null)}
                className="grid size-8 place-items-center rounded-lg border border-line-cool text-ink-soft"
              >
                ✕
              </button>
            </div>
            <iframe
              title={viewer.label}
              src={`/api/admin/kyc-doc/${viewer.id}`}
              className="h-[460px] w-full bg-[#EEF1F5]"
            />
          </div>
        </div>
      )}
    </div>
  );
}
