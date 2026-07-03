"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { AdminButton } from "@/components/admin/Button";
import { actionLabel } from "@/lib/audit-actions";

export interface AuditToolbarProps {
  /** distinct actors present in the log: id + email */
  actors: { id: string; email: string }[];
  /** distinct action codes present in the log */
  actions: string[];
}

export function AuditToolbar({ actors, actions }: AuditToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value && value !== "all") next.set(key, value);
    else next.delete(key);
    // Any filter change resets to the first page.
    next.delete("page");
    startTransition(() => router.replace(`${pathname}?${next.toString()}`));
  }

  const hasFilters =
    !!params.get("actor") || !!params.get("action") || !!params.get("from") || !!params.get("to");

  const ctl = "h-10 rounded-[9px] border border-line-cool bg-[#F7F8FA] px-3 text-[13px] text-ink-strong";

  return (
    <div
      className={`mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-line-cool bg-white p-3 ${
        pending ? "opacity-70" : ""
      }`}
    >
      <select
        defaultValue={params.get("actor") ?? "all"}
        onChange={(e) => update("actor", e.target.value)}
        className={ctl}
      >
        <option value="all">Бүх админ</option>
        {actors.map((a) => (
          <option key={a.id} value={a.id}>
            {a.email}
          </option>
        ))}
      </select>

      <select
        defaultValue={params.get("action") ?? "all"}
        onChange={(e) => update("action", e.target.value)}
        className={ctl}
      >
        <option value="all">Бүх үйлдэл</option>
        {actions.map((code) => (
          <option key={code} value={code}>
            {actionLabel(code)}
          </option>
        ))}
      </select>

      <label className="flex items-center gap-1.5 text-[12px] text-muted">
        Эхлэх
        <input
          type="date"
          defaultValue={params.get("from") ?? ""}
          onChange={(e) => update("from", e.target.value)}
          className={ctl}
        />
      </label>
      <label className="flex items-center gap-1.5 text-[12px] text-muted">
        Дуусах
        <input
          type="date"
          defaultValue={params.get("to") ?? ""}
          onChange={(e) => update("to", e.target.value)}
          className={ctl}
        />
      </label>

      {hasFilters && (
        <AdminButton
          variant="ghost"
          onClick={() => startTransition(() => router.replace(pathname))}
          className="ml-auto h-10 border-line-cool px-3 text-[13px] font-medium"
        >
          Шүүлтүүр цэвэрлэх
        </AdminButton>
      )}
    </div>
  );
}
