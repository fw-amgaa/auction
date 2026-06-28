"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Logo } from "@/components/Logo";
import { logout } from "@/lib/session-actions";

const LINKS: { href: string; label: string; icon: string[]; exact?: boolean; badge?: boolean }[] = [
  { href: "/admin", label: "Шууд хяналт", icon: ["M3 3v18h18", "M7 14l3-4 3 3 4-6"], exact: true },
  { href: "/admin/kyc", label: "KYC хүсэлт", icon: ["M16 11a4 4 0 1 0-8 0", "M4 21a8 8 0 0 1 16 0", "M17 8l1.5 1.5L21 6"], badge: true },
  { href: "/admin/users", label: "Хэрэглэгчид", icon: ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"] },
  { href: "/admin/limits", label: "Лимит удирдлага", icon: ["M12 2v20", "M5 7h14", "M5 12h14", "M5 17h14"] },
  { href: "/admin/lots", label: "Лот удирдлага", icon: ["M3 7l9-4 9 4-9 4-9-4z", "M3 12l9 4 9-4", "M3 17l9 4 9-4"] },
  { href: "/admin/results", label: "Үр дүн / экспорт", icon: ["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z", "M14 2v6h6", "M9 13l2 2 4-4"] },
  { href: "/admin/audit", label: "Аудит лог", icon: ["M12 8v4l3 2", "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z"] },
];

function Icon({ d }: { d: string[] }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {d.map((p, i) => (
        <path key={i} d={p} />
      ))}
    </svg>
  );
}

export function AdminNav({ adminName, pendingKyc = 0 }: { adminName: string; pendingKyc?: number }) {
  const pathname = usePathname();
  const initials =
    adminName.split(/\s+/).map((p) => p.replace(".", "")[0] ?? "").join("").slice(0, 2).toUpperCase() || "А";

  return (
    <aside className="flex w-60 shrink-0 flex-col bg-navy-deep text-[#C7D4E6]">
      <div className="border-b border-white/10 px-4 pb-4 pt-[18px]">
        <Logo chip />
        <div className="mt-2.5 text-center text-[10px] font-semibold tracking-[0.1em] text-[#7E92B2]">
          АДМИН ПАНЕЛ
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 p-3">
        {LINKS.map((l) => {
          const active = l.exact ? pathname === l.href : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className="flex items-center gap-3 rounded-[9px] px-3 py-2.5 text-[13.5px] transition-colors"
              style={{
                background: active ? "#C8312C" : "transparent",
                color: active ? "#fff" : "#A9BAD4",
                fontWeight: active ? 700 : 500,
              }}
            >
              <Icon d={l.icon} />
              <span className="flex-1">{l.label}</span>
              {l.badge && pendingKyc > 0 && (
                <span className="tnum grid h-[18px] min-w-[18px] place-items-center rounded-full bg-crimson px-1.5 text-[10.5px] font-bold text-white">
                  {pendingKyc}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-3">
        <Link
          href="/catalog"
          className="mb-1 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12.5px] text-[#A9BAD4] transition-colors hover:bg-white/5 hover:text-white"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 3h6v6" />
            <path d="M10 14 21 3" />
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          </svg>
          Биддерийн сайт харах
        </Link>
        <div className="flex items-center gap-2.5 rounded-[9px] bg-white/[0.04] px-2.5 py-2">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-success text-[12px] font-bold text-white">
            {initials}
          </span>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-[12.5px] font-semibold text-white">{adminName}</div>
            <div className="text-[10.5px] text-[#7E92B2]">Зохион байгуулагч</div>
          </div>
        </div>
        <form action={logout}>
          <button type="submit" className="mt-1 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12.5px] text-[#7E92B2] transition-colors hover:text-white">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="m16 17 5-5-5-5" />
              <path d="M21 12H9" />
            </svg>
            Гарах
          </button>
        </form>
      </div>
    </aside>
  );
}
