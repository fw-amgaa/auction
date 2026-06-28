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

  // KYC gate — rendered inside the dark arena shell, so it's themed to match.
  if (user.kyc !== "approved") {
    return (
      <main className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center px-5 py-16 text-center text-[#F2F4F8]">
        <span className="grid size-14 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-2xl">
          🔒
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">Баталгаажуулалт шаардлагатай</h1>
        <p className="mt-3 text-sm leading-relaxed text-[#AEB9CB]">
          Дуудлага худалдаанд оролцохын тулд таны KYC баталгаажсан байх ёстой.
          {user.kyc === "pending" ? " Таны хүсэлт хүлээгдэж байна." : ""}
        </p>
        <Link
          href={`/lots/${id}`}
          className="mt-7 inline-block rounded-xl border border-white/15 px-5 py-2.5 text-sm font-semibold text-[#F2F4F8] transition-colors hover:bg-white/5"
        >
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
      title={lot.title}
      image={lot.image}
      ticket={ticket}
      wsBase={wsUrl()}
    />
  );
}
