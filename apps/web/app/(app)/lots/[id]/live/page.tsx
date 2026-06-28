import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getLotDetail } from "@/lib/lots";
import { requireUser } from "@/lib/session";
import { mintTicket, wsUrl } from "@/lib/ws-ticket";

import { LiveRoom } from "./LiveRoom";

export const dynamic = "force-dynamic";

export default async function LiveRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const lot = await getLotDetail(id, user.id);
  if (!lot) notFound();

  // Only live lots are biddable; otherwise send to the detail page.
  if (lot.status !== "live") redirect(`/lots/${id}`);

  // KYC gate
  if (user.kyc !== "approved") {
    return (
      <main className="mx-auto max-w-xl py-12 text-center">
        <h1 className="text-2xl font-bold text-navy">Баталгаажуулалт шаардлагатай</h1>
        <p className="mt-3 text-sm text-ink-soft">
          Дуудлага худалдаанд оролцохын тулд таны KYC баталгаажсан байх ёстой.
          {user.kyc === "pending" ? " Таны хүсэлт хүлээгдэж байна." : ""}
        </p>
        <Link href={`/lots/${id}`} className="mt-6 inline-block text-sm font-semibold text-crimson">
          ‹ Лот руу буцах
        </Link>
      </main>
    );
  }

  const ticket = mintTicket({
    uid: user.id,
    role: user.role,
    kyc: user.kyc,
    limit: user.limit,
  });

  return (
    <LiveRoom
      lotId={lot.id}
      code={lot.code}
      species={lot.species}
      latin={lot.latin}
      aimag={lot.aimag}
      reserve={lot.reserve}
      ticket={ticket}
      wsBase={wsUrl()}
    />
  );
}
