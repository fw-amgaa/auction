import { asc, count, desc, eq, ne, sum } from "drizzle-orm";
import Link from "next/link";

import { db, schema } from "@auction/db";
import { formatTugrug } from "@auction/shared";

import { AdminTopbar } from "@/components/AdminTopbar";
import { LocalTime } from "@/components/LocalTime";
import { requireAdmin } from "@/lib/session";
import { mintTicket, wsUrl } from "@/lib/ws-ticket";

import { AdminLiveBoard, type LiveBoardLot } from "./AdminLiveBoard";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const admin = await requireAdmin();
  const [[liveN], [schedN], [pendingN], [usersN], [limitSum], liveLots, soonLots, recentAudit] =
    await Promise.all([
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
        .orderBy(asc(schema.lots.endsAt)),
      db
        .select({ lot: schema.lots, category: schema.categories })
        .from(schema.lots)
        .innerJoin(schema.categories, eq(schema.lots.categoryId, schema.categories.id))
        .where(eq(schema.lots.status, "scheduled"))
        .orderBy(asc(schema.lots.startsAt)),
      db
        .select({ action: schema.auditLog.action, createdAt: schema.auditLog.createdAt, actor: schema.users.email })
        .from(schema.auditLog)
        .leftJoin(schema.users, eq(schema.auditLog.actorId, schema.users.id))
        .orderBy(desc(schema.auditLog.createdAt))
        .limit(6),
    ]);

  const liveBoardLots: LiveBoardLot[] = liveLots.map(({ lot, category }) => ({
    id: lot.id,
    code: lot.code,
    species: category.name,
    reserve: lot.reserve,
    currentPrice: lot.currentPrice,
    endsAt: lot.endsAt?.getTime() ?? null,
  }));
  const ticket = mintTicket({ uid: admin.id, role: admin.role, kyc: admin.kyc, limit: admin.limit });

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
        <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-4">
          {kpis.map((k) => (
            <Link key={k.label} href={k.href} className="rounded-2xl border border-line-cool bg-white p-5 transition-shadow hover:shadow-sm">
              <div className="truncate text-[11.5px] font-semibold text-muted">{k.label}</div>
              <div className="tnum mt-1.5 truncate text-[22px] font-bold leading-tight" style={{ color: k.tone }}>
                {k.value}
              </div>
            </Link>
          ))}
        </div>

        {/* live (real-time WS board) + starting-soon side by side */}
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <AdminLiveBoard initial={liveBoardLots} ticket={ticket} wsBase={wsUrl()} />
          <LotTable
            title="Удахгүй эхлэх дуудлага"
            badge={<span className="flex items-center gap-1.5 text-[12px] font-semibold text-[#1B5FA8]"><span className="size-2 rounded-full bg-[#1B5FA8]" /> ТӨЛӨВЛӨСӨН</span>}
            cols={["Код", "Зүйл", "Босго үнэ", "Эхлэх"]}
            rows={soonLots.map(({ lot, category }) => ({
              href: `/admin/lots/${lot.id}`,
              code: lot.code,
              species: category.name,
              price: formatTugrug(lot.reserve),
              when: lot.startsAt?.toISOString() ?? null,
            }))}
            empty="Төлөвлөсөн лот алга."
          />
        </div>

        {/* recent activity */}
        <div className="mt-5 overflow-hidden rounded-2xl border border-line-cool bg-white">
          <div className="border-b border-[#EBEEF3] px-5 py-3.5">
            <h2 className="text-sm font-bold text-navy">Сүүлийн үйлдэл</h2>
          </div>
          <div className="grid gap-px bg-[#F1F3F6] sm:grid-cols-2">
            {recentAudit.map((a, i) => (
              <div key={i} className="flex items-center justify-between gap-3 bg-white px-5 py-3">
                <div className="min-w-0">
                  <div className="truncate font-mono text-[12px] text-ink-strong">{a.action}</div>
                  <div className="truncate text-[11px] text-muted">{a.actor ?? "систем"}</div>
                </div>
                <LocalTime value={a.createdAt.toISOString()} mode="short" className="tnum shrink-0 text-[11px] text-muted" />
              </div>
            ))}
          </div>
          {recentAudit.length === 0 && <div className="px-5 py-8 text-center text-[13px] text-muted">Үйлдэл алга.</div>}
          <Link href="/admin/audit" className="block border-t border-[#EBEEF3] px-5 py-3 text-center text-[12.5px] font-semibold text-crimson">
            Бүх аудит лог →
          </Link>
        </div>
      </div>
    </div>
  );
}

function LotTable({
  title,
  badge,
  cols,
  rows,
  empty,
}: {
  title: string;
  badge: React.ReactNode;
  cols: string[];
  rows: { href: string; code: string; species: string; price: string; when: string | null }[];
  empty: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line-cool bg-white">
      <div className="flex items-center justify-between border-b border-[#EBEEF3] px-5 py-3.5">
        <h2 className="text-sm font-bold text-navy">{title}</h2>
        {badge}
      </div>
      <div className="grid grid-cols-[70px_1fr_auto_auto] gap-3 border-b border-[#EBEEF3] bg-[#F7F8FA] px-5 py-2.5 text-[11px] font-bold uppercase tracking-wide text-muted">
        <span>{cols[0]}</span>
        <span>{cols[1]}</span>
        <span className="text-right">{cols[2]}</span>
        <span className="text-right">{cols[3]}</span>
      </div>
      {rows.map((r) => (
        <Link key={r.href} href={r.href} className="grid grid-cols-[70px_1fr_auto_auto] items-center gap-3 border-b border-[#F1F3F6] px-5 py-3 last:border-0 hover:bg-[#F7F8FA]">
          <span className="tnum text-[12.5px] font-semibold text-navy">{r.code}</span>
          <span className="truncate text-[13px] text-navy">{r.species}</span>
          <span className="tnum text-right text-[13px] font-semibold text-navy">{r.price}</span>
          <LocalTime value={r.when} mode="short" className="tnum text-right text-[12px] text-ink-soft" />
        </Link>
      ))}
      {rows.length === 0 && <div className="px-5 py-10 text-center text-[13px] text-muted">{empty}</div>}
    </div>
  );
}
