import { AdminTopbar } from "@/components/AdminTopbar";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Landing for a staff user who holds no section permissions (the redirect target
 * of requirePageAccess when nothing is accessible). Guards on staff only — never
 * on a permission — so it can't redirect-loop.
 */
export default async function NoAccessPage() {
  await requireAdmin();
  return (
    <div>
      <AdminTopbar title="Хандах эрхгүй" />
      <div className="p-6">
        <div className="rounded-2xl border border-line-cool bg-white p-12 text-center">
          <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-admin-bg text-2xl">
            🔒
          </div>
          <div className="text-[15px] font-semibold text-ink-strong">
            Танд одоогоор хандах хэсэг алга байна
          </div>
          <div className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-muted">
            Шаардлагатай эрхийг системийн администратороос хүсэлт гаргаж нээлгэнэ үү.
          </div>
        </div>
      </div>
    </div>
  );
}
