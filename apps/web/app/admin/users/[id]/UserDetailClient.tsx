"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { formatTugrug } from "@auction/shared";

import { approveKyc, resetCredentials, setUserDisabled, updateUserInfo } from "@/app/admin/actions";
import { KycBadge } from "@/components/KycBadge";

export interface DetailUser {
  id: string;
  name: string;
  accountType: "individual" | "legal_entity";
  kyc: "pending" | "approved" | "rejected";
  source: "self" | "admin";
  created: string;
  limit: number;
  committed: number;
  disabled: boolean;
  editFields: { key: string; label: string; value: string; full?: boolean }[];
  docs: { id: string; label: string; kind: string }[];
  activity: { icon: string; label: string; date: string; amount: string; positive: boolean }[];
}

export function UserDetailClient({ user }: { user: DetailUser }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>(
    Object.fromEntries(user.editFields.map((f) => [f.key, f.value])),
  );
  const [toast, setToast] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  const meta =
    user.accountType === "legal_entity"
      ? { label: "Хуулийн этгээд", fg: "#1B5FA8", bg: "#E5F0FB" }
      : { label: "Иргэн", fg: "#197a50", bg: "#E5F4EC" };

  return (
    <div>
      <div className="sticky top-0 z-20 flex h-[60px] items-center gap-3.5 border-b border-line-cool bg-white px-6">
        <Link href="/admin/users" className="text-[13px] text-ink-soft hover:text-navy">
          ‹ Хэрэглэгчид
        </Link>
        <span className="text-[#CDD4DE]">/</span>
        <h1 className="text-lg font-bold text-navy">{user.name}</h1>
        <KycBadge status={user.kyc} />
        {user.disabled && (
          <span className="rounded-md bg-[#FBEAE9] px-2 py-1 text-[11px] font-bold text-crimson">
            Түр хаагдсан
          </span>
        )}
      </div>

      <div className="p-6">
        <div className="mx-auto flex max-w-4xl flex-wrap items-start gap-[18px]">
          {/* main column */}
          <div className="flex min-w-[300px] flex-1 basis-[540px] flex-col gap-[18px]">
            <div className="flex items-center gap-4 rounded-2xl border border-line-cool bg-white p-5">
              <span
                className="grid size-[60px] place-items-center rounded-[14px] text-xl font-bold"
                style={{ background: meta.bg, color: meta.fg }}
              >
                {user.name.slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-[19px] font-bold text-navy">{user.name}</h2>
                  <span
                    className="rounded-md px-2 py-0.5 text-[11.5px] font-semibold"
                    style={{ background: meta.bg, color: meta.fg }}
                  >
                    {meta.label}
                  </span>
                </div>
                <div className="mt-1 text-[12.5px] text-muted">
                  {user.source === "admin" ? "Админ үүсгэсэн" : "Өөрөө бүртгэсэн"} · {user.created}-нд
                </div>
              </div>
            </div>

            {/* editable info */}
            <div className="rounded-2xl border border-line-cool bg-white p-5">
              <div className="mb-3.5 flex items-center justify-between">
                <div className="text-[13px] font-bold text-navy">Мэдээлэл</div>
                <button
                  onClick={() => {
                    if (editing) setDraft(Object.fromEntries(user.editFields.map((f) => [f.key, f.value])));
                    setEditing((v) => !v);
                  }}
                  className="rounded-lg border px-3 py-1.5 text-[12.5px] font-semibold"
                  style={{
                    color: editing ? "#C8312C" : "#14294A",
                    background: editing ? "#FBEFEE" : "#F3F5F8",
                    borderColor: editing ? "#E8B7B4" : "#E1E5EC",
                  }}
                >
                  {editing ? "Засаж байна" : "Засах"}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3.5">
                {user.editFields.map((f) => (
                  <div key={f.key} className={f.full ? "col-span-2" : ""}>
                    <label className="mb-1.5 block text-[11.5px] font-medium text-muted">{f.label}</label>
                    {editing ? (
                      <input
                        value={draft[f.key] ?? ""}
                        onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                        className="h-[42px] w-full rounded-[9px] border border-line-cool bg-[#FAF8F4] px-3 text-[13.5px] outline-none focus:border-navy"
                      />
                    ) : (
                      <div className="tnum text-sm font-semibold text-navy">{f.value || "—"}</div>
                    )}
                  </div>
                ))}
              </div>
              {editing && (
                <div className="mt-4 flex gap-2.5">
                  <button
                    onClick={() =>
                      startTransition(async () => {
                        await updateUserInfo(user.id, user.accountType, draft);
                        setEditing(false);
                        flash("Мэдээлэл хадгалагдлаа");
                      })
                    }
                    disabled={pending}
                    className="rounded-[9px] bg-success px-5 py-2.5 text-[13.5px] font-bold text-white"
                  >
                    Хадгалах
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="rounded-[9px] border border-[#CDD4DE] bg-white px-4 py-2.5 text-[13.5px] font-semibold text-ink-soft"
                  >
                    Болих
                  </button>
                </div>
              )}
            </div>

            {/* documents */}
            <div className="rounded-2xl border border-line-cool bg-white p-5">
              <div className="mb-3 text-[13px] font-bold text-navy">Бичиг баримт</div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-3">
                {user.docs.map((d) => (
                  <a
                    key={d.id}
                    href={`/api/admin/kyc-doc/${d.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="overflow-hidden rounded-xl border border-line-cool hover:border-navy"
                  >
                    <div
                      className="flex h-[100px] items-center justify-center text-[12.5px] font-bold text-ink-soft"
                      style={{
                        backgroundImage:
                          "repeating-linear-gradient(135deg,#DCE3EC 0 12px,#D2DAE5 12px 24px)",
                      }}
                    >
                      {d.kind}
                    </div>
                    <div className="px-3 py-2.5 text-xs font-semibold text-navy">{d.label}</div>
                  </a>
                ))}
                {user.docs.length === 0 && <div className="text-[13px] text-muted">Баримт алга.</div>}
              </div>
            </div>

            {/* activity */}
            <div className="rounded-2xl border border-line-cool bg-white p-5">
              <div className="mb-3.5 text-[13px] font-bold text-navy">Сүүлийн идэвх</div>
              {user.activity.length === 0 ? (
                <div className="text-[13px] text-muted">Идэвх алга.</div>
              ) : (
                user.activity.map((a, i) => (
                  <div key={i} className="flex items-center gap-3 border-b border-[#F1F3F6] py-2.5 last:border-0">
                    <span className="grid size-[30px] shrink-0 place-items-center rounded-lg bg-admin-bg text-[13px]">
                      {a.icon}
                    </span>
                    <div className="flex-1">
                      <div className="text-[13px] font-medium text-navy">{a.label}</div>
                      <div className="text-[11.5px] text-muted">{a.date}</div>
                    </div>
                    <span
                      className="tnum text-[12.5px] font-semibold"
                      style={{ color: a.positive ? "#1F8A5B" : "#14294A" }}
                    >
                      {a.amount}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* side */}
          <div className="flex w-full flex-col gap-4 sm:w-[300px]">
            <div className="rounded-2xl bg-navy-deep p-[18px] text-white">
              <div className="text-xs font-semibold text-[#9DB0CC]">Бэлэн лимит</div>
              <div className="tnum mt-1 text-[26px] font-bold">{formatTugrug(user.limit)}</div>
              <div className="mt-3 text-[11.5px] text-[#9DB0CC]">
                Барьцаанд: <span className="tnum text-white">{formatTugrug(user.committed)}</span>
              </div>
              <Link
                href="/admin/limits"
                className="mt-3.5 block rounded-[9px] border border-white/15 bg-white/[0.08] py-2.5 text-center text-[13px] font-semibold text-white"
              >
                Лимит тохируулах
              </Link>
            </div>

            <div className="rounded-2xl border border-line-cool bg-white p-4">
              <div className="mb-3 text-[12.5px] font-bold text-navy">Үйлдэл</div>
              <div className="flex flex-col gap-2">
                {user.kyc === "pending" && (
                  <button
                    onClick={() => startTransition(async () => { await approveKyc(user.id); flash("KYC баталгаажлаа"); })}
                    disabled={pending}
                    className="rounded-[9px] border border-[#C7E5D5] bg-[#E5F4EC] px-3 py-2.5 text-left text-[13px] font-semibold text-[#197a50]"
                  >
                    ✓ KYC баталгаажуулах
                  </button>
                )}
                <button
                  onClick={() => startTransition(async () => { await resetCredentials(user.id); flash("Сэргээх хүсэлт бүртгэгдлээ"); })}
                  disabled={pending}
                  className="rounded-[9px] border border-line-cool bg-white px-3 py-2.5 text-left text-[13px] font-semibold text-navy"
                >
                  ⟲ Нэвтрэх сэргээх илгээх
                </button>
                <button
                  onClick={() =>
                    startTransition(async () => {
                      await setUserDisabled(user.id, !user.disabled);
                      flash(user.disabled ? "Бүртгэл сэргээгдлээ" : "Бүртгэл түр хаагдлаа");
                    })
                  }
                  disabled={pending}
                  className="rounded-[9px] border border-[#E0908C] bg-white px-3 py-2.5 text-left text-[13px] font-semibold text-crimson"
                >
                  {user.disabled ? "↺ Бүртгэл сэргээх" : "⊘ Бүртгэл түр хаах"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {toast && (
        <div className="fixed right-5 top-5 z-[80] rounded-xl border border-[#C7E5D5] bg-[#E5F4EC] px-4 py-3 text-[13.5px] font-semibold text-[#197a50] shadow-lg">
          ✅ {toast}
        </div>
      )}
    </div>
  );
}
