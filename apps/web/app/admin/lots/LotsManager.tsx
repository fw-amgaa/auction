"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { CATEGORIES, type CategoryCode, formatTugrug } from "@auction/shared";

import { AdminTopbar } from "@/components/AdminTopbar";
import { CurrencyInput } from "@/components/CurrencyInput";
import { LocalTime } from "@/components/LocalTime";
import { usePermissions } from "@/components/admin/Permissions";
import { localInputToIso, toLocalInput } from "@/lib/datetime";

import {
  createLot,
  createLotsBulk,
  deleteLot,
  type LotDeleteImpact,
  lotDeleteImpact,
  type LotInput,
  updateLot,
} from "./actions";

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
  status: LotStatus;
  phase: Phase;
  startsAt: string | null;
  endsAt: string | null;
  description: string | null;
  images: string[];
}

interface CategoryOpt {
  id: string;
  code: string;
  name: string;
  defaultReserve: number | null;
}

/** category code → its codes with a taken flag */
type CodeAvailability = Record<string, { code: string; taken: boolean }[]>;

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

const COLS = "grid grid-cols-[80px_1.4fr_1fr_1.1fr_1.1fr_110px_196px] gap-3";

const PAGE_SIZE = 20;

const toInput = (d: string | null): string => toLocalInput(d);

interface FormState {
  id: string | null;
  bulk: boolean;
  categoryId: string;
  code: string; // single create/edit
  codes: string[]; // bulk create
  aimag: string;
  reserve: string;
  status: LotInput["status"];
  startsAt: string;
  endsAt: string;
  description: string;
  images: string[];
}

export function LotsManager({
  lots,
  categories,
  codeAvailability,
}: {
  lots: ManagedLot[];
  categories: CategoryOpt[];
  codeAvailability: CodeAvailability;
}) {
  const [tab, setTab] = useState("all");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [del, setDel] = useState<{ lot: ManagedLot; impact: LotDeleteImpact } | null>(null);
  const [delError, setDelError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { can } = usePermissions();

  const counts: Record<string, number> = { all: lots.length };
  for (const [k] of TABS)
    if (k !== "all") counts[k] = lots.filter((l) => l.phase === k).length;
  const filtered = lots.filter((l) => tab === "all" || l.phase === tab);
  const hasNext = page * PAGE_SIZE < filtered.length;
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const catById = (id: string) => categories.find((c) => c.id === id);
  const reserveDigits = (v: string) =>
    Number.parseInt(v.replace(/\D/g, "") || "0", 10);

  const emptyForm = (bulk: boolean): FormState => {
    const cat = categories[0];
    return {
      id: null,
      bulk,
      categoryId: cat?.id ?? "",
      code: "",
      codes: [],
      aimag: "",
      reserve: cat?.defaultReserve ? String(cat.defaultReserve) : "",
      status: "draft",
      startsAt: "",
      endsAt: "",
      description: "",
      images: [],
    };
  };

  function openCreate() {
    setError(null);
    setForm(emptyForm(false));
  }
  function openBulk() {
    setError(null);
    setForm(emptyForm(true));
  }
  function openEdit(l: ManagedLot) {
    setError(null);
    setForm({
      id: l.id,
      bulk: false,
      categoryId: l.categoryId,
      code: l.code,
      codes: [],
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

  /** When the category changes, prefill reserve and clear code selection. */
  function changeCategory(categoryId: string) {
    if (!form) return;
    const cat = catById(categoryId);
    setForm({
      ...form,
      categoryId,
      code: "",
      codes: [],
      reserve:
        form.reserve && reserveDigits(form.reserve) > 0
          ? form.reserve
          : cat?.defaultReserve
            ? String(cat.defaultReserve)
            : "",
    });
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
    const reserve = reserveDigits(form.reserve);
    const common = {
      categoryId: form.categoryId,
      aimag: form.aimag,
      reserve,
      status: form.status,
      startsAt: form.startsAt ? localInputToIso(form.startsAt) : null,
      endsAt: form.endsAt ? localInputToIso(form.endsAt) : null,
      description: form.description,
      images: form.images,
    };

    startTransition(async () => {
      if (form.bulk) {
        const res = await createLotsBulk({ ...common, codes: form.codes });
        if (res.error) setError(res.error);
        else {
          setForm(null);
          flash(`${res.created ?? 0} лот үүсгэлээ`);
        }
        return;
      }
      const input: LotInput = { ...common, code: form.code };
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

  /** Fetch what the delete would truncate, then open the warning dialog. */
  function remove(l: ManagedLot) {
    setDelError(null);
    startTransition(async () => {
      const res = await lotDeleteImpact(l.id);
      if ("error" in res) {
        setToast(null);
        alert(res.error);
        return;
      }
      setDel({ lot: l, impact: res });
    });
  }

  function confirmRemove() {
    if (!del) return;
    startTransition(async () => {
      const res = await deleteLot(del.lot.id);
      if (res.error) {
        setDelError(res.error);
        return;
      }
      setDel(null);
      flash("Лот устгагдлаа");
    });
  }

  // — derived form helpers —
  const formCat = form ? catById(form.categoryId) : undefined;
  const formCatCode = (formCat?.code ?? "") as CategoryCode | "";
  const formIncrements = formCatCode
    ? CATEGORIES[formCatCode].increments
    : null;
  const available = formCatCode ? (codeAvailability[formCatCode] ?? []) : [];
  // single-create code options: free codes, plus the current code when editing
  const singleCodeOptions = available
    .filter((c) => !c.taken || c.code === form?.code)
    .map((c) => c.code);

  return (
    <div>
      <AdminTopbar title="Лот удирдлага">
        {can("lots.create") && (
          <>
            <button
              onClick={openBulk}
              className="rounded-[9px] border border-line-cool bg-white px-4 py-2.5 text-[13.5px] font-bold text-navy hover:bg-[#F3F5F8]"
            >
              Бөөнөөр үүсгэх
            </button>
            <button
              onClick={openCreate}
              className="rounded-[9px] bg-crimson px-4 py-2.5 text-[13.5px] font-bold text-white hover:bg-crimson-hover"
            >
              + Шинэ лот
            </button>
          </>
        )}
      </AdminTopbar>

      <div className="p-6">
        <div className="mb-4 flex gap-1.5">
          {TABS.map(([k, label]) => {
            const on = k === tab;
            return (
              <button
                key={k}
                onClick={() => {
                  setTab(k);
                  setPage(1);
                }}
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
                <span className="flex items-center justify-end gap-1.5">
                  <Link
                    href={`/admin/lots/${l.id}`}
                    className="shrink-0 whitespace-nowrap rounded-[7px] border border-line-cool bg-white px-2.5 py-1.5 text-[12px] font-semibold text-crimson hover:bg-[#FBEAE9]"
                    style={
                      l.phase === "live"
                        ? { borderColor: "#E0908C" }
                        : undefined
                    }
                  >
                    {l.phase === "live" ? "Хянах" : "Дэлгэрэнгүй"}
                  </Link>
                  {can("lots.edit") && (
                    <button
                      onClick={() => openEdit(l)}
                      className="shrink-0 whitespace-nowrap rounded-[7px] border border-line-cool bg-[#F3F5F8] px-2.5 py-1.5 text-[12px] font-semibold text-navy hover:bg-[#E9EDF2]"
                    >
                      Засах
                    </button>
                  )}
                  {can("lots.delete") && (
                    <button
                      onClick={() => remove(l)}
                      title="Устгах"
                      aria-label="Лот устгах"
                      className="grid size-[30px] shrink-0 place-items-center rounded-[7px] border border-[#E0908C] bg-white text-[12px] leading-none text-crimson hover:bg-[#FBEAE9]"
                    >
                      🗑
                    </button>
                  )}
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

        {(page > 1 || hasNext) && (
          <div className="mt-4 flex items-center justify-between text-[13px]">
            <span className="text-muted">Хуудас {page}</span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-[9px] border border-line-cool px-3.5 py-2 font-medium text-ink-soft transition-colors hover:bg-white disabled:cursor-not-allowed disabled:text-[#C7CFD9]"
              >
                ← Өмнөх
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={!hasNext}
                className="rounded-[9px] border border-line-cool px-3.5 py-2 font-medium text-ink-soft transition-colors hover:bg-white disabled:cursor-not-allowed disabled:text-[#C7CFD9]"
              >
                Дараах →
              </button>
            </div>
          </div>
        )}
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
                {form.bulk
                  ? "Бөөнөөр лот үүсгэх"
                  : form.id
                    ? "Лот засах"
                    : "Шинэ лот үүсгэх"}
              </span>
              <button
                onClick={() => setForm(null)}
                className="grid size-8 place-items-center rounded-lg border border-line-cool text-ink-soft"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-2 gap-[15px] p-[22px]">
              <Field label="Ангилал" full>
                <select
                  value={form.categoryId}
                  onChange={(e) => changeCategory(e.target.value)}
                  className="h-11 w-full rounded-[9px] border border-line-cool bg-[#FAF8F4] px-3 text-sm"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>

              {/* code — single: dropdown of free codes; bulk: checkbox grid */}
              {form.bulk ? (
                <Field label="Кодууд (нэг буюу хэд хэдэн)" full>
                  {available.length === 0 ? (
                    <div className="text-[12.5px] text-muted">
                      Энэ ангилалд сул код алга.
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {available.map((c) => {
                        const on = form.codes.includes(c.code);
                        const disabled = c.taken;
                        return (
                          <button
                            key={c.code}
                            type="button"
                            disabled={disabled}
                            onClick={() =>
                              setForm({
                                ...form,
                                codes: on
                                  ? form.codes.filter((x) => x !== c.code)
                                  : [...form.codes, c.code],
                              })
                            }
                            className="tnum rounded-[9px] border-[1.5px] px-3 py-1.5 text-[12.5px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45"
                            style={{
                              background: on ? "#FBEFEE" : "#FFF",
                              borderColor: on ? "#C8312C" : "#E1E5EC",
                              color: on ? "#C8312C" : "#4A5260",
                            }}
                          >
                            {c.code}
                            {disabled ? " ·" : ""}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <div className="mt-1.5 text-[11px] text-muted">
                    Бүдгэрсэн код аль хэдийн ашиглагдсан. {form.codes.length}{" "}
                    сонгосон.
                  </div>
                </Field>
              ) : (
                <Field label="Лотын код">
                  <select
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    className="tnum h-11 w-full rounded-[9px] border border-line-cool bg-[#FAF8F4] px-3 text-sm"
                  >
                    <option value="">— код сонгох —</option>
                    {singleCodeOptions.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                </Field>
              )}

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
                  Үнийн алхам
                </div>
                <div className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">
                  {formIncrements ? (
                    <>
                      Энэ ангилалд санал бүр{" "}
                      <strong className="tnum text-navy">
                        {formatTugrug(formIncrements[0])}
                      </strong>{" "}
                      эсвэл{" "}
                      <strong className="tnum text-navy">
                        {formatTugrug(formIncrements[1])}
                      </strong>{" "}
                      нэмнэ.
                    </>
                  ) : (
                    "Ангилал сонгоно уу."
                  )}
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
                disabled={
                  pending || (form.bulk ? form.codes.length === 0 : !form.code)
                }
                className="rounded-[9px] bg-success px-5 py-2.5 text-[13.5px] font-bold text-white disabled:opacity-60"
              >
                {pending
                  ? "Хадгалж байна…"
                  : form.bulk
                    ? `${form.codes.length || ""} лот үүсгэх`
                    : form.id
                      ? "Хадгалах"
                      : "Үүсгэх"}
              </button>
            </div>
          </div>
        </div>
      )}

      {del && (
        <div
          onClick={() => setDel(null)}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-navy-deep/80 p-6"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[460px] rounded-2xl bg-white"
          >
            <div className="flex items-center justify-between border-b border-[#EBEEF3] px-[22px] py-[18px]">
              <span className="text-[17px] font-bold text-navy">
                Лот устгах
              </span>
              <button
                onClick={() => setDel(null)}
                className="grid size-8 place-items-center rounded-lg border border-line-cool text-ink-soft"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3.5 p-[22px] text-[13.5px] text-ink-soft">
              <p>
                <strong className="text-navy">
                  {del.lot.species}:{del.lot.code}
                </strong>{" "}
                лотыг бүрмөсөн устгах гэж байна.
              </p>
              {(del.impact.bids > 0 ||
                del.impact.ledger > 0 ||
                del.impact.notifications > 0 ||
                del.impact.logs > 0 ||
                del.impact.winnerName) && (
                <div className="rounded-[10px] border border-[#E0908C] bg-[#FBEAE9] p-3.5">
                  <div className="text-[12.5px] font-bold text-crimson">
                    ⚠ Дараах холбогдох өгөгдөл хамт устана:
                  </div>
                  <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-[12.5px] text-[#8A2F2B]">
                    {del.impact.winnerName && (
                      <li>
                        Ялагч: <strong>{del.impact.winnerName}</strong> —
                        ялалтын бүртгэл арилна
                      </li>
                    )}
                    {del.impact.bids > 0 && <li>Санал: {del.impact.bids}</li>}
                    {del.impact.ledger > 0 && (
                      <li>Лимитийн гүйлгээний түүх: {del.impact.ledger}</li>
                    )}
                    {del.impact.notifications > 0 && (
                      <li>Мэдэгдэл: {del.impact.notifications}</li>
                    )}
                    {del.impact.logs > 0 && (
                      <li>Аудит лог: {del.impact.logs}</li>
                    )}
                  </ul>
                </div>
              )}
              <p className="text-[12.5px]">
                Зөвхөн хэн, хэзээ, аль лотыг устгасан тухай нэг аудит бичлэг
                үлдэнэ. Энэ үйлдлийг буцаах боломжгүй.
              </p>
              {delError && (
                <p className="text-[12.5px] font-semibold text-crimson">
                  {delError}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2.5 px-[22px] pb-5">
              <button
                onClick={() => setDel(null)}
                className="rounded-[9px] border border-[#CDD4DE] bg-white px-4 py-2.5 text-[13.5px] font-semibold text-ink-soft"
              >
                Болих
              </button>
              <button
                onClick={confirmRemove}
                disabled={pending}
                className="rounded-[9px] bg-crimson px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-crimson-hover disabled:opacity-60"
              >
                {pending ? "Устгаж байна…" : "Бүрмөсөн устгах"}
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
