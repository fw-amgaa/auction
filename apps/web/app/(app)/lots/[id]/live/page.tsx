import Link from "next/link";
import { notFound } from "next/navigation";

import { getLotDetail } from "@/lib/lots";

export const dynamic = "force-dynamic";

export default async function LiveRoomPlaceholder({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lot = await getLotDetail(id);
  if (!lot) notFound();

  return (
    <main className="mx-auto max-w-2xl py-10 text-center">
      <h1 className="text-2xl font-bold text-navy">
        {lot.species}:{lot.code} — Шууд танхим
      </h1>
      <div className="mt-6 rounded-card border border-dashed border-line bg-card p-12">
        <div className="text-base font-semibold text-navy">Бодит цагийн дуудлагын танхим</div>
        <div className="mt-2 text-sm text-muted">5-р шат (Дуудлагын систем)-д хийгдэнэ.</div>
        <Link href={`/lots/${lot.id}`} className="mt-6 inline-block text-sm font-semibold text-crimson">
          ‹ Лот руу буцах
        </Link>
      </div>
    </main>
  );
}
