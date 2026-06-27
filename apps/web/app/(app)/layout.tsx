import { AppNav } from "@/components/AppNav";
import { requireUser } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const available = user.limit - user.committedCache;

  return (
    <div className="min-h-screen">
      <AppNav
        balance={available}
        unread={0}
        userName={user.name ?? user.email}
      />
      <div className="mx-auto max-w-6xl px-5 py-8">{children}</div>
    </div>
  );
}
