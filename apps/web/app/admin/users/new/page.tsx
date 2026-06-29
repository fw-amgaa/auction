"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import { formatTugrug } from "@auction/shared";

import { CurrencyInput } from "@/components/CurrencyInput";

import { createUserAction, type CreateUserState } from "./actions";

type AccountType = "individual" | "legal_entity";

interface FieldDef {
  key: string;
  label: string;
  ph: string;
  full?: boolean;
  required?: boolean;
}

const INDIVIDUAL_FIELDS: FieldDef[] = [
  { key: "citizenship", label: "Иргэншил", ph: "Монгол Улс" },
  { key: "clanName", label: "Ургийн овог", ph: "Ургийн овог" },
  { key: "fatherName", label: "Эцэг/эхийн нэр", ph: "Эцгийн нэр" },
  { key: "givenName", label: "Өөрийн нэр", ph: "Нэр", required: true },
  { key: "registryNumber", label: "Регистрийн дугаар", ph: "АА00000000", required: true },
  { key: "phone", label: "Утасны дугаар", ph: "99xxxxxx", required: true },
  { key: "email", label: "И-мэйл хаяг", ph: "name@mail.mn", required: true },
  { key: "altContact", label: "Нэмэлт холбоо барих", ph: "Утас эсвэл нэр" },
  { key: "address", label: "Бүтэн хаяг", ph: "Аймаг/хот, дүүрэг, хороо, байр", full: true, required: true },
];

const LEGAL_FIELDS: FieldDef[] = [
  { key: "registeredName", label: "Байгууллагын бүртгэлтэй нэр", ph: "ХХК-ийн нэр", full: true, required: true },
  { key: "registryNumber", label: "Регистрийн дугаар (ТТД)", ph: "7 оронтой", required: true },
  { key: "stateCertNumber", label: "Улсын бүртгэлийн гэрчилгээ", ph: "9 оронтой", required: true },
  { key: "phone", label: "Холбоо барих утас", ph: "99xxxxxx", required: true },
  { key: "email", label: "И-мэйл хаяг", ph: "company@mail.mn", required: true },
  { key: "address", label: "Бүтэн хаяг", ph: "Аймаг/хот, дүүрэг, хороо, байр", full: true, required: true },
];

const DOCS: Record<AccountType, { key: string; label: string }[]> = {
  individual: [
    { key: "idFront", label: "Иргэний үнэмлэхний урд тал" },
    { key: "idBack", label: "Иргэний үнэмлэхний ар тал" },
  ],
  legal_entity: [
    { key: "cert", label: "Улсын бүртгэлийн гэрчилгээ" },
    { key: "poa", label: "Нотариатаар баталгаажсан итгэмжлэл" },
  ],
};

function fieldDefs(t: AccountType) {
  return t === "legal_entity" ? LEGAL_FIELDS : INDIVIDUAL_FIELDS;
}

export default function CreateUserPage() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<CreateUserState, FormData>(
    createUserAction,
    {},
  );
  useEffect(() => {
    if (state.ok) router.push("/admin/users");
  }, [state.ok, router]);
  const [type, setType] = useState<AccountType>("individual");
  const [values, setValues] = useState<Record<string, string>>({});
  const [docs, setDocs] = useState<Record<string, File>>({});
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [preApprove, setPreApprove] = useState(false);
  const [limit, setLimit] = useState("");
  const [cred, setCred] = useState<"invite" | "temp">("invite");
  const [tempPass, setTempPass] = useState("");

  const set = (k: string, v: string) => setValues((s) => ({ ...s, [k]: v }));
  const fe = state.fieldErrors ?? {};
  const limitN = Number.parseInt(limit.replace(/\D/g, "") || "0", 10);

  function submit() {
    const fd = new FormData();
    fd.set("accountType", type);
    for (const f of fieldDefs(type)) fd.set(f.key, values[f.key] ?? "");
    for (const d of DOCS[type]) {
      const file = docs[d.key];
      if (file) fd.set(d.key, file);
    }
    fd.set("preApprove", String(preApprove));
    fd.set("limit", String(limitN));
    fd.set("cred", cred);
    fd.set("tempPass", tempPass);
    formAction(fd);
  }

  function handleFile(key: string, file: File | null | undefined) {
    if (!file) return;
    setDocs((s) => ({ ...s, [key]: file }));
    setDragKey(null);
  }

  return (
    <div>
      <div className="sticky top-0 z-20 flex h-[60px] items-center gap-3.5 border-b border-line-cool bg-white px-6">
        <Link href="/admin/users" className="text-[13px] text-ink-soft hover:text-navy">
          ‹ Хэрэглэгчид
        </Link>
        <span className="text-[#CDD4DE]">/</span>
        <h1 className="text-lg font-bold text-navy">Шинэ хэрэглэгч үүсгэх</h1>
      </div>

      <div className="p-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-[18px]">
          {/* type toggle */}
          <section className="rounded-2xl border border-line-cool bg-white p-5">
            <div className="mb-3 text-[13px] font-bold text-navy">Бүртгэлийн төрөл</div>
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  ["individual", "Иргэн", "Хувь хүн"],
                  ["legal_entity", "Хуулийн этгээд", "Байгууллага"],
                ] as const
              ).map(([val, title, sub]) => {
                const on = type === val;
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setType(val)}
                    className="flex items-center gap-3 rounded-xl border-[1.5px] p-3.5 text-left"
                    style={{ background: on ? "#FBEFEE" : "#FFF", borderColor: on ? "#C8312C" : "#E1E5EC" }}
                  >
                    <div>
                      <div className="text-[14.5px] font-bold text-navy">{title}</div>
                      <div className="text-[11.5px] text-muted">{sub}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {state.error && (
            <div className="rounded-xl border border-[#EAD9A8] bg-[#FBF1DF] px-4 py-3.5 text-[13px] font-semibold text-[#8A6D1A]">
              {state.error}
            </div>
          )}

          {/* fields */}
          <section className="rounded-2xl border border-line-cool bg-white p-5">
            <div className="text-[13px] font-bold text-navy">
              {type === "legal_entity" ? "Байгууллагын мэдээлэл" : "Хувийн мэдээлэл"}
            </div>
            <div className="mb-4 text-xs text-muted">
              Өргөдөгчийн өгсөн мэдээллийг хуулбарлан оруулна.
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {fieldDefs(type).map((f) => (
                <div key={f.key} className={f.full ? "sm:col-span-2" : ""}>
                  <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-strong">
                    {f.label} {f.required && <span className="text-crimson">*</span>}
                  </label>
                  <input
                    value={values[f.key] ?? ""}
                    onChange={(e) => set(f.key, e.target.value)}
                    placeholder={f.ph}
                    className="h-11 w-full rounded-[9px] border bg-[#FAF8F4] px-3.5 text-sm outline-none focus:border-navy"
                    style={{ borderColor: fe[f.key] ? "#E0908C" : "#E1E5EC" }}
                  />
                  {fe[f.key] && <div className="mt-1.5 text-[11.5px] text-crimson">{fe[f.key]}</div>}
                </div>
              ))}
            </div>
          </section>

          {/* documents */}
          <section className="rounded-2xl border border-line-cool bg-white p-5">
            <div className="text-[13px] font-bold text-navy">
              Бичиг баримт <span className="font-normal text-muted">· заавал биш</span>
            </div>
            <div className="mb-4 text-xs text-muted">
              Өргөдөгчийн офлайнаар ирүүлсэн баримтыг хавсаргана. Дараа нь нэмж болно.
            </div>
            <div className="flex flex-col gap-3.5">
              {DOCS[type].map((d) => {
                const file = docs[d.key];
                const dragging = dragKey === d.key;
                return (
                  <div key={d.key}>
                    <div className="mb-2 text-[12.5px] font-semibold text-ink-strong">
                      {d.label}
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
                        className="flex cursor-pointer items-center gap-3.5 rounded-xl border-[1.5px] border-dashed p-4"
                        style={{
                          borderColor: dragging ? "#C8312C" : "#D2CCBE",
                          background: dragging ? "#FBEFEE" : "#FAF8F4",
                        }}
                      >
                        <div className="flex-1">
                          <div className="text-[13px] font-semibold text-navy">
                            Файлаа чирч оруулах эсвэл <span className="text-crimson">сонгох</span>
                          </div>
                          <div className="mt-0.5 text-[11.5px] text-muted">
                            JPG, PNG эсвэл PDF · дээд тал нь 10MB
                          </div>
                        </div>
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          onChange={(e) => handleFile(d.key, e.target.files?.[0])}
                          className="hidden"
                        />
                      </label>
                    ) : (
                      <div className="flex items-center gap-3.5 rounded-xl border border-[#C7E5D5] bg-[#F2FAF6] px-4 py-3">
                        <span className="grid size-10 shrink-0 place-items-center rounded-[9px] bg-[#E5F0FB] text-xs font-bold text-navy">
                          {/^image\//.test(file.type) ? "IMG" : "PDF"}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13.5px] font-semibold text-navy">{file.name}</div>
                          <div className="mt-0.5 text-[11.5px] text-success">✓ Орууллаа</div>
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
                          className="grid size-8 place-items-center rounded-lg border border-line text-muted"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* admin options */}
          <section className="rounded-2xl border border-navy bg-navy-deep p-5 text-white">
            <div className="mb-1 flex items-center gap-2.5">
              <span className="text-gold">🛡</span>
              <div className="text-[13.5px] font-bold">Админ тохиргоо</div>
              <span className="rounded bg-white/10 px-2 py-0.5 text-[10.5px] font-semibold text-[#7E92B2]">
                Зөвхөн админ
              </span>
            </div>
            <div className="mb-4 text-xs text-[#9DB0CC]">Эдгээр нь зөвхөн админ үүсгэх үед боломжтой.</div>

            <label
              className="mb-3 flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 p-3.5"
              style={{ background: preApprove ? "rgba(31,138,91,.12)" : "rgba(255,255,255,.03)" }}
            >
              <input
                type="checkbox"
                checked={preApprove}
                onChange={() => setPreApprove((v) => !v)}
                className="mt-0.5 size-5 accent-success"
              />
              <div>
                <div className="text-[13.5px] font-semibold">KYC-г урьдчилан баталгаажуулах</div>
                <div className="mt-0.5 text-xs text-[#9DB0CC]">
                  Дарааллыг алгасч шууд баталгаажсан төлөвт оруулна.
                </div>
              </div>
            </label>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
              <div className="mb-2 text-[13.5px] font-semibold">Эхний лимит тогтоох</div>
              <div className="max-w-[280px]">
                <CurrencyInput
                  value={limit}
                  onChange={setLimit}
                  placeholder="0"
                  className="tnum h-11 w-full rounded-[9px] border border-white/15 bg-white/[0.06] pl-3.5 pr-8 text-base font-semibold text-white outline-none"
                />
              </div>
              <div className="mt-1.5 text-[11.5px] text-[#7E92B2]">
                Офлайнаар төлсөн барьцааны хэмжээг илэрхийлнэ.
                {limitN > 0 && ` Тогтоох лимит: ${formatTugrug(limitN)}`}
              </div>
            </div>
          </section>

          {/* credentials */}
          <section className="rounded-2xl border border-line-cool bg-white p-5">
            <div className="mb-3 text-[13px] font-bold text-navy">Нэвтрэх мэдээлэл</div>
            <div className="flex flex-col gap-2.5">
              <label
                className="flex cursor-pointer items-start gap-3 rounded-xl border-[1.5px] p-4"
                style={{ borderColor: cred === "invite" ? "#C8312C" : "#E1E5EC", background: cred === "invite" ? "#FBEFEE" : "#FFF" }}
              >
                <input type="radio" name="cred" checked={cred === "invite"} onChange={() => setCred("invite")} className="mt-0.5 accent-crimson" />
                <div>
                  <div className="text-[13.5px] font-semibold text-navy">
                    И-мэйлээр урилга илгээх <span className="text-[11px] font-semibold text-success">· зөвлөмж</span>
                  </div>
                  <div className="mt-0.5 text-xs text-ink-soft">
                    Хэрэглэгч өөрөө нууц үгээ тохируулна. Хамгийн аюулгүй.
                  </div>
                </div>
              </label>
              <label
                className="flex cursor-pointer items-start gap-3 rounded-xl border-[1.5px] p-4"
                style={{ borderColor: cred === "temp" ? "#C8312C" : "#E1E5EC", background: cred === "temp" ? "#FBEFEE" : "#FFF" }}
              >
                <input type="radio" name="cred" checked={cred === "temp"} onChange={() => setCred("temp")} className="mt-0.5 accent-crimson" />
                <div className="flex-1">
                  <div className="text-[13.5px] font-semibold text-navy">Түр нууц үг тохируулах</div>
                  <div className="mt-0.5 text-xs text-ink-soft">
                    Та нууц үг үүсгээд хэрэглэгчид аюулгүйгээр дамжуулна.
                  </div>
                  {cred === "temp" && (
                    <div className="mt-3 max-w-xs">
                      <input
                        value={tempPass}
                        onChange={(e) => setTempPass(e.target.value)}
                        placeholder="Түр нууц үг"
                        className="tnum h-10 w-full rounded-[9px] border bg-[#FAF8F4] px-3 text-sm outline-none"
                        style={{ borderColor: fe.tempPass ? "#E0908C" : "#E1E5EC" }}
                      />
                      {fe.tempPass && <div className="mt-1.5 text-[11.5px] text-crimson">{fe.tempPass}</div>}
                    </div>
                  )}
                </div>
              </label>
            </div>
          </section>

          {/* footer */}
          <div className="flex flex-wrap items-center justify-between gap-3.5 px-0.5 pb-3">
            <span className="text-xs text-muted">ⓘ Үйлдэл аудит логд бүртгэгдэнэ.</span>
            <div className="flex gap-3">
              <Link
                href="/admin/users"
                className="rounded-[10px] border border-[#CDD4DE] bg-white px-5 py-3 text-sm font-semibold text-ink-soft"
              >
                Цуцлах
              </Link>
              <button
                type="button"
                onClick={submit}
                disabled={pending || state.ok}
                className="rounded-[10px] px-6 py-3 text-sm font-bold text-white"
                style={{ background: pending || state.ok ? "#A9756F" : "#C8312C" }}
              >
                {pending || state.ok ? "Үүсгэж байна…" : "Үүсгэх"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
