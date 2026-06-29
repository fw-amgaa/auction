"use client";

import { usePathname } from "next/navigation";

import { AppNav } from "@/components/AppNav";
import type { NotifPreview } from "@/components/NotificationBell";

const NAV_HREFS = ["/catalog", "/my-bids", "/balance", "/notifications", "/help"];

export function AppShell({
  balance,
  unread,
  notifications,
  userName,
  isAdmin,
  children,
}: {
  balance: number;
  unread: number;
  notifications: NotifPreview[];
  userName: string;
  isAdmin: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";

  // The live bidding room is the one dark surface in the app. When we're in
  // it, the header and the page background switch to the arena palette so the
  // chrome reads as part of the room rather than a bright strip above it.
  const arena = /^\/lots\/[^/]+\/live$/.test(pathname);

  // Highlight the section the user is currently in.
  const active = NAV_HREFS.find((h) => pathname === h || pathname.startsWith(`${h}/`));

  return (
    <div className="min-h-screen" style={arena ? { background: "var(--color-arena)" } : undefined}>
      <AppNav
        active={active}
        balance={balance}
        unread={unread}
        notifications={notifications}
        userName={userName}
        isAdmin={isAdmin}
        arena={arena}
      />
      {arena ? children : <div className="mx-auto max-w-6xl px-5 py-8">{children}</div>}
    </div>
  );
}
