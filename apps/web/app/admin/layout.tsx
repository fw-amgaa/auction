import { count, eq } from "drizzle-orm";

import { db, schema } from "@auction/db";

import { AdminNav } from "@/components/AdminNav";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const [pending] = await db
    .select({ n: count() })
    .from(schema.users)
    .where(eq(schema.users.kyc, "pending"));

  return (
    <div className="flex min-h-screen bg-admin-bg">
      <AdminNav adminName={admin.name ?? admin.email} pendingKyc={pending?.n ?? 0} />
      <main className="flex-1 overflow-x-hidden">{children}</main>
    </div>
  );
}
