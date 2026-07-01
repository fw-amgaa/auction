"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

export function UsersToolbar() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value && value !== "all") next.set(key, value);
    else next.delete(key);
    next.delete("page"); // any filter change invalidates the current page offset
    startTransition(() => router.replace(`${pathname}?${next.toString()}`));
  }

  const selectCls =
    "h-10 rounded-[9px] border border-line-cool bg-[#F7F8FA] px-3 text-[13px] text-ink-strong";

  return (
    <div
      className={`mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-line-cool bg-white p-3 ${
        pending ? "opacity-70" : ""
      }`}
    >
      <div className="relative min-w-[200px] flex-1">
        <input
          defaultValue={params.get("q") ?? ""}
          onChange={(e) => update("q", e.target.value)}
          placeholder="Нэр, регистр, и-мэйл, утсаар хайх"
          className="h-10 w-full rounded-[9px] border border-line-cool bg-[#F7F8FA] pl-3 pr-3 text-[13.5px] outline-none focus:border-navy"
        />
      </div>
      <select
        defaultValue={params.get("type") ?? "all"}
        onChange={(e) => update("type", e.target.value)}
        className={selectCls}
      >
        <option value="all">Бүх төрөл</option>
        <option value="individual">Иргэн</option>
        <option value="legal_entity">Хуулийн этгээд</option>
      </select>
      <select
        defaultValue={params.get("kyc") ?? "all"}
        onChange={(e) => update("kyc", e.target.value)}
        className={selectCls}
      >
        <option value="all">Бүх KYC төлөв</option>
        <option value="approved">Баталгаажсан</option>
        <option value="pending">Хүлээгдэж буй</option>
        <option value="rejected">Татгалзсан</option>
      </select>
      <select
        defaultValue={params.get("sort") ?? "created"}
        onChange={(e) => update("sort", e.target.value)}
        className={`${selectCls} ml-auto`}
      >
        <option value="created">Эрэмбэ: Шинээр бүртгэгдсэн</option>
        <option value="limitDesc">Лимит: Ихээс бага</option>
        <option value="limitAsc">Лимит: Багаас их</option>
      </select>
    </div>
  );
}
