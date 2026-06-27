import { AdminNav } from "@/components/AdminNav";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-admin-bg">
      <AdminNav active="/admin" />
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
