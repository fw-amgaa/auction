"use client";

import { useState, useTransition } from "react";

import { formatTugrug } from "@auction/shared";

import { AdminTopbar } from "@/components/AdminTopbar";
import { CurrencyInput } from "@/components/CurrencyInput";
import { LocalTime } from "@/components/LocalTime";
import { localInputToIso, toLocalInput } from "@/lib/datetime";

import { createLot, deleteLot, type LotInput, updateLot } from "./actions";

type LotStatus =
  | "draft"
  | "scheduled"
  | "live"
  | "ended"
  | "settled"
  | "cancelled";

type Phase = "draft" | "upcoming" | "live" | "ended" | "cancelled" | "settled";

export interface ManagedLot {
  id: string;
  code: string;
  categoryId: string;
  species: string;
  aimag: string | null;
  reserve: number;
  step: number;
  status: LotStatus;
  phase: Phase;
  startsAt: string | null;
  endsAt: string | null;
  description: string | null;
  images: string[];
}

interface CategoryOpt {
  id: string;
  name: string;
}

const PHASE_META: Record<Phase, { label: string; bg: string; fg: string }> = {
  live: { label: "ШУУД", bg: "#FBEAE9", fg: "#C8312C" },
  upcoming: { label: "ТӨЛӨВЛӨСӨН", bg: "#E5F0FB", fg: "#1B5FA8" },
  draft: { label: "НООРОГ", bg: "#F0ECE2", fg: "#8A6D3B" },
  ended: { label: "ДУУССАН", bg: "#EEF1F5", fg: "#5B6677" },
  settled: { label: "ТӨЛӨГДСӨН", bg: "#E5F4EC", fg: "#197a50" },
  cancelled: { label: "ЦУЦЛАГДСАН", bg: "#F3F1EF", fg: "#9A6A66" },
};

const TABS: [string, string][] = [
  ["all", "Бүгд"],
  ["live", "Шууд"],
  ["upcoming", "Төлөвлөсөн"],
  ["draft", "Ноорог"],
  ["ended", "Дууссан"],
];

const COLS = "grid grid-cols-[80px_1.4fr_1fr_1.1fr_1.1fr_110px_120px] gap-3";

const toInput = (d: string | null): string => toLocalInput(d);

interface FormState {
  id: string | null;
  categoryId: string;
  code: string;
  aimag: string;
  reserve: string;
  status: LotInput["status"];
  startsAt: string;
  endsAt: string;
  description: string;
  images: string[];
}

const emptyForm = (categoryId: string): FormState => ({
  id: null,
  categoryId,
  code: "",
  aimag: "",
  reserve: "",
  status: "draft",
  startsAt: "",
  endsAt: "",
  description: "",
  images: [],
});

export function LotsManager({
  lots,
  categories,
}: {
  lots: ManagedLot[];
  categories: CategoryOpt[];
}) {
  const [tab, setTab] = useState("all");
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();

  const counts: Record<string, number> = { all: lots.length };
  for (const [k] of TABS)
    if (k !== "all") counts[k] = lots.filter((l) => l.phase === k).length;
  const rows = lots.filter((l) => tab === "all" || l.phase === tab);

  function openCreate() {
    setError(null);
    setForm(emptyForm(categories[0]?.id ?? ""));
  }
  function openEdit(l: ManagedLot) {
    setError(null);
    setForm({
      id: l.id,
      categoryId: l.categoryId,
      code: l.code,
      aimag: l.aimag ?? "",
      reserve: String(l.reserve),
      // the form only controls publish state: draft vs published(scheduled)
      status: (l.status === "draft"
        ? "draft"
        : "scheduled") as LotInput["status"],
      startsAt: toInput(l.startsAt),
      endsAt: toInput(l.endsAt),
      description: l.description ?? "",
      images: l.images ?? [],
    });
  }
  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function uploadImages(files: FileList | null) {
    if (!files || files.length === 0 || !form) return;
    setUploading(true);
    try {
      const fd = new FormData();
      for (const f of Array.from(files)) fd.append("files", f);
      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: fd,
      });
      const data = (await res.json()) as { keys: string[] };
      setForm((f) => (f ? { ...f, images: [...f.images, ...data.keys] } : f));
    } finally {
      setUploading(false);
    }
  }

  function save() {
    if (!form) return;
    const input: LotInput = {
      categoryId: form.categoryId,
      code: form.code,
      aimag: form.aimag,
      reserve: Number.parseInt(form.reserve.replace(/\D/g, "") || "0", 10),
      status: form.status,
      startsAt: form.startsAt ? localInputToIso(form.startsAt) : null,
      endsAt: form.endsAt ? localInputToIso(form.endsAt) : null,
      description: form.description,
      images: form.images,
    };
    startTransition(async () => {
      const res = form.id
        ? await updateLot(form.id, input)
        : await createLot(input);
      if (res.error) setError(res.error);
      else {
        setForm(null);
        flash(form.id ? "Лот шинэчлэгдлээ" : "Лот үүсгэлээ");
      }
    });
  }

  function remove(l: ManagedLot) {
    if (
      !confirm(
        `${l.species}:${l.code} лотыг бүрмөсөн устгах уу? Энэ үйлдлийг буцаах боломжгүй.`,
      )
    )
      return;
    startTransition(async () => {
      await deleteLot(l.id);
      flash("Лот устгагдлаа");
    });
  }

  const reserveN = form
    ? Number.parseInt(form.reserve.replace(/\D/g, "") || "0", 10)
    : 0;

  return (
    <div>
      <AdminTopbar title="Лот удирдлага">
        <button
          onClick={openCreate}
          className="rounded-[9px] bg-crimson px-4 py-2.5 text-[13.5px] font-bold text-white hover:bg-crimson-hover"
        >
          + Шинэ лот
        </button>
      </AdminTopbar>

      <div className="p-6">
        <div className="mb-4 flex gap-1.5">
          {TABS.map(([k, label]) => {
            const on = k === tab;
            return (
              <button
                key={k}
                onClick={() => setTab(k)}
                className="rounded-lg border px-3.5 py-2 text-[13px]"
                style={{
                  background: on ? "#14294A" : "#FFF",
                  color: on ? "#FFF" : "#5B6677",
                  borderColor: on ? "#14294A" : "#E1E5EC",
                  fontWeight: on ? 700 : 500,
                }}
              >
                {label} ({counts[k] ?? 0})
              </button>
            );
          })}
        </div>

        <div className="overflow-hidden rounded-2xl border border-line-cool bg-white">
          <div
            className={`${COLS} border-b border-[#EBEEF3] bg-[#F7F8FA] px-[18px] py-3 text-[11px] font-bold uppercase tracking-wide text-muted`}
          >
            <span>Код</span>
            <span>Зүйл / аймаг</span>
            <span>Эхлэх</span>
            <span>Дуусах</span>
            <span className="text-right">Босго үнэ</span>
            <span className="text-center">Төлөв</span>
            <span className="text-right">Үйлдэл</span>
          </div>
          {rows.map((l) => {
            const st = PHASE_META[l.phase];
            return (
              <div
                key={l.id}
                className={`${COLS} items-center border-b border-[#F1F3F6] px-[18px] py-3 last:border-0`}
              >
                <span className="tnum text-[12.5px] font-semibold text-navy">
                  {l.code}
                </span>
                <div className="flex min-w-0 items-center gap-2.5">
                  {l.images[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/media?key=${encodeURIComponent(l.images[0])}`}
                      alt=""
                      className="size-8 shrink-0 rounded-md object-cover"
                    />
                  ) : (
                    <span
                      className="size-8 shrink-0 rounded-md"
                      style={{
                        backgroundImage:
                          "repeating-linear-gradient(135deg,#26405F 0 7px,#1F3753 7px 14px)",
                      }}
                    />
                  )}
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold text-navy">
                      {l.species}
                    </div>
                    <div className="text-[11px] text-muted">
                      {l.aimag ?? "—"}
                    </div>
                  </div>
                </div>
                <LocalTime
                  value={l.startsAt}
                  mode="short"
                  className="tnum text-[12px] text-ink-soft"
                />
                <LocalTime
                  value={l.endsAt}
                  mode="short"
                  className="tnum text-[12px] text-ink-soft"
                />
                <span className="tnum text-right text-[13px] font-semibold text-navy">
                  {formatTugrug(l.reserve)}
                </span>
                <span className="flex justify-center">
                  <span
                    className="rounded-md px-2 py-1 text-[11px] font-bold"
                    style={{ background: st.bg, color: st.fg }}
                  >
                    {st.label}
                  </span>
                </span>
                <span className="flex justify-end gap-1.5">
                  <button
                    onClick={() => openEdit(l)}
                    className="rounded-[7px] border border-line-cool bg-[#F3F5F8] px-2.5 py-1.5 text-[12px] font-semibold text-navy"
                  >
                    Засах
                  </button>
                  <button
                    onClick={() => remove(l)}
                    title="Устгах"
                    className="grid size-[30px] place-items-center rounded-[7px] border border-[#E0908C] bg-white text-[12px] text-crimson hover:bg-[#FBEAE9]"
                  >
                    🗑
                  </button>
                </span>
              </div>
            );
          })}
          {rows.length === 0 && (
            <div className="px-5 py-12 text-center text-[13px] text-muted">
              Лот алга.
            </div>
          )}
        </div>
      </div>

      {form && (
        <div
          onClick={() => setForm(null)}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-navy-deep/80 p-6"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[92vh] w-full max-w-[560px] overflow-y-auto rounded-2xl bg-white"
          >
            <div className="flex items-center justify-between border-b border-[#EBEEF3] px-[22px] py-[18px]">
              <span className="text-[17px] font-bold text-navy">
                {form.id ? "Лот засах" : "Шинэ лот үүсгэх"}
              </span>
              <button
                onClick={() => setForm(null)}
                className="grid size-8 place-items-center rounded-lg border border-line-cool text-ink-soft"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-2 gap-[15px] p-[22px]">
              <Field label="Зүйл" full>
                <select
                  value={form.categoryId}
                  onChange={(e) =>
                    setForm({ ...form, categoryId: e.target.value })
                  }
                  className="h-11 w-full rounded-[9px] border border-line-cool bg-[#FAF8F4] px-3 text-sm"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Лотын код">
                <input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="U13"
                  className="tnum h-11 w-full rounded-[9px] border border-line-cool bg-[#FAF8F4] px-3 text-sm outline-none"
                />
              </Field>
              <Field label="Аймаг">
                <input
                  value={form.aimag}
                  onChange={(e) => setForm({ ...form, aimag: e.target.value })}
                  placeholder="Баян-Өлгий"
                  className="h-11 w-full rounded-[9px] border border-line-cool bg-[#FAF8F4] px-3 text-sm outline-none"
                />
              </Field>
              <Field label="Босго үнэ (₮)">
                <CurrencyInput
                  value={form.reserve}
                  onChange={(v) => setForm({ ...form, reserve: v })}
                  placeholder="5,300,000"
                />
              </Field>
              <Field label="Төлөв">
                <select
                  value={form.status === "draft" ? "draft" : "scheduled"}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      status: e.target.value as LotInput["status"],
                    })
                  }
                  className="h-11 w-full rounded-[9px] border border-line-cool bg-[#FAF8F4] px-3 text-sm"
                >
                  <option value="draft">Ноорог (нийтлээгүй)</option>
                  <option value="scheduled">Нийтэлсэн</option>
                </select>
                <div className="mt-1.5 text-[11px] text-muted">
                  Шууд / дууссан төлөв нь огнооноос автоматаар тодорхойлогдоно.
                </div>
              </Field>
              <Field label="Эхлэх огноо">
                <input
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(e) =>
                    setForm({ ...form, startsAt: e.target.value })
                  }
                  className="h-11 w-full rounded-[9px] border border-line-cool bg-[#FAF8F4] px-3 text-sm outline-none"
                />
              </Field>
              <Field label="Дуусах огноо">
                <input
                  type="datetime-local"
                  value={form.endsAt}
                  onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                  className="h-11 w-full rounded-[9px] border border-line-cool bg-[#FAF8F4] px-3 text-sm outline-none"
                />
              </Field>
              <Field label="Тайлбар" full>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  rows={2}
                  className="w-full resize-y rounded-[9px] border border-line-cool bg-[#FAF8F4] px-3 py-2 text-sm outline-none"
                />
              </Field>

              {/* images */}
              <Field label="Зураг" full>
                <div className="flex flex-wrap items-center gap-2.5">
                  {form.images.map((key) => (
                    <div key={key} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/media?key=${encodeURIComponent(key)}`}
                        alt=""
                        className="size-16 rounded-lg border border-line-cool object-cover"
                      />
                      <button
                        onClick={() =>
                          setForm({
                            ...form,
                            images: form.images.filter((k) => k !== key),
                          })
                        }
                        className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-crimson text-[10px] text-white"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <label className="grid size-16 cursor-pointer place-items-center rounded-lg border-[1.5px] border-dashed border-line-cool bg-[#FAF8F4] text-xl text-muted">
                    {uploading ? "…" : "+"}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => uploadImages(e.target.files)}
                      className="hidden"
                    />
                  </label>
                </div>
              </Field>

              <div className="col-span-2 rounded-[10px] border border-[#EBEEF3] bg-[#F7F8FA] p-3.5">
                <div className="text-[12px] font-bold text-navy">
                  Үнийн алхмын зурвас
                </div>
                <div className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">
                  Алхам = босго үнийн 10% ={" "}
                  <strong className="tnum text-navy">
                    {reserveN ? formatTugrug(Math.round(reserveN * 0.1)) : "—"}
                  </strong>
                  . Нэг саналд +1…+5 алхам (дээд тал нь 50%,{" "}
                  <strong className="tnum text-navy">
                    {reserveN ? formatTugrug(Math.round(reserveN * 0.5)) : "—"}
                  </strong>
                  ).
                </div>
              </div>
              {error && (
                <div className="col-span-2 text-[12.5px] font-semibold text-crimson">
                  {error}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2.5 px-[22px] pb-5">
              <button
                onClick={() => setForm(null)}
                className="rounded-[9px] border border-[#CDD4DE] bg-white px-4 py-2.5 text-[13.5px] font-semibold text-ink-soft"
              >
                Болих
              </button>
              <button
                onClick={save}
                disabled={pending}
                className="rounded-[9px] bg-success px-5 py-2.5 text-[13.5px] font-bold text-white disabled:opacity-60"
              >
                {pending ? "Хадгалж байна…" : form.id ? "Хадгалах" : "Үүсгэх"}
              </button>
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

function Field({
  label,
  full,
  children,
}: {
  label: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-strong">
        {label}
      </label>
      {children}
    </div>
  );
}
