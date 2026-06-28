import { AdminNav } from "@/components/AdminNav";
import { requireAdmin } from "@/lib/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="flex min-h-screen bg-admin-bg">
      <AdminNav />
      <main className="flex-1 overflow-x-hidden">{children}</main>
    </div>
  );
}
