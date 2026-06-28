"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Шууд хяналт", exact: true },
  { href: "/admin/kyc", label: "KYC хүсэлт" },
  { href: "/admin/users", label: "Хэрэглэгчид" },
  { href: "/admin/limits", label: "Лимит" },
  { href: "/admin/lots", label: "Лот" },
  { href: "/admin/results", label: "Үр дүн" },
  { href: "/admin/audit", label: "Аудит" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <aside className="flex w-60 shrink-0 flex-col gap-1 bg-navy-deep p-4 text-white">
      <div className="mb-4 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-navy">
        Админ удирдлага
      </div>
      <nav className="flex flex-col gap-1">
        {LINKS.map((l) => {
          const active = l.exact ? pathname === l.href : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-crimson font-medium text-white"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
