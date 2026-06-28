import Link from "next/link";

import { formatTugrug } from "@auction/shared";

import { Logo } from "@/components/Logo";
import { logout } from "@/lib/session-actions";

const LINKS = [
  { href: "/catalog", label: "Каталог" },
  { href: "/my-bids", label: "Миний санал" },
  { href: "/balance", label: "Үлдэгдэл" },
  { href: "/notifications", label: "Мэдэгдэл" },
  { href: "/help", label: "Тусламж" },
];

export function AppNav({
  active,
  balance = 0,
  unread = 0,
  userName,
  isAdmin = false,
}: {
  active?: string;
  balance?: number;
  unread?: number;
  userName?: string;
  isAdmin?: boolean;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-card/90 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-5">
        <Link href="/catalog" className="shrink-0">
          <Logo height={30} />
        </Link>
        <ul className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className={`rounded-lg px-3 py-2 text-sm transition-colors hover:bg-sand ${
                  active === l.href ? "font-semibold text-crimson" : "text-ink-soft"
                }`}
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="ml-auto flex items-center gap-3">
          {isAdmin && (
            <Link
              href="/admin"
              className="rounded-lg border border-navy/20 px-3 py-1.5 text-sm font-semibold text-navy transition-colors hover:bg-navy hover:text-white"
            >
              Удирдлага
            </Link>
          )}
          <span className="hidden rounded-pill bg-sand px-3 py-1.5 text-sm sm:inline">
            <span className="text-ink-soft">Үлдэгдэл: </span>
            <span className="tnum font-medium">{formatTugrug(balance)}</span>
          </span>
          <Link
            href="/notifications"
            className="relative grid size-9 place-items-center rounded-full bg-sand"
          >
            <span aria-hidden>🔔</span>
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-crimson text-[10px] font-semibold text-white">
                {unread}
              </span>
            )}
          </Link>
          <Link
            href="/profile"
            className="grid size-9 place-items-center rounded-full bg-navy text-xs font-semibold text-white"
            title={userName ?? "Профайл"}
          >
            {(userName ?? "?").slice(0, 1).toUpperCase()}
          </Link>
          <form action={logout}>
            <button
              type="submit"
              className="rounded-lg px-2.5 py-2 text-sm text-ink-soft transition-colors hover:bg-sand"
            >
              Гарах
            </button>
          </form>
        </div>
      </nav>
    </header>
  );
}
