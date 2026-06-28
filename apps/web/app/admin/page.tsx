import { count, eq, ne } from "drizzle-orm";

import { db, schema } from "@auction/db";

import { AdminTopbar } from "@/components/AdminTopbar";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const [[pending], [users], [live]] = await Promise.all([
    db.select({ n: count() }).from(schema.users).where(eq(schema.users.kyc, "pending")),
    db.select({ n: count() }).from(schema.users).where(ne(schema.users.role, "admin")),
    db.select({ n: count() }).from(schema.lots).where(eq(schema.lots.status, "live")),
  ]);

  const cards: [string, number][] = [
    ["Идэвхтэй лот", live?.n ?? 0],
    ["Хүлээгдэж буй KYC", pending?.n ?? 0],
    ["Нийт хэрэглэгч", users?.n ?? 0],
  ];

  return (
    <div>
      <AdminTopbar title="Шууд хяналт" />
      <div className="p-6">
        <p className="text-sm text-ink-soft">
          Админ удирдлагын самбар. Бодит цагийн хяналтын дэлгэц дараагийн шатанд нэмэгдэнэ.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {cards.map(([label, n]) => (
            <div key={label} className="rounded-card border border-line-cool bg-card p-5">
              <div className="text-sm text-ink-soft">{label}</div>
              <div className="tnum mt-1 text-3xl font-bold text-navy">{n}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
