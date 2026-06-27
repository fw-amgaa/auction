import { AdminNav } from "@/components/AdminNav";
import { requireAdmin } from "@/lib/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="flex min-h-screen bg-admin-bg">
      <AdminNav active="/admin" />
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
