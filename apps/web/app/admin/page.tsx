import { count, desc, eq, ne, sum } from "drizzle-orm";
import Link from "next/link";

import { db, schema } from "@auction/db";
import { formatTugrug } from "@auction/shared";

import { AdminTopbar } from "@/components/AdminTopbar";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const [
    [liveN],
    [schedN],
    [pendingN],
    [usersN],
    [limitSum],
    liveLots,
    recentAudit,
  ] = await Promise.all([
    db.select({ n: count() }).from(schema.lots).where(eq(schema.lots.status, "live")),
    db.select({ n: count() }).from(schema.lots).where(eq(schema.lots.status, "scheduled")),
    db.select({ n: count() }).from(schema.users).where(eq(schema.users.kyc, "pending")),
    db.select({ n: count() }).from(schema.users).where(ne(schema.users.role, "admin")),
    db.select({ s: sum(schema.users.limit) }).from(schema.users),
    db
      .select({ lot: schema.lots, category: schema.categories })
      .from(schema.lots)
      .innerJoin(schema.categories, eq(schema.lots.categoryId, schema.categories.id))
      .where(eq(schema.lots.status, "live"))
      .orderBy(schema.lots.endsAt),
    db
      .select({
        action: schema.auditLog.action,
        createdAt: schema.auditLog.createdAt,
        actor: schema.users.email,
      })
      .from(schema.auditLog)
      .leftJoin(schema.users, eq(schema.auditLog.actorId, schema.users.id))
      .orderBy(desc(schema.auditLog.createdAt))
      .limit(6),
  ]);

  const kpis: { label: string; value: string; href: string; tone: string }[] = [
    { label: "Шууд явагдаж буй лот", value: String(liveN?.n ?? 0), href: "/admin/lots", tone: "#C8312C" },
    { label: "Хүлээгдэж буй KYC", value: String(pendingN?.n ?? 0), href: "/admin/kyc", tone: "#C77A0A" },
    { label: "Төлөвлөсөн лот", value: String(schedN?.n ?? 0), href: "/admin/lots", tone: "#1B5FA8" },
    { label: "Нийт хэрэглэгч", value: String(usersN?.n ?? 0), href: "/admin/users", tone: "#14294A" },
    { label: "Олгосон нийт лимит", value: formatTugrug(Number(limitSum?.s ?? 0)), href: "/admin/limits", tone: "#1F8A5B" },
  ];

  return (
    <div>
      <AdminTopbar title="Шууд хяналт">
        <Link href="/admin/lots" className="rounded-[9px] bg-crimson px-4 py-2.5 text-[13.5px] font-bold text-white hover:bg-crimson-hover">
          + Шинэ лот
        </Link>
      </AdminTopbar>

      <div className="p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {kpis.map((k) => (
            <Link key={k.label} href={k.href} className="rounded-2xl border border-line-cool bg-white p-5 transition-shadow hover:shadow-sm">
              <div className="text-[11.5px] font-semibold text-muted">{k.label}</div>
              <div className="tnum mt-1.5 text-3xl font-bold" style={{ color: k.tone }}>
                {k.value}
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[1.6fr_1fr]">
          {/* live lots */}
          <div className="overflow-hidden rounded-2xl border border-line-cool bg-white">
            <div className="flex items-center justify-between border-b border-[#EBEEF3] px-5 py-3.5">
              <h2 className="text-sm font-bold text-navy">Шууд явагдаж буй дуудлага</h2>
              <span className="flex items-center gap-1.5 text-[12px] font-semibold text-crimson">
                <span className="size-2 rounded-full bg-crimson" style={{ animation: "livedot 1.5s infinite" }} /> LIVE
              </span>
            </div>
            <div className="grid grid-cols-[80px_1fr_1fr_1fr] gap-3 border-b border-[#EBEEF3] bg-[#F7F8FA] px-5 py-2.5 text-[11px] font-bold uppercase tracking-wide text-muted">
              <span>Код</span>
              <span>Зүйл</span>
              <span className="text-right">Одоогийн үнэ</span>
              <span className="text-right">Дуусах</span>
            </div>
            {liveLots.map(({ lot, category }) => (
              <Link
                key={lot.id}
                href={`/lots/${lot.id}/live`}
                className="grid grid-cols-[80px_1fr_1fr_1fr] items-center gap-3 border-b border-[#F1F3F6] px-5 py-3 last:border-0 hover:bg-[#F7F8FA]"
              >
                <span className="tnum text-[12.5px] font-semibold text-navy">{lot.code}</span>
                <span className="truncate text-[13px] text-navy">{category.name}</span>
                <span className="tnum text-right text-[13px] font-semibold text-navy">
                  {formatTugrug(lot.currentPrice ?? lot.reserve)}
                </span>
                <span className="tnum text-right text-[12px] text-ink-soft">
                  {lot.endsAt ? lot.endsAt.toISOString().slice(5, 16).replace("T", " ") : "—"}
                </span>
              </Link>
            ))}
            {liveLots.length === 0 && (
              <div className="px-5 py-10 text-center text-[13px] text-muted">Одоогоор шууд лот алга.</div>
            )}
          </div>

          {/* recent activity */}
          <div className="overflow-hidden rounded-2xl border border-line-cool bg-white">
            <div className="border-b border-[#EBEEF3] px-5 py-3.5">
              <h2 className="text-sm font-bold text-navy">Сүүлийн үйлдэл</h2>
            </div>
            {recentAudit.map((a, i) => (
              <div key={i} className="flex items-center justify-between gap-3 border-b border-[#F1F3F6] px-5 py-3 last:border-0">
                <div className="min-w-0">
                  <div className="truncate font-mono text-[12px] text-ink-strong">{a.action}</div>
                  <div className="truncate text-[11px] text-muted">{a.actor ?? "систем"}</div>
                </div>
                <span className="tnum shrink-0 text-[11px] text-muted">
                  {a.createdAt.toISOString().slice(5, 16).replace("T", " ")}
                </span>
              </div>
            ))}
            {recentAudit.length === 0 && (
              <div className="px-5 py-10 text-center text-[13px] text-muted">Үйлдэл алга.</div>
            )}
            <Link href="/admin/audit" className="block border-t border-[#EBEEF3] px-5 py-3 text-center text-[12.5px] font-semibold text-crimson">
              Бүх аудит лог →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
