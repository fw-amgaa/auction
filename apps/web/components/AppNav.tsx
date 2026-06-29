import Link from "next/link";

import { formatTugrug } from "@auction/shared";

import { Logo } from "@/components/Logo";
import { NotificationBell, type NotifPreview } from "@/components/NotificationBell";
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
  notifications = [],
  userName,
  isAdmin = false,
  arena = false,
}: {
  active?: string;
  balance?: number;
  unread?: number;
  notifications?: NotifPreview[];
  userName?: string;
  isAdmin?: boolean;
  /** Dark "live arena" treatment — used on the live bidding room so the
   *  header sits flush with the dark floor instead of clashing with it. */
  arena?: boolean;
}) {
  // Colour the chrome per surface so one component serves both the light
  // app shell and the dark arena.
  const t = arena
    ? {
        header: "arena-glass border-white/[0.06]",
        link: "text-[#8E9AAE] hover:bg-white/5",
        linkActive: "font-semibold text-white",
        admin: "border-white/15 text-[#C4D0E2] hover:bg-white/10",
        pillLabel: "text-[#6E7C92]",
        pill: "bg-white/[0.05] text-[#E4E9F1]",
        avatar: "bg-[#E03B4B] text-white",
        logout: "text-[#8E9AAE] hover:bg-white/5",
        accent: "#E03B4B",
      }
    : {
        header: "border-line bg-card/90",
        link: "text-ink-soft hover:bg-sand",
        linkActive: "font-semibold text-crimson",
        admin: "border-navy/20 text-navy hover:bg-navy hover:text-white",
        pillLabel: "text-ink-soft",
        pill: "bg-sand",
        avatar: "bg-navy text-white",
        logout: "text-ink-soft hover:bg-sand",
        accent: "#c8312c",
      };

  return (
    <header className={`sticky top-0 z-40 border-b backdrop-blur ${t.header}`}>
      <nav className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-5">
        <Link href="/catalog" className="shrink-0">
          <Logo height={30} chip={arena} />
        </Link>
        <ul className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => {
            const isActive = active === l.href;
            return (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`relative rounded-lg px-3 py-2 text-sm transition-colors ${
                    isActive ? t.linkActive : t.link
                  }`}
                >
                  {l.label}
                  {isActive && (
                    <span
                      className="absolute inset-x-3 -bottom-px h-0.5 rounded-full"
                      style={{ background: t.accent }}
                    />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="ml-auto flex items-center gap-3">
          {isAdmin && (
            <Link
              href="/admin"
              className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors ${t.admin}`}
            >
              Удирдлага
            </Link>
          )}
          <span className={`hidden rounded-pill px-3 py-1.5 text-sm sm:inline ${t.pill}`}>
            <span className={t.pillLabel}>Үлдэгдэл: </span>
            <span className="tnum font-medium">{formatTugrug(balance)}</span>
          </span>
          <NotificationBell items={notifications} unread={unread} arena={arena} />
          <Link
            href="/profile"
            className={`grid size-9 place-items-center rounded-full text-xs font-semibold ${t.avatar}`}
            title={userName ?? "Профайл"}
          >
            {(userName ?? "?").slice(0, 1).toUpperCase()}
          </Link>
          <form action={logout}>
            <button
              type="submit"
              className={`rounded-lg px-2.5 py-2 text-sm transition-colors ${t.logout}`}
            >
              Гарах
            </button>
          </form>
        </div>
      </nav>
    </header>
  );
}
