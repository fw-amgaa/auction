import { AppShell } from "@/components/AppShell";
import { getUnreadCount } from "@/lib/notifications";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const available = user.limit - user.committedCache;
  const unread = await getUnreadCount(user.id);

  return (
    <AppShell
      balance={available}
      unread={unread}
      userName={user.name ?? user.email}
      isAdmin={user.role === "admin"}
    >
      {children}
    </AppShell>
  );
}
