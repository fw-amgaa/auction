import { GuidedTour, type TourStep } from "@/components/GuidedTour";
import { LotCard } from "@/components/LotCard";
import { getUserCodes } from "@/lib/eligibility";
import { getCatalogLots, getCategoryOptions } from "@/lib/lots";
import { getCurrentUser } from "@/lib/session";

import { CatalogFilters } from "./CatalogFilters";

const TOUR: TourStep[] = [
  { sel: '[data-tour="species"]', title: "Ангиллаар сонгох", body: "Эндээс ангиллаа шүүж үзнэ — Алтайн угалз, Алтайн тэх." },
  { sel: '[data-tour="lots"] a', title: "Лотын карт", body: "Төлөв, үнэ, үлдсэн хугацааг нэг харцаар. ШУУД лотууд улаанаар цохилно." },
  { sel: 'a[href="/balance"]', title: "Таны үлдэгдэл", body: "Санал өгөх лимит энд харагдана. Санал өгөхөд барьцаалагдаж, давуулбал буцна." },
  { sel: 'a[href="/notifications"]', title: "Мэдэгдэл", body: "Таныг давуулсан тэр даруйд бид мэдэгдэнэ. Уншаагүй мэдэгдэл улаанаар тоологдоно." },
  { sel: 'a[href="/help"]', title: "Тусламж", body: "Энэ танилцуулгыг хүссэн үедээ Тусламж хэсгээс дахин үзэх боломжтой." },
];

export const dynamic = "force-dynamic";

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ species?: string; status?: string; aimag?: string; q?: string; sort?: string }>;
}) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  const codes = user && user.role !== "admin" ? await getUserCodes(user.id) : [];
  const viewer = user ? { role: user.role, codes } : null;
  const [{ lots, aimags }, categories] = await Promise.all([
    getCatalogLots(sp, viewer),
    getCategoryOptions(),
  ]);
  const liveCount = lots.filter((l) => l.status === "live").length;

  return (
    <main>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-navy">Дуудлага худалдааны каталог</h1>
          <p className="mt-1.5 max-w-2xl text-sm text-ink-soft">
            Зэрлэг ан амьтан агнах эрхийн албан ёсны дуудлага худалдаа. Амьтны төрлөөр сонгож, шууд
            явагдаж буй танхимд оролцоно уу.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-[9px] border border-line bg-white px-3 py-2">
          <span className="size-2 rounded-full bg-crimson" style={{ animation: "livedot 1.5s infinite" }} />
          <span className="text-[13px] text-ink-strong">
            <strong className="text-crimson">{liveCount}</strong> лот шууд явагдаж байна
          </span>
        </div>
      </div>

      <CatalogFilters categories={categories.map((c) => ({ code: c.code, name: c.name }))} aimags={aimags} />

      <div className="mt-4 text-[13.5px] text-ink-soft">
        <strong className="text-navy">{lots.length}</strong> лот олдлоо
      </div>

      <div data-tour="lots" className="mt-3.5 grid grid-cols-[repeat(auto-fill,minmax(290px,1fr))] gap-[18px]">
        {lots.map((lot) => (
          <LotCard key={lot.id} lot={lot} />
        ))}
      </div>

      {lots.length === 0 && (
        <div className="mt-3.5 rounded-[14px] border border-dashed border-[#D8D2C4] bg-white px-5 py-14 text-center">
          <div className="text-base font-semibold text-ink-strong">Тохирох лот олдсонгүй</div>
          <div className="mt-1.5 text-[13.5px] text-muted">
            Шүүлтүүрээ өөрчилж эсвэл бусад амьтны төрлийг үзнэ үү.
          </div>
        </div>
      )}

      <GuidedTour steps={TOUR} storageKey="wpa_app_tour" />
    </main>
  );
}
