import Link from "next/link";

import { formatTugrug } from "@auction/shared";

import { AdminTopbar } from "@/components/AdminTopbar";
import { KycBadge } from "@/components/KycBadge";
import { AdminLinkButton } from "@/components/admin/Button";
import { Pagination } from "@/components/admin/Pagination";
import { type AccountType, type ApplicantsSort, type KycStatus, getApplicantCounts, getApplicantsPage } from "@/lib/admin";
import { requirePageAccess } from "@/lib/session";

export const dynamic = "force-dynamic";

const COLS = "grid grid-cols-[1.7fr_1.1fr_1fr_1.1fr_120px] gap-3";
const PAGE_SIZE = 20;
const SORTS: ApplicantsSort[] = ["created", "limitDesc", "limitAsc"];

interface SP {
  q?: string;
  type?: string;
  kyc?: string;
  sort?: string;
  page?: string;
}

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requirePageAccess("users.view");
  const sp = await searchParams;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const sort: ApplicantsSort = SORTS.includes(sp.sort as ApplicantsSort) ? (sp.sort as ApplicantsSort) : "created";

  const [{ rows, hasNext }, counts] = await Promise.all([
    getApplicantsPage({
      q: sp.q,
      type: sp.type && sp.type !== "all" ? (sp.type as AccountType) : undefined,
      kyc: sp.kyc && sp.kyc !== "all" ? (sp.kyc as KycStatus) : undefined,
      sort,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
      withDocs: false, // list view never renders documents/codes
    }),
    getApplicantCounts(),
  ]);
  const total = counts.pending + counts.approved + counts.rejected;

  // toolbar is a client component imported lazily to keep server boundary clean
  const { UsersToolbar } = await import("./UsersToolbar");

  const base = new URLSearchParams();
  for (const k of ["q", "type", "kyc", "sort"] as const) if (sp[k]) base.set(k, sp[k]!);
  const pageHref = (n: number) => {
    const q = new URLSearchParams(base);
    if (n > 1) q.set("page", String(n));
    const s = q.toString();
    return s ? `/admin/users?${s}` : "/admin/users";
  };

  return (
    <div>
      <AdminTopbar
        title={
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-navy">Хэрэглэгчид</h1>
            <span className="tnum rounded-md bg-admin-bg px-2.5 py-1 text-[11.5px] font-semibold text-ink-soft">
              {total} бүртгэл
            </span>
          </div>
        }
      >
        <AdminLinkButton href="/admin/users/new" variant="primary">
          + Хэрэглэгч үүсгэх
        </AdminLinkButton>
      </AdminTopbar>

      <div className="p-6">
        <UsersToolbar />

        <div className="overflow-hidden rounded-2xl border border-line-cool bg-white">
          <div
            className={`${COLS} border-b border-[#EBEEF3] bg-[#F7F8FA] px-[18px] py-3 text-[11px] font-bold uppercase tracking-wide text-muted`}
          >
            <span>Нэр / байгууллага</span>
            <span>Регистр</span>
            <span className="text-center">KYC</span>
            <span className="text-right">Лимит</span>
            <span className="text-right">Эх сурвалж</span>
          </div>

          {rows.map((u) => (
            <Link
              key={u.id}
              href={`/admin/users/${u.id}`}
              className={`${COLS} items-center border-b border-[#F1F3F6] px-[18px] py-3 transition-colors last:border-0 hover:bg-[#F7F8FA]`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className="grid size-[34px] shrink-0 place-items-center rounded-[9px] text-xs font-bold"
                  style={
                    u.accountType === "legal_entity"
                      ? { background: "#E5F0FB", color: "#1B5FA8" }
                      : { background: "#E5F4EC", color: "#1F8A5B" }
                  }
                >
                  {u.name.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-[13.5px] font-semibold text-navy">{u.name}</div>
                  <div className="truncate text-[11px] text-muted">
                    {u.accountType === "legal_entity" ? "Хуулийн этгээд" : "Иргэн"} · {u.email}
                  </div>
                </div>
              </div>
              <span className="tnum truncate text-[12.5px] text-ink-soft">{u.registry}</span>
              <span className="flex justify-center">
                <KycBadge status={u.kyc} />
              </span>
              <span
                className="tnum text-right text-[13px] font-semibold"
                style={{ color: u.limit > 0 ? "#14294A" : "#C7CFD9" }}
              >
                {u.limit > 0 ? formatTugrug(u.limit) : "—"}
              </span>
              <span
                className="text-right text-[11.5px] font-medium"
                style={{ color: u.source === "admin" ? "#1B5FA8" : "#8A93A3" }}
              >
                {u.source === "admin" ? "Админ" : "Өөрөө"}
              </span>
            </Link>
          ))}

          {rows.length === 0 && (
            <div className="px-5 py-14 text-center">
              <div className="text-[15px] font-semibold text-ink-strong">
                Хайлтад тохирох хэрэглэгч олдсонгүй
              </div>
              <div className="mt-1.5 text-[13px] text-muted">
                Хайлт эсвэл шүүлтүүрээ өөрчилнө үү.
              </div>
            </div>
          )}
        </div>

        <Pagination page={page} hasNext={hasNext} hrefFor={pageHref} />
      </div>
    </div>
  );
}
