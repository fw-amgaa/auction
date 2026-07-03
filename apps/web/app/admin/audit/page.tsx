import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";

import { db, schema } from "@auction/db";

import { AdminTopbar } from "@/components/AdminTopbar";
import { Pagination } from "@/components/admin/Pagination";
import { requirePageAccess } from "@/lib/session";

import { AuditTable, type AuditEntry } from "./AuditTable";
import { AuditToolbar } from "./AuditToolbar";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

/**
 * actorId/targetId are matched against uuid columns; a non-UUID value (a tampered
 * `?actor=` param, or a non-UUID audit target like the category code recorded by
 * lot.create_bulk) makes Postgres throw `invalid input syntax for type uuid`.
 * Guard every value before it reaches a uuid comparison.
 */
const isUuid = (s: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

interface SP {
  actor?: string;
  action?: string;
  from?: string;
  to?: string;
  page?: string;
}

export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requirePageAccess("audit.view");
  const sp = await searchParams;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  // ── build filter conditions ──────────────────────────────────────────────
  const conds = [];
  if (sp.actor && sp.actor !== "all" && isUuid(sp.actor)) conds.push(eq(schema.auditLog.actorId, sp.actor));
  if (sp.action && sp.action !== "all") conds.push(eq(schema.auditLog.action, sp.action));
  if (sp.from) {
    const d = new Date(sp.from);
    if (!Number.isNaN(d.getTime())) conds.push(gte(schema.auditLog.createdAt, d));
  }
  if (sp.to) {
    const d = new Date(sp.to);
    if (!Number.isNaN(d.getTime())) {
      d.setHours(23, 59, 59, 999); // inclusive end-of-day
      conds.push(lte(schema.auditLog.createdAt, d));
    }
  }
  const where = conds.length ? and(...conds) : undefined;

  // Fetch one extra row to detect whether a next page exists. The filter
  // dropdown queries are independent of the page — run all three in parallel.
  const [rows, actors, actionRows] = await Promise.all([
    db
      .select({
        id: schema.auditLog.id,
        action: schema.auditLog.action,
        targetType: schema.auditLog.targetType,
        targetId: schema.auditLog.targetId,
        meta: schema.auditLog.meta,
        createdAt: schema.auditLog.createdAt,
        actorEmail: schema.users.email,
      })
      .from(schema.auditLog)
      .leftJoin(schema.users, eq(schema.auditLog.actorId, schema.users.id))
      .where(where)
      .orderBy(desc(schema.auditLog.createdAt))
      .limit(PAGE_SIZE + 1)
      .offset((page - 1) * PAGE_SIZE),
    db
      .selectDistinct({ id: schema.users.id, email: schema.users.email })
      .from(schema.auditLog)
      .innerJoin(schema.users, eq(schema.auditLog.actorId, schema.users.id))
      .orderBy(schema.users.email),
    db
      .selectDistinct({ action: schema.auditLog.action })
      .from(schema.auditLog)
      .orderBy(schema.auditLog.action),
  ]);
  const actions = actionRows.map((a) => a.action);

  const hasNext = rows.length > PAGE_SIZE;
  const pageRows = rows.slice(0, PAGE_SIZE);

  // ── resolve target labels (users → name/email, lots → code/title) in batch ─
  // Only resolve genuine UUID targets (see isUuid note above); non-UUID targets
  // fall back to the raw `type:id` display.
  const targetIds = (type: string) =>
    [...new Set(pageRows.filter((r) => r.targetType === type && r.targetId).map((r) => r.targetId!))].filter(isUuid);
  const userIds = targetIds("user");
  const lotIds = targetIds("lot");
  const [labelUsers, labelLots] = await Promise.all([
    userIds.length
      ? db
          .select({ id: schema.users.id, email: schema.users.email, name: schema.users.name })
          .from(schema.users)
          .where(inArray(schema.users.id, userIds))
      : [],
    lotIds.length
      ? db
          .select({ id: schema.lots.id, code: schema.lots.code, title: schema.lots.title })
          .from(schema.lots)
          .where(inArray(schema.lots.id, lotIds))
      : [],
  ]);
  const labelMap = new Map<string, string>();
  for (const u of labelUsers) labelMap.set(`user:${u.id}`, u.name ? `${u.name} · ${u.email}` : u.email);
  for (const l of labelLots) labelMap.set(`lot:${l.id}`, `${l.code} — ${l.title}`);

  const entries: AuditEntry[] = pageRows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt.toISOString(),
    actorEmail: r.actorEmail,
    action: r.action,
    targetType: r.targetType,
    targetId: r.targetId,
    targetLabel:
      r.targetType && r.targetId ? (labelMap.get(`${r.targetType}:${r.targetId}`) ?? null) : null,
    meta: (r.meta ?? {}) as Record<string, unknown>,
  }));

  // ── pagination links (preserve active filters) ─────────────────────────────
  const base = new URLSearchParams();
  for (const k of ["actor", "action", "from", "to"] as const) {
    if (sp[k]) base.set(k, sp[k]!);
  }
  const pageHref = (n: number) => {
    const q = new URLSearchParams(base);
    if (n > 1) q.set("page", String(n));
    const s = q.toString();
    return s ? `/admin/audit?${s}` : "/admin/audit";
  };

  return (
    <div>
      <AdminTopbar title="Аудит лог" />
      <div className="p-6">
        <AuditToolbar actors={actors} actions={actions} />

        <AuditTable rows={entries} />

        <Pagination page={page} hasNext={hasNext} hrefFor={pageHref} />
      </div>
    </div>
  );
}
