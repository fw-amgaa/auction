import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { db, schema } from "@auction/db";
import { formatTugrug } from "@auction/shared";

import { LocalTime } from "@/components/LocalTime";
import { PrintButton } from "@/components/PrintButton";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function PermitPage({ params }: { params: Promise<{ lotId: string }> }) {
  await requireAdmin();
  const { lotId } = await params;
  const [row] = await db
    .select({ lot: schema.lots, category: schema.categories })
    .from(schema.lots)
    .innerJoin(schema.categories, eq(schema.lots.categoryId, schema.categories.id))
    .where(eq(schema.lots.id, lotId))
    .limit(1);
  if (!row || !row.lot.winnerUserId || !row.lot.permitIssuedAt) notFound();

  const winner = await db.query.users.findFirst({
    where: eq(schema.users.id, row.lot.winnerUserId),
    with: { individualProfile: true, legalEntityProfile: true },
  });
  const winnerName =
    winner?.accountType === "legal_entity"
      ? (winner.legalEntityProfile?.registeredName ?? winner.email)
      : [winner?.individualProfile?.surname, winner?.individualProfile?.givenName].filter(Boolean).join(" ") || winner?.email;
  const registry =
    winner?.accountType === "legal_entity"
      ? winner.legalEntityProfile?.registryNumber
      : winner?.individualProfile?.registryNumber;

  const permitNo = `${row.lot.code}-${row.lot.permitIssuedAt.getFullYear()}`;
  const issued = <LocalTime value={row.lot.permitIssuedAt.toISOString()} mode="date" />;

  return (
    <div className="min-h-screen bg-white p-10 text-ink-strong">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex justify-end print:hidden">
          <PrintButton />
        </div>

        <div className="rounded-2xl border-2 border-navy p-10">
          <div className="text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/emblem.png" alt="" className="mx-auto h-16 w-auto" />
            <div className="mt-4 text-xl font-bold text-navy">АГНУУРЫН ТУСГАЙ ЗОРИУЛАЛТЫН ЭРХ</div>
            <div className="mt-1 text-sm text-ink-soft">Зэрлэг ан амьтан агнах зөвшөөрөл</div>
          </div>

          <div className="my-7 h-px bg-line" />

          <div className="grid grid-cols-2 gap-x-8 gap-y-5 text-sm">
            <Field k="Зөвшөөрлийн дугаар" v={permitNo} />
            <Field k="Олгосон огноо" v={issued} />
            <Field k="Амьтны зүйл" v={`${row.category.name} (${row.category.latinName ?? "—"})`} />
            <Field k="Лотын код" v={`${row.category.name}:${row.lot.code}`} />
            <Field k="Бүс нутаг" v={row.lot.aimag ?? "—"} />
            <Field k="Хожсон үнэ" v={formatTugrug(row.lot.currentPrice ?? row.lot.reserve)} />
            <Field k="Эрх эзэмшигч" v={winnerName ?? "—"} />
            <Field k="Регистр / ТТД" v={registry ?? "—"} />
          </div>

          <div className="my-7 h-px bg-line" />

          <p className="text-[13px] leading-relaxed text-ink-soft">
            Энэхүү зөвшөөрөл нь дээр дурдсан нэг бодгаль амьтныг агнуурын улирал, бүсийн дүрэм журмын
            дагуу агнах эрхийг олгоно. Зөвшөөрөл нь зөвхөн нэрлэгдсэн эрх эзэмшигчид хүчинтэй.
          </p>

          <div className="mt-12 flex justify-between text-sm">
            <div>
              <div className="mb-10 text-ink-soft">Олгосон байгууллага:</div>
              <div className="border-t border-ink-strong pt-1 font-semibold">Байгаль орчны газар</div>
            </div>
            <div className="text-right">
              <div className="mb-10 text-ink-soft">Тамга, гарын үсэг:</div>
              <div className="border-t border-ink-strong pt-1">________________________</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11.5px] font-semibold uppercase tracking-wide text-muted">{k}</div>
      <div className="mt-1 font-semibold text-navy">{v}</div>
    </div>
  );
}
