"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { formatTugrug } from "@auction/shared";

import { DocThumb } from "@/components/DocThumb";
import { LocalTime } from "@/components/LocalTime";
import { logout } from "@/lib/session-actions";

import { updateMyProfile } from "./actions";

export interface ProfileData {
  name: string;
  typeLabel: string;
  memberSince: string;
  kyc: "pending" | "approved" | "rejected";
  lockedFields: { label: string; value: string }[];
  phone: string;
  address: string;
  docs: { id: string; label: string; kind: string }[];
  available: number;
  committed: number;
  limit: number;
}

const KYC_META = {
  approved: { label: "Баталгаажсан", bg: "#E5F4EC", fg: "#1F8A5B", border: "#C7E5D5", note: "Таны бүртгэл бүрэн баталгаажсан. Та дуудлага худалдаанд оролцох эрхтэй." },
  pending: { label: "Хүлээгдэж буй", bg: "#FBF1DF", fg: "#C77A0A", border: "#EAD9A8", note: "Таны бүртгэлийг захиргаа хянаж байна. Баталгаажмагц мэдэгдэнэ." },
  rejected: { label: "Татгалзсан", bg: "#FBEAE9", fg: "#C8312C", border: "#F2D6D4", note: "Бүртгэл татгалзсан. Шалтгааныг мэдэгдлээс хараад дахин илгээнэ үү." },
} as const;

export function ProfileView({ data }: { data: ProfileData }) {
  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState(data.phone);
  const [address, setAddress] = useState(data.address);
  const [toast, setToast] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const k = KYC_META[data.kyc];

  const timeline = [
    { title: "Бүртгэл үүсгэсэн", done: true },
    { title: "Бичиг баримт хүлээн авсан", done: true },
    { title: "Админ хянасан", done: data.kyc !== "pending" },
    { title: data.kyc === "rejected" ? "Татгалзсан" : "Баталгаажсан", done: data.kyc === "approved", bad: data.kyc === "rejected" },
  ];

  return (
    <main>
      <h1 className="text-[28px] font-bold text-navy">Профайл</h1>
      <p className="mt-1.5 text-sm text-ink-soft">Хувийн мэдээлэл, баталгаажуулалтын төлөв, бичиг баримтаа удирдана.</p>

      <div className="mt-6 flex flex-wrap items-start gap-[18px]">
        {/* left */}
        <div className="flex min-w-[300px] flex-1 basis-[540px] flex-col gap-[18px]">
          {/* identity */}
          <div className="flex items-center gap-4 rounded-[14px] border border-line bg-white p-[22px]">
            <span className="grid size-16 shrink-0 place-items-center rounded-full bg-navy text-[22px] font-semibold text-white">
              {data.name.slice(0, 2).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-xl font-bold text-navy">{data.name}</h2>
                <span className="rounded-md bg-[#E5F4EC] px-2 py-0.5 text-[11.5px] font-semibold text-[#197a50]">{data.typeLabel}</span>
              </div>
              <div className="mt-1 text-[12.5px] text-muted">
                <LocalTime value={data.memberSince} mode="date" />-наас гишүүн
              </div>
            </div>
            <form action={logout}>
              <button className="rounded-[9px] border border-[#CDD4DE] px-3.5 py-2 text-[13px] text-ink-soft hover:border-navy hover:text-navy">Гарах</button>
            </form>
          </div>

          {/* editable info */}
          <div className="rounded-[14px] border border-line bg-white p-[22px]">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-navy">Хувийн мэдээлэл</h3>
              <button
                onClick={() => setEditing((v) => !v)}
                className="rounded-lg border px-3 py-1.5 text-[12.5px] font-semibold"
                style={editing ? { color: "#C8312C", background: "#FBEFEE", borderColor: "#E8B7B4" } : { color: "#14294A", background: "#F3F0E9", borderColor: "#E6E1D6" }}
              >
                {editing ? "Засаж байна" : "Засах"}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {data.lockedFields.map((f) => (
                <div key={f.label} className={f.label === "Хаяг" ? "col-span-2" : ""}>
                  <label className="mb-1 block text-[11.5px] font-medium text-muted">{f.label}</label>
                  <div className="text-[14px] font-semibold text-navy">{f.value || "—"}</div>
                  {editing && <div className="mt-1 text-[11px] text-muted">Баталгаажсан тул өөрчлөх боломжгүй</div>}
                </div>
              ))}
              <div>
                <label className="mb-1 block text-[11.5px] font-medium text-muted">Утас</label>
                {editing ? (
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} className="h-[43px] w-full rounded-[9px] border border-line bg-[#FAF8F4] px-3 text-[13.5px] outline-none focus:border-navy" />
                ) : (
                  <div className="tnum text-[14px] font-semibold text-navy">{phone || "—"}</div>
                )}
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-[11.5px] font-medium text-muted">Хаяг</label>
                {editing ? (
                  <input value={address} onChange={(e) => setAddress(e.target.value)} className="h-[43px] w-full rounded-[9px] border border-line bg-[#FAF8F4] px-3 text-[13.5px] outline-none focus:border-navy" />
                ) : (
                  <div className="text-[14px] font-semibold text-navy">{address || "—"}</div>
                )}
              </div>
            </div>
            {editing && (
              <div className="mt-4 flex gap-2.5">
                <button
                  onClick={() => startTransition(async () => { await updateMyProfile({ phone, address }); setEditing(false); setToast("Мэдээлэл шинэчлэгдлээ"); setTimeout(() => setToast(null), 3000); })}
                  disabled={pending}
                  className="rounded-[9px] bg-crimson px-5 py-2.5 text-[13.5px] font-bold text-white"
                >
                  Хадгалах
                </button>
                <button onClick={() => { setEditing(false); setPhone(data.phone); setAddress(data.address); }} className="rounded-[9px] border border-[#CDD4DE] px-4 py-2.5 text-[13.5px] font-semibold text-ink-soft">
                  Болих
                </button>
              </div>
            )}
          </div>

          {/* documents */}
          <div className="rounded-[14px] border border-line bg-white p-[22px]">
            <h3 className="mb-3.5 text-base font-bold text-navy">Бичиг баримт</h3>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
              {data.docs.map((d) => (
                <a key={d.id} href={`/api/admin/kyc-doc/${d.id}`} target="_blank" rel="noopener noreferrer" className="overflow-hidden rounded-[11px] border border-line hover:border-navy">
                  <DocThumb id={d.id} kind={d.kind} label={d.label} className="h-[104px]" />
                  <div className="px-3 py-2.5 text-[12.5px] font-semibold text-navy">{d.label}</div>
                </a>
              ))}
              {data.docs.length === 0 && <div className="text-[13px] text-muted">Баримт алга.</div>}
            </div>
          </div>
        </div>

        {/* right */}
        <div className="flex w-full flex-col gap-4 sm:w-[320px]">
          <div className="rounded-[14px] border bg-white p-5" style={{ borderColor: k.border }}>
            <div className="flex items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-full text-xl" style={{ background: k.bg, color: k.fg }}>
                {data.kyc === "approved" ? "✓" : data.kyc === "pending" ? "◷" : "✕"}
              </span>
              <div>
                <div className="text-base font-bold" style={{ color: k.fg }}>{k.label}</div>
                <div className="text-[12px] text-muted">KYC төлөв</div>
              </div>
            </div>
            <p className="mt-3.5 text-[12.5px] leading-relaxed text-ink-soft">{k.note}</p>
          </div>

          <div className="rounded-[14px] border border-line bg-white p-5">
            <h3 className="mb-3.5 text-sm font-bold text-navy">Баталгаажуулалтын явц</h3>
            {timeline.map((t, i) => (
              <div key={i} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className="grid size-[26px] place-items-center rounded-full border-[1.5px] text-[12px] font-bold" style={t.done ? { background: t.bad ? "#C8312C" : "#1F8A5B", borderColor: t.bad ? "#C8312C" : "#1F8A5B", color: "#fff" } : { background: "#FFF", borderColor: "#D8D2C4", color: "#A2AAB6" }}>
                    {t.done ? (t.bad ? "✕" : "✓") : i + 1}
                  </span>
                  {i < timeline.length - 1 && <span className="h-[30px] w-0.5" style={{ background: t.done ? "#1F8A5B" : "#E6E1D6" }} />}
                </div>
                <div className="pb-3.5 pt-0.5">
                  <div className="text-[13px] font-semibold" style={{ color: t.done ? "#14294A" : "#A2AAB6" }}>{t.title}</div>
                </div>
              </div>
            ))}
          </div>

          <Link href="/balance" className="block rounded-[14px] bg-[#0E2A1E] p-[18px] text-white">
            <div className="text-[12px] font-semibold text-[#8FD4AE]">Боломжит үлдэгдэл</div>
            <div className="tnum mt-1 text-[24px] font-bold">{formatTugrug(data.available)}</div>
            <div className="mt-2 text-[12px] text-[#9DB8AB]">Дэлгэрэнгүй харах ›</div>
          </Link>
        </div>
      </div>

      {toast && <div className="fixed right-5 top-20 z-[80] rounded-xl border border-[#C7E5D5] bg-[#E5F4EC] px-4 py-3 text-[13.5px] font-semibold text-[#197a50] shadow-lg">✅ {toast}</div>}
    </main>
  );
}
