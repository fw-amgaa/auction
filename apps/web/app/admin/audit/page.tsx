import { desc, eq } from "drizzle-orm";

import { db, schema } from "@auction/db";

import { AdminTopbar } from "@/components/AdminTopbar";
import { LocalTime } from "@/components/LocalTime";

export const dynamic = "force-dynamic";

export default async function AdminAuditPage() {
  const rows = await db
    .select({
      id: schema.auditLog.id,
      action: schema.auditLog.action,
      targetType: schema.auditLog.targetType,
      targetId: schema.auditLog.targetId,
      createdAt: schema.auditLog.createdAt,
      actorEmail: schema.users.email,
    })
    .from(schema.auditLog)
    .leftJoin(schema.users, eq(schema.auditLog.actorId, schema.users.id))
    .orderBy(desc(schema.auditLog.createdAt))
    .limit(100);

  return (
    <div>
      <AdminTopbar title="Аудит лог" />
      <div className="p-6">
        <div className="overflow-hidden rounded-2xl border border-line-cool bg-white">
          <div className="grid grid-cols-[160px_1.2fr_1fr_1.4fr] gap-3 border-b border-[#EBEEF3] bg-[#F7F8FA] px-[18px] py-3 text-[11px] font-bold uppercase tracking-wide text-muted">
            <span>Огноо</span>
            <span>Админ</span>
            <span>Үйлдэл</span>
            <span>Бай</span>
          </div>
          {rows.map((r) => (
            <div
              key={r.id}
              className="grid grid-cols-[160px_1.2fr_1fr_1.4fr] gap-3 border-b border-[#F1F3F6] px-[18px] py-2.5 text-[13px] last:border-0"
            >
              <LocalTime value={r.createdAt.toISOString()} mode="datetime" className="tnum text-ink-soft" />
              <span className="truncate text-navy">{r.actorEmail ?? "систем"}</span>
              <span className="font-mono text-[12px] text-ink-strong">{r.action}</span>
              <span className="tnum truncate text-muted">
                {r.targetType}:{r.targetId?.slice(0, 8)}
              </span>
            </div>
          ))}
          {rows.length === 0 && (
            <div className="px-5 py-12 text-center text-[13px] text-muted">Бичлэг алга.</div>
          )}
        </div>
      </div>
    </div>
  );
}
