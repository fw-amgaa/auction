"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { PERMISSION_GROUPS } from "@auction/shared";

import {
  type AdminActionState,
  createDashboardUser,
  resendAdminInvite,
  setAdminDisabled,
  updateAdminPermissions,
} from "./actions";

export interface DashboardUser {
  id: string;
  name: string;
  email: string;
  disabled: boolean;
  awaitingSetup: boolean;
  permissions: string[];
}

const ALL_COUNT = PERMISSION_GROUPS.reduce((n, g) => n + g.permissions.length, 0);

export function AdminsManager({
  users,
  currentUserId,
}: {
  users: DashboardUser[];
  currentUserId: string;
}) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<DashboardUser | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="max-w-2xl text-[13px] leading-relaxed text-muted">
          Дашбоард хэрэглэгчид зөвхөн өөрт олгогдсон эрхийн дагуу цэс, товч, үйлдлийг харна. Шинэ
          хэрэглэгчид нууц үг тохируулах холбоос и-мэйлээр илгээгдэнэ.
        </p>
        <button
          onClick={() => {
            setEditing(null);
            setCreating(true);
          }}
          className="shrink-0 rounded-[9px] bg-crimson px-4 py-2.5 text-[13.5px] font-bold text-white transition-colors hover:bg-crimson-hover"
        >
          + Дашбоард хэрэглэгч
        </button>
      </div>

      {creating && <CreateForm onClose={() => setCreating(false)} />}

      <div className="overflow-hidden rounded-2xl border border-line-cool bg-white">
        <div className="grid grid-cols-[1.4fr_1fr_140px_120px] gap-3 border-b border-[#EBEEF3] bg-[#F7F8FA] px-[18px] py-3 text-[11px] font-bold uppercase tracking-wide text-muted">
          <span>Хэрэглэгч</span>
          <span>Төлөв</span>
          <span className="text-center">Эрхүүд</span>
          <span className="text-right">Үйлдэл</span>
        </div>

        {users.map((u) => (
          <div
            key={u.id}
            className="grid grid-cols-[1.4fr_1fr_140px_120px] items-center gap-3 border-b border-[#F1F3F6] px-[18px] py-3 last:border-0"
          >
            <div className="min-w-0">
              <div className="truncate text-[13.5px] font-semibold text-navy">
                {u.name}
                {u.id === currentUserId && (
                  <span className="ml-2 rounded bg-admin-bg px-1.5 py-0.5 text-[10px] font-semibold text-ink-soft">
                    Та
                  </span>
                )}
              </div>
              <div className="truncate text-[11.5px] text-muted">{u.email}</div>
            </div>
            <StatusPill user={u} />
            <span className="text-center text-[12.5px] text-ink-soft">
              {u.permissions.length === ALL_COUNT ? "Бүх эрх" : `${u.permissions.length} эрх`}
            </span>
            <div className="flex justify-end">
              <button
                onClick={() => {
                  setCreating(false);
                  setEditing(u);
                }}
                className="rounded-[8px] border border-line-cool px-3 py-1.5 text-[12.5px] font-medium text-navy transition-colors hover:bg-[#F7F8FA]"
              >
                Засах
              </button>
            </div>
          </div>
        ))}
        {users.length === 0 && (
          <div className="px-5 py-12 text-center text-[13px] text-muted">Дашбоард хэрэглэгч алга.</div>
        )}
      </div>

      {editing && (
        <EditDrawer
          key={editing.id}
          user={editing}
          isSelf={editing.id === currentUserId}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function StatusPill({ user }: { user: DashboardUser }) {
  const [label, cls] = user.disabled
    ? ["Идэвхгүй", "bg-[#FBEAE9] text-crimson"]
    : user.awaitingSetup
      ? ["Тохиргоо хүлээж буй", "bg-[#FBF1DF] text-[#C77A0A]"]
      : ["Идэвхтэй", "bg-[#E5F4EC] text-[#1F8A5B]"];
  return (
    <span className={`w-fit rounded-md px-2.5 py-1 text-[11.5px] font-semibold ${cls}`}>{label}</span>
  );
}

/* --------------------------- shared permission picker --------------------- */

function PermissionPicker({
  value,
  onChange,
}: {
  value: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  function toggle(perm: string) {
    const next = new Set(value);
    if (next.has(perm)) next.delete(perm);
    else next.add(perm);
    onChange(next);
  }
  function toggleGroup(keys: string[], on: boolean) {
    const next = new Set(value);
    for (const k of keys) {
      if (on) next.add(k);
      else next.delete(k);
    }
    onChange(next);
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {PERMISSION_GROUPS.map((g) => {
        const keys = g.permissions.map((p) => p.key);
        const on = keys.filter((k) => value.has(k)).length;
        const all = on === keys.length;
        return (
          <div key={g.key} className="rounded-xl border border-line-cool p-3">
            <label className="flex cursor-pointer items-center gap-2 border-b border-[#F1F3F6] pb-2">
              <input
                type="checkbox"
                checked={all}
                onChange={(e) => toggleGroup(keys, e.target.checked)}
                className="size-4 accent-crimson"
              />
              <span className="text-[12.5px] font-bold text-navy">{g.label}</span>
              {on > 0 && !all && (
                <span className="ml-auto text-[10.5px] text-muted">
                  {on}/{keys.length}
                </span>
              )}
            </label>
            <div className="mt-2 space-y-1.5">
              {g.permissions.map((p) => (
                <label key={p.key} className="flex cursor-pointer items-center gap-2 text-[12.5px] text-ink-strong">
                  <input
                    type="checkbox"
                    checked={value.has(p.key)}
                    onChange={() => toggle(p.key)}
                    className="size-4 accent-crimson"
                  />
                  {p.label}
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------- create form ------------------------------ */

function CreateForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [perms, setPerms] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<AdminActionState | null>(null);

  function submit() {
    setMsg(null);
    start(async () => {
      const res = await createDashboardUser({ email, name, permissions: [...perms] });
      setMsg(res);
      if (res.ok) {
        router.refresh();
        onClose();
      }
    });
  }

  const input =
    "h-10 w-full rounded-[9px] border border-line-cool bg-[#F7F8FA] px-3 text-[13.5px] outline-none focus:border-navy";

  return (
    <div className="rounded-2xl border border-line-cool bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[15px] font-bold text-navy">Шинэ дашбоард хэрэглэгч</h2>
        <button onClick={onClose} className="text-[13px] text-muted hover:text-navy">
          Болих
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[12px] font-medium text-ink-soft">Нэр</span>
          <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Бямбаа" />
        </label>
        <label className="block">
          <span className="mb-1 block text-[12px] font-medium text-ink-soft">И-мэйл</span>
          <input
            className={input}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@anav.mn"
            type="email"
          />
        </label>
      </div>

      <div className="mt-4">
        <div className="mb-2 text-[12px] font-bold uppercase tracking-wide text-muted">Эрхүүд</div>
        <PermissionPicker value={perms} onChange={setPerms} />
      </div>

      {msg?.error && <p className="mt-3 text-[13px] text-crimson">{msg.error}</p>}

      <div className="mt-4 flex justify-end gap-2">
        <button
          onClick={submit}
          disabled={pending}
          className="rounded-[9px] bg-crimson px-5 py-2.5 text-[13.5px] font-bold text-white transition-colors hover:bg-crimson-hover disabled:opacity-60"
        >
          {pending ? "Үүсгэж байна…" : "Үүсгэх ба урих"}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------ edit drawer ------------------------------- */

function EditDrawer({
  user,
  isSelf,
  onClose,
}: {
  user: DashboardUser;
  isSelf: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [perms, setPerms] = useState<Set<string>>(new Set(user.permissions));
  const [msg, setMsg] = useState<AdminActionState | null>(null);

  function run(fn: () => Promise<AdminActionState>, close = false) {
    setMsg(null);
    start(async () => {
      const res = await fn();
      setMsg(res);
      if (res.ok) {
        router.refresh();
        if (close) onClose();
      }
    });
  }

  return (
    <div className="rounded-2xl border border-line-cool bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-bold text-navy">{user.name}</h2>
          <div className="text-[12px] text-muted">{user.email}</div>
        </div>
        <button onClick={onClose} className="text-[13px] text-muted hover:text-navy">
          Хаах
        </button>
      </div>

      <PermissionPicker value={perms} onChange={setPerms} />

      {msg?.error && <p className="mt-3 text-[13px] text-crimson">{msg.error}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => run(() => updateAdminPermissions(user.id, [...perms]))}
          disabled={pending}
          className="rounded-[9px] bg-crimson px-5 py-2.5 text-[13.5px] font-bold text-white transition-colors hover:bg-crimson-hover disabled:opacity-60"
        >
          {pending ? "Хадгалж байна…" : "Эрх хадгалах"}
        </button>

        {user.awaitingSetup && !user.disabled && (
          <button
            onClick={() => run(() => resendAdminInvite(user.id))}
            disabled={pending}
            className="rounded-[9px] border border-line-cool px-4 py-2.5 text-[13px] font-medium text-navy transition-colors hover:bg-[#F7F8FA] disabled:opacity-60"
          >
            Урилга дахин илгээх
          </button>
        )}

        {!isSelf && (
          <button
            onClick={() => run(() => setAdminDisabled(user.id, !user.disabled), true)}
            disabled={pending}
            className={`ml-auto rounded-[9px] border px-4 py-2.5 text-[13px] font-medium transition-colors disabled:opacity-60 ${
              user.disabled
                ? "border-[#1F8A5B]/40 text-[#1F8A5B] hover:bg-[#E5F4EC]"
                : "border-crimson/40 text-crimson hover:bg-[#FBEAE9]"
            }`}
          >
            {user.disabled ? "Идэвхжүүлэх" : "Идэвхгүй болгох"}
          </button>
        )}
      </div>
    </div>
  );
}
