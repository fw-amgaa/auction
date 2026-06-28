import { AppNav } from "@/components/AppNav";
import { getUnreadCount } from "@/lib/notifications";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const available = user.limit - user.committedCache;
  const unread = await getUnreadCount(user.id);

  return (
    <div className="min-h-screen">
      <AppNav
        balance={available}
        unread={unread}
        userName={user.name ?? user.email}
        isAdmin={user.role === "admin"}
      />
      <div className="mx-auto max-w-6xl px-5 py-8">{children}</div>
    </div>
  );
}
