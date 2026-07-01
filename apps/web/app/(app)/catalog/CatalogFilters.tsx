"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

const STATUS_TABS: [string, string][] = [
  ["all", "Бүгд"],
  ["live", "Шууд"],
  ["upcoming", "Удахгүй"],
  ["ended", "Дууссан"],
];

export function CatalogFilters({
  categories,
  aimags,
}: {
  categories: { code: string; name: string }[];
  aimags: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const species = params.get("species") ?? "all";
  const status = params.get("status") ?? "all";

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value && value !== "all") next.set(key, value);
    else next.delete(key);
    startTransition(() => router.replace(`${pathname}?${next.toString()}`));
  }

  const chip = (active: boolean) =>
    `flex-shrink-0 rounded-[10px] border px-3.5 py-2 text-[13.5px] font-semibold transition-colors ${
      active ? "border-[#E8B7B4] bg-[#FBEFEE] text-crimson" : "border-line bg-white text-ink-strong"
    }`;

  return (
    <>
      {/* species rail */}
      <div data-tour="species" className="mt-5 flex gap-2.5 overflow-x-auto pb-1">
        <button onClick={() => update("species", "all")} className={chip(species === "all")}>
          Бүгд
        </button>
        {categories.map((c) => (
          <button key={c.code} onClick={() => update("species", c.code)} className={chip(species === c.code)}>
            {c.name}
          </button>
        ))}
      </div>

      {/* filter bar */}
      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-white p-3.5">
        <input
          defaultValue={params.get("q") ?? ""}
          onChange={(e) => update("q", e.target.value)}
          placeholder="Код эсвэл нэрээр хайх (ж: U9, Алтайн угалз)"
          className="h-[42px] min-w-[180px] flex-1 rounded-[9px] border border-line bg-[#FAF8F4] px-3.5 text-[13.5px] outline-none focus:border-navy"
        />
        <select
          defaultValue={params.get("aimag") ?? "all"}
          onChange={(e) => update("aimag", e.target.value)}
          className="h-[42px] rounded-[9px] border border-line bg-[#FAF8F4] px-3 text-[13.5px] text-ink-strong"
        >
          <option value="all">Бүх аймаг</option>
          {aimags.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <div className="flex gap-1.5 rounded-[9px] border border-line bg-[#F3F0E9] p-1">
          {STATUS_TABS.map(([k, label]) => {
            const on = status === k;
            return (
              <button
                key={k}
                onClick={() => update("status", k)}
                className="rounded-md px-3 py-1.5 text-[13px]"
                style={{ background: on ? "#FFF" : "transparent", color: on ? "#14294A" : "#5B6677", fontWeight: on ? 700 : 500 }}
              >
                {label}
              </button>
            );
          })}
        </div>
        <select
          defaultValue={params.get("sort") ?? "ending"}
          onChange={(e) => update("sort", e.target.value)}
          className="ml-auto h-[42px] rounded-[9px] border border-line bg-[#FAF8F4] px-3 text-[13.5px] text-ink-strong"
        >
          <option value="ending">Эрэмбэ: Дуусах дөхсөн</option>
          <option value="priceAsc">Үнэ: Багаас их</option>
          <option value="priceDesc">Үнэ: Ихээс бага</option>
        </select>
      </div>
    </>
  );
}
