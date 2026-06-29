import { AppShell } from "@/components/AppShell";
import type { NotifPreview } from "@/components/NotificationBell";
import { getNotifications, getUnreadCount } from "@/lib/notifications";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const available = user.limit - user.committedCache;
  const [unread, recent] = await Promise.all([
    getUnreadCount(user.id),
    getNotifications(user.id),
  ]);
  const notifications: NotifPreview[] = recent.slice(0, 8).map((n) => ({
    id: n.id,
    icon: n.icon,
    iconBg: n.iconBg,
    iconFg: n.iconFg,
    title: n.title,
    body: n.body,
    createdAt: n.createdAt.toISOString(),
    read: n.read,
  }));

  return (
    <AppShell
      balance={available}
      unread={unread}
      notifications={notifications}
      userName={user.name ?? user.email}
      isAdmin={user.role === "admin"}
    >
      {children}
    </AppShell>
  );
}
