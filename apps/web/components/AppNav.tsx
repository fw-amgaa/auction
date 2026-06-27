import Link from "next/link";

import { formatTugrug } from "@auction/shared";

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
}: {
  active?: string;
  balance?: number;
  unread?: number;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-card/90 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-5">
        <Link href="/catalog" className="font-semibold text-navy">
          Ан агнуур
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
          <span className="hidden rounded-pill bg-sand px-3 py-1.5 text-sm sm:inline">
            <span className="text-ink-soft">Үлдэгдэл: </span>
            <span className="tnum font-medium">{formatTugrug(balance)}</span>
          </span>
          <span className="relative grid size-9 place-items-center rounded-full bg-sand">
            <span aria-hidden>🔔</span>
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-crimson text-[10px] font-semibold text-white">
                {unread}
              </span>
            )}
          </span>
          <span className="size-9 rounded-full bg-navy" aria-hidden />
        </div>
      </nav>
    </header>
  );
}
