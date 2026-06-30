import { asc, eq, inArray } from "drizzle-orm";

import { db, schema } from "@auction/db";

import { AdminTopbar } from "@/components/AdminTopbar";
import { requirePageAccess } from "@/lib/session";

import { AdminsManager, type DashboardUser } from "./AdminsManager";

export const dynamic = "force-dynamic";

export default async function AdminsPage() {
  const { user } = await requirePageAccess("admins.manage");

  const admins = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      disabled: schema.users.disabled,
      emailVerified: schema.users.emailVerified,
      createdAt: schema.users.createdAt,
    })
    .from(schema.users)
    .where(eq(schema.users.role, "admin"))
    .orderBy(asc(schema.users.createdAt));

  const ids = admins.map((a) => a.id);
  const permRows = ids.length
    ? await db
        .select({ userId: schema.userPermissions.userId, permission: schema.userPermissions.permission })
        .from(schema.userPermissions)
        .where(inArray(schema.userPermissions.userId, ids))
    : [];
  const byUser = new Map<string, string[]>();
  for (const r of permRows) {
    const list = byUser.get(r.userId) ?? [];
    list.push(r.permission);
    byUser.set(r.userId, list);
  }

  const users: DashboardUser[] = admins.map((a) => ({
    id: a.id,
    name: a.name ?? a.email,
    email: a.email,
    disabled: a.disabled,
    awaitingSetup: !a.emailVerified,
    permissions: byUser.get(a.id) ?? [],
  }));

  return (
    <div>
      <AdminTopbar
        title={
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-navy">Админ эрх</h1>
            <span className="tnum rounded-md bg-admin-bg px-2.5 py-1 text-[11.5px] font-semibold text-ink-soft">
              {users.length} дашбоард хэрэглэгч
            </span>
          </div>
        }
      />
      <div className="p-6">
        <AdminsManager users={users} currentUserId={user.id} />
      </div>
    </div>
  );
}
