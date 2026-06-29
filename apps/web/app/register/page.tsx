"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";

import { CATEGORIES, CATEGORY_CODES } from "@auction/shared";

import { Logo } from "@/components/Logo";
import { ACCOUNT_DOCS } from "@/lib/docs";

import { registerAction, type RegisterState } from "./actions";

type AccountType = "individual" | "legal_entity";

interface FieldDef {
  key: string;
  label: string;
  ph: string;
  full?: boolean;
  type?: "text" | "password" | "email";
}

const TERMS_VERSION = "v2.3";
const TERMS_LABEL = "v2.3 · 2026-01";

const INDIVIDUAL_FIELDS: FieldDef[] = [
  { key: "surname", label: "Овог", ph: "Овог" },
  { key: "givenName", label: "Нэр", ph: "Нэр" },
  { key: "registryNumber", label: "Регистрийн дугаар", ph: "АА00000000", full: true },
  { key: "phone", label: "Утасны дугаар", ph: "99xxxxxx" },
  { key: "email", label: "И-мэйл хаяг", ph: "name@mail.mn", type: "email" },
  { key: "address", label: "Гэрийн хаяг", ph: "Аймаг/хот, дүүрэг, хороо", full: true },
  { key: "password", label: "Нууц үг", ph: "Дор хаяж 8 тэмдэгт", type: "password" },
  { key: "passwordConfirm", label: "Нууц үг давтах", ph: "Дахин оруулна уу", type: "password" },
];

const LEGAL_FIELDS: FieldDef[] = [
  { key: "registeredName", label: "Байгууллагын нэр", ph: "ХХК-ийн нэр", full: true },
  { key: "stateCertNumber", label: "Улсын бүртгэлийн дугаар", ph: "9 оронтой" },
  { key: "registryNumber", label: "Регистрийн дугаар (ТТД)", ph: "7 оронтой" },
  { key: "directorName", label: "Захирлын овог нэр", ph: "Бүтэн нэр", full: true },
  { key: "phone", label: "Холбоо барих утас", ph: "99xxxxxx" },
  { key: "email", label: "И-мэйл хаяг", ph: "company@mail.mn", type: "email" },
  { key: "address", label: "Хаяг", ph: "Аймаг/хот, дүүрэг, хороо", full: true },
  { key: "password", label: "Нууц үг", ph: "Дор хаяж 8 тэмдэгт", type: "password" },
  { key: "passwordConfirm", label: "Нууц үг давтах", ph: "Дахин оруулна уу", type: "password" },
];

const DOCS = ACCOUNT_DOCS;

const STEP_DEFS = [
  { n: 1, title: "Бүртгэлийн төрөл", hint: "Иргэн / Хуулийн этгээд" },
  { n: 2, title: "Хувийн мэдээлэл", hint: "Үндсэн талбарууд" },
  { n: 3, title: "Бичиг баримт", hint: "Баталгаажуулах файл" },
  { n: 4, title: "Шифр сонгох", hint: "Угалз / Тэх" },
  { n: 5, title: "Баталгаажуулалт", hint: "Нягтлаад илгээх" },
];

function fieldDefs(type: AccountType) {
  return type === "legal_entity" ? LEGAL_FIELDS : INDIVIDUAL_FIELDS;
}

function validateField(key: string, val: string, all: Record<string, string>): string | null {
  if (!val.trim()) return "Заавал бөглөнө";
  if (key === "email" && !/.+@.+\..+/.test(val)) return "И-мэйл буруу байна";
  if (key === "phone" && val.replace(/\D/g, "").length < 8) return "Утас буруу байна";
  if (key === "password" && val.length < 8) return "Дор хаяж 8 тэмдэгт";
  if (key === "passwordConfirm" && val !== all.password) return "Нууц үг таарахгүй байна";
  return null;
}

export default function RegisterPage() {
  const [state, formAction, pending] = useActionState<RegisterState, FormData>(registerAction, {});
  const [step, setStep] = useState(1);
  const [type, setType] = useState<AccountType | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [docs, setDocs] = useState<Record<string, File>>({});
  const [codes, setCodes] = useState<string[]>([]);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [touched, setTouched] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [terms, setTerms] = useState<{ version: string; body: string } | null>(null);
  const [showToast, setShowToast] = useState(false);

  // when the server confirms creation, jump to the success step + flash a toast
  useEffect(() => {
    if (state.ok) {
      setStep(6);
      setShowToast(true);
      const t = setTimeout(() => setShowToast(false), 8000);
      return () => clearTimeout(t);
    }
  }, [state.ok]);

  function openTerms() {
    setShowTerms(true);
    if (!terms) {
      fetch("/api/terms")
        .then((r) => r.json())
        .then((t) => setTerms({ version: t.version, body: t.body }))
        .catch(() => setTerms({ version: TERMS_VERSION, body: "Үйлчилгээний нөхцөл ачаалахад алдаа гарлаа." }));
    }
  }

  const set = (k: string, v: string) => setValues((s) => ({ ...s, [k]: v }));
  const toggleCode = (code: string) =>
    setCodes((cs) => (cs.includes(code) ? cs.filter((c) => c !== code) : [...cs, code]));

  const detailsValid = (): boolean => {
    if (!type) return false;
    return fieldDefs(type).every((f) => !validateField(f.key, values[f.key] ?? "", values));
  };
  const docsValid = (): boolean =>
    !!type && DOCS[type].every((d) => docs[d.key]);
  const codesValid = (): boolean => codes.length > 0;

  function next() {
    if (step === 1 && !type) return;
    if (step === 2) {
      if (!detailsValid()) {
        setTouched(true);
        return;
      }
    }
    if (step === 3 && !docsValid()) return;
    if (step === 4 && !codesValid()) return;
    if (step === 5) {
      if (!agreed || !type || !codesValid()) return;
      const fd = new FormData();
      fd.set("accountType", type);
      fd.set("termsVersion", TERMS_VERSION);
      for (const f of fieldDefs(type)) {
        if (f.key !== "passwordConfirm") fd.set(f.key, values[f.key] ?? "");
      }
      for (const d of DOCS[type]) {
        const file = docs[d.key];
        if (file) fd.set(d.key, file);
      }
      for (const c of codes) fd.append("codes", c);
      formAction(fd);
      return;
    }
    setStep((s) => Math.min(6, s + 1));
    setTouched(false);
  }

  function handleFile(key: string, file: File | null | undefined) {
    if (!file) return;
    setDocs((s) => ({ ...s, [key]: file }));
    setDragKey(null);
  }

  const stepCounter = `Алхам ${step} / 5`;
  const nextText = step === 5 ? "Хүсэлт илгээх" : "Үргэлжлүүлэх";
  const nextEnabled =
    step === 1
      ? !!type
      : step === 3
        ? docsValid()
        : step === 4
          ? codesValid()
          : step === 5
            ? agreed && codesValid() && !pending
            : true;

  return (
    <div className="min-h-screen bg-sand text-ink-strong">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <Link href="/">
            <Logo height={30} />
          </Link>
          <div className="text-sm text-ink-soft">
            Бүртгэлтэй юу?{" "}
            <Link href="/login" className="font-semibold text-crimson">
              Нэвтрэх
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-5xl items-start gap-9 px-6 py-9">
        {/* progress sidebar */}
        <aside className="sticky top-9 hidden w-60 shrink-0 md:block">
          <h1 className="text-xl font-bold text-navy">Бүртгүүлэх</h1>
          <p className="mt-1 mb-6 text-sm leading-relaxed text-ink-soft">
            Дуудлага худалдаанд оролцохын тулд бүртгэл үүсгэж баталгаажуулна.
          </p>
          <ol className="flex flex-col">
            {STEP_DEFS.map((d, i) => {
              const done = step > d.n;
              const active = step === d.n;
              return (
                <li key={d.n} className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <span
                      className="grid size-7 place-items-center rounded-full border text-xs font-bold"
                      style={{
                        background: done ? "#1F8A5B" : active ? "#14294A" : "#FFF",
                        color: done || active ? "#FFF" : "#A2AAB6",
                        borderColor: done ? "#1F8A5B" : active ? "#14294A" : "#D8D2C4",
                      }}
                    >
                      {done ? "✓" : d.n}
                    </span>
                    {i < STEP_DEFS.length - 1 && (
                      <span
                        className="h-8 w-0.5"
                        style={{ background: done ? "#1F8A5B" : "#E6E1D6" }}
                      />
                    )}
                  </div>
                  <div className="pb-4 pt-0.5">
                    <div
                      className="text-sm font-semibold"
                      style={{ color: done || active ? "#14294A" : "#A2AAB6" }}
                    >
                      {d.title}
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted">{d.hint}</div>
                  </div>
                </li>
              );
            })}
          </ol>
        </aside>

        {/* form card */}
        <div className="min-w-0 flex-1 rounded-2xl border border-line bg-white p-8 shadow-sm">
          {/* STEP 1 */}
          {step === 1 && (
            <div>
              <h2 className="text-xl font-bold text-navy">Бүртгэлийн төрөл</h2>
              <p className="mt-1 mb-6 text-sm text-ink-soft">
                Та хувь хүн үү, эсвэл байгууллагын нэрийн өмнөөс оролцох уу?
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {(
                  [
                    ["individual", "Иргэн", "Хувь хүний нэр дээр бүртгүүлж, өөрийн нэрийн өмнөөс оролцоно."],
                    ["legal_entity", "Хуулийн этгээд", "Компани, байгууллагын нэрийн өмнөөс эрх бүхий төлөөлөгч оролцоно."],
                  ] as const
                ).map(([val, title, desc]) => {
                  const on = type === val;
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setType(val)}
                      className="rounded-2xl border-[1.5px] p-5 text-left transition-colors"
                      style={{ background: on ? "#FBEFEE" : "#FFF", borderColor: on ? "#C8312C" : "#E6E1D6" }}
                    >
                      <div className="text-base font-bold text-navy">{title}</div>
                      <div className="mt-1 text-xs leading-relaxed text-ink-soft">{desc}</div>
                      <div
                        className="mt-3 flex items-center gap-2 text-xs font-semibold"
                        style={{ color: on ? "#C8312C" : "#8A93A3" }}
                      >
                        <span
                          className="grid size-[18px] place-items-center rounded-full border-[1.5px]"
                          style={{ borderColor: on ? "#C8312C" : "#CDD4DE", background: on ? "#C8312C" : "#FFF", color: "#fff" }}
                        >
                          {on ? "✓" : ""}
                        </span>
                        {on ? "Сонгогдсон" : "Сонгох"}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && type && (
            <div>
              <h2 className="text-xl font-bold text-navy">
                {type === "legal_entity" ? "Байгууллагын мэдээлэл" : "Хувийн мэдээлэл"}
              </h2>
              <p className="mt-1 mb-6 text-sm text-ink-soft">
                Бүх талбарыг үнэн зөв бөглөнө үү. Эдгээр нь баталгаажуулалтад ашиглагдана.
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {fieldDefs(type).map((f) => {
                  const val = values[f.key] ?? "";
                  const err = touched ? validateField(f.key, val, values) : null;
                  return (
                    <div key={f.key} className={f.full ? "sm:col-span-2" : ""}>
                      <label className="mb-1.5 block text-xs font-semibold text-ink-strong">
                        {f.label} <span className="text-crimson">*</span>
                      </label>
                      <input
                        type={f.type ?? "text"}
                        value={val}
                        onChange={(e) => set(f.key, e.target.value)}
                        placeholder={f.ph}
                        className="h-11 w-full rounded-[9px] border bg-[#FAF8F4] px-3.5 text-sm outline-none focus:border-navy"
                        style={{ borderColor: err ? "#E0908C" : "#E6E1D6" }}
                      />
                      {err && <div className="mt-1.5 text-[11px] text-crimson">{err}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && type && (
            <div>
              <h2 className="text-xl font-bold text-navy">Бичиг баримт</h2>
              <p className="mt-1 mb-6 text-sm text-ink-soft">
                Доорх баримтуудыг зураг эсвэл PDF хэлбэрээр оруулна уу. Тодорхой, бүрэн уншигдахуйц
                байх ёстой.
              </p>
              <div className="flex flex-col gap-4">
                {DOCS[type].map((d) => {
                  const file = docs[d.key];
                  const dragging = dragKey === d.key;
                  return (
                    <div key={d.key}>
                      <div className="mb-2 text-sm font-semibold text-ink-strong">
                        {d.label} <span className="text-crimson">*</span>
                      </div>
                      {!file ? (
                        <label
                          onDragOver={(e) => {
                            e.preventDefault();
                            if (dragKey !== d.key) setDragKey(d.key);
                          }}
                          onDragLeave={(e) => {
                            e.preventDefault();
                            setDragKey(null);
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            handleFile(d.key, e.dataTransfer.files?.[0]);
                          }}
                          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-[1.5px] border-dashed p-7 text-center"
                          style={{
                            borderColor: dragging ? "#C8312C" : "#D2CCBE",
                            background: dragging ? "#FBEFEE" : "#FAF8F4",
                          }}
                        >
                          <span className="text-sm font-semibold text-navy">
                            Файлаа чирч оруулах эсвэл <span className="text-crimson">сонгох</span>
                          </span>
                          <span className="text-[11px] text-muted">
                            JPG, PNG эсвэл PDF · дээд тал нь 10MB
                          </span>
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            onChange={(e) => handleFile(d.key, e.target.files?.[0])}
                            className="hidden"
                          />
                        </label>
                      ) : (
                        <div className="flex items-center gap-3 rounded-xl border border-[#C7E5D5] bg-[#F2FAF6] px-4 py-3.5">
                          <span className="grid size-11 shrink-0 place-items-center rounded-[9px] bg-[#E5F0FB] text-navy">
                            {/^image\//.test(file.type) ? "🖼" : "PDF"}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold text-navy">{file.name}</div>
                            <div className="mt-0.5 text-[11px] text-success">
                              ✓ Орууллаа ·{" "}
                              {file.size < 1024 * 1024
                                ? `${Math.round(file.size / 1024)} KB`
                                : `${(file.size / 1048576).toFixed(1)} MB`}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setDocs((s) => {
                                const n = { ...s };
                                delete n[d.key];
                                return n;
                              })
                            }
                            className="grid size-9 place-items-center rounded-lg border border-line bg-white text-muted"
                            title="Устгах"
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 4 — code selection */}
          {step === 4 && (
            <div>
              <h2 className="text-xl font-bold text-navy">Шифр сонгох</h2>
              <p className="mt-1 mb-6 text-sm text-ink-soft">
                Та аль ангиллын лотод оролцохоо сонгоно уу. Сонгосон шифрт тохирох лотыг л харах,
                оролцох боломжтой. Дор хаяж нэг шифр сонгоно.
              </p>
              <div className="flex flex-col gap-5">
                {CATEGORY_CODES.map((cat) => (
                  <div key={cat}>
                    <div className="mb-2.5 flex items-center justify-between">
                      <span className="text-sm font-bold text-navy">{CATEGORIES[cat].name}</span>
                      <span className="text-[11px] text-muted">
                        {codes.filter((c) => CATEGORIES[cat].codes.includes(c)).length} сонгосон
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {CATEGORIES[cat].codes.map((code) => {
                        const on = codes.includes(code);
                        return (
                          <button
                            key={code}
                            type="button"
                            onClick={() => toggleCode(code)}
                            className="tnum rounded-[9px] border-[1.5px] px-3 py-2 text-[13px] font-semibold transition-colors"
                            style={{
                              background: on ? "#FBEFEE" : "#FFF",
                              borderColor: on ? "#C8312C" : "#E6E1D6",
                              color: on ? "#C8312C" : "#4A5260",
                            }}
                          >
                            {code}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              {touched && !codesValid() && (
                <div className="mt-4 text-[12px] text-crimson">Дор хаяж нэг шифр сонгоно уу.</div>
              )}
            </div>
          )}

          {/* STEP 5 — review */}
          {step === 5 && type && (
            <div>
              <h2 className="text-xl font-bold text-navy">Шалгаж баталгаажуулах</h2>
              <p className="mt-1 mb-5 text-sm text-ink-soft">
                Мэдээллээ нягтлаад илгээнэ үү. Илгээсний дараа захиргаа KYC шалгалт хийнэ.
              </p>
              <div className="overflow-hidden rounded-xl border border-[#EFEBE1]">
                <div className="flex items-center justify-between border-b border-[#EFEBE1] bg-[#FAF8F4] px-4 py-3">
                  <span className="text-sm font-bold text-navy">
                    {type === "legal_entity" ? "Хуулийн этгээд" : "Иргэн"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="text-xs font-semibold text-crimson"
                  >
                    Засах
                  </button>
                </div>
                {fieldDefs(type)
                  .filter((f) => f.type !== "password")
                  .map((f) => (
                    <div
                      key={f.key}
                      className="flex justify-between gap-4 border-b border-[#F3EFE5] px-4 py-2.5"
                    >
                      <span className="text-xs text-muted">{f.label}</span>
                      <span className="text-right text-sm font-medium text-navy">
                        {values[f.key] || "—"}
                      </span>
                    </div>
                  ))}
                <div className="flex items-center justify-between border-b border-[#F3EFE5] px-4 py-2.5">
                  <span className="text-xs text-muted">Бичиг баримт</span>
                  <span className="text-sm font-semibold text-success">
                    ✓ {Object.keys(docs).length} файл орсон
                  </span>
                </div>
                <div className="flex items-start justify-between gap-4 px-4 py-2.5">
                  <span className="text-xs text-muted">Сонгосон шифр</span>
                  <span className="tnum text-right text-sm font-medium text-navy">
                    {codes.length ? codes.join(", ") : "—"}
                  </span>
                </div>
              </div>

              <label
                className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border-[1.5px] p-4"
                style={{
                  borderColor: agreed ? "#C7E5D5" : "#E6E1D6",
                  background: agreed ? "#F2FAF6" : "#FAF8F4",
                }}
              >
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={() => setAgreed((v) => !v)}
                  className="mt-0.5 size-5 accent-[#1F8A5B]"
                />
                <span className="text-sm leading-relaxed text-ink-strong">
                  Би{" "}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      openTerms();
                    }}
                    className="font-semibold text-crimson underline-offset-2 hover:underline"
                  >
                    Үйлчилгээний нөхцөл ({TERMS_LABEL})
                  </button>{" "}
                  болон дуудлага худалдааны журамтай танилцаж, хүлээн зөвшөөрч байна.
                </span>
              </label>
            </div>
          )}

          {/* STEP 6 success */}
          {step === 6 && (
            <div className="px-2 py-5 text-center">
              <span className="mb-4 inline-grid size-[74px] place-items-center rounded-full bg-[#E5F4EC] text-3xl text-success">
                ✓
              </span>
              <h2 className="text-2xl font-bold text-navy">Хүсэлт амжилттай илгээгдлээ</h2>
              <p className="mx-auto mt-2.5 max-w-md text-sm leading-relaxed text-ink-soft">
                Захиргаа таны бүртгэлийг ажлын 1 өдрийн дотор шалгана. Баталгаажмагц мэдэгдэл ирэх
                бөгөөд та дуудлага худалдаанд оролцох боломжтой болно.
              </p>
              <div className="mt-6 flex justify-center gap-3">
                <Link
                  href="/login"
                  className="rounded-[10px] bg-navy px-5 py-3 text-sm font-semibold text-white"
                >
                  Нэвтрэх
                </Link>
              </div>
            </div>
          )}

          {/* nav */}
          {step <= 5 && (
            <div className="mt-7 flex items-center justify-between border-t border-[#F0ECE2] pt-5">
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(1, s - 1))}
                disabled={step === 1}
                className="rounded-[10px] border px-4 py-3 text-sm font-semibold disabled:opacity-40"
                style={{ borderColor: "#CDD4DE", color: "#14294A" }}
              >
                Буцах
              </button>
              <span className="text-xs text-muted">{stepCounter}</span>
              <button
                type="button"
                onClick={next}
                disabled={!nextEnabled}
                className="rounded-[10px] px-5 py-3 text-sm font-bold text-white transition-colors"
                style={{ background: nextEnabled ? "#C8312C" : "#E0A9A6" }}
              >
                {pending ? "Илгээж байна…" : nextText}
              </button>
            </div>
          )}

          {state.error && step <= 5 && (
            <div className="mt-4 rounded-[9px] border border-[#F2D6D4] bg-[#FBEAE9] px-3 py-2.5 text-xs text-[#A02622]">
              {state.error}
            </div>
          )}
        </div>
      </div>

      {/* success toast — next-action guidance after self-registration */}
      {showToast && (
        <div className="fixed right-5 top-5 z-[90] w-[min(380px,calc(100vw-32px))] rounded-xl border border-[#C7E5D5] bg-[#E5F4EC] px-4 py-3.5 shadow-lg">
          <div className="flex items-start gap-3">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-success text-sm font-bold text-white">
              ✓
            </span>
            <div className="min-w-0">
              <div className="text-[13.5px] font-bold text-[#197a50]">Хүсэлт амжилттай илгээгдлээ</div>
              <div className="mt-0.5 text-[12.5px] leading-relaxed text-[#2C6B4A]">
                Админ таны бичиг баримтыг шалгаж KYC баталгаажуулна. Баталгаажмагц и-мэйлээр
                мэдэгдэх ба та <span className="font-semibold">Нэвтрэх</span> боломжтой болно.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowToast(false)}
              aria-label="Хаах"
              className="ml-auto shrink-0 text-[#197a50]/70 hover:text-[#197a50]"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Terms & Conditions dialog */}
      {showTerms && (
        <div
          onClick={() => setShowTerms(false)}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-navy-deep/70 p-5"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[88vh] w-full max-w-[640px] flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
          >
            <div className="flex items-start justify-between border-b border-line px-6 py-4">
              <div>
                <h3 className="text-lg font-bold text-navy">Үйлчилгээний нөхцөл</h3>
                <div className="mt-0.5 text-[12px] text-muted">
                  Хувилбар {terms?.version ?? TERMS_VERSION}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTerms(false)}
                aria-label="Хаах"
                className="grid size-8 place-items-center rounded-lg border border-line text-ink-soft hover:bg-[#F3F5F8]"
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto px-6 py-5">
              {terms ? (
                <article className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink-strong">
                  {terms.body}
                </article>
              ) : (
                <div className="py-8 text-center text-[13.5px] text-muted">Ачаалж байна…</div>
              )}
            </div>
            <div className="flex justify-end gap-2.5 border-t border-line px-6 py-4">
              <button
                type="button"
                onClick={() => setShowTerms(false)}
                className="rounded-[10px] border border-[#CDD4DE] bg-white px-4 py-2.5 text-sm font-semibold text-ink-soft"
              >
                Хаах
              </button>
              <button
                type="button"
                onClick={() => {
                  setAgreed(true);
                  setShowTerms(false);
                }}
                className="rounded-[10px] bg-crimson px-5 py-2.5 text-sm font-bold text-white hover:bg-crimson-hover"
              >
                Зөвшөөрч байна
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
