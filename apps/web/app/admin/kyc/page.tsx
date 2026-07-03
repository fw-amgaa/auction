import { AdminTopbar } from "@/components/AdminTopbar";
import { type KycStatus, getApplicantCounts, getApplicantsPage } from "@/lib/admin";
import { requirePageAccess } from "@/lib/session";
import { timeAgo } from "@/lib/time";

import { type Applicant, KycReview } from "./KycReview";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;
const TABS: KycStatus[] = ["pending", "approved", "rejected"];

interface SP {
  tab?: string;
  page?: string;
}

export default async function AdminKycPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requirePageAccess("kyc.review");
  const sp = await searchParams;
  const tab: KycStatus = TABS.includes(sp.tab as KycStatus) ? (sp.tab as KycStatus) : "pending";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const [{ rows, hasNext }, counts] = await Promise.all([
    getApplicantsPage({ kyc: tab, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
    getApplicantCounts(),
  ]);
  const applicants: Applicant[] = rows.map((u) => ({
    id: u.id,
    name: u.name,
    accountType: u.accountType,
    kyc: u.kyc,
    ago: timeAgo(u.createdAt),
    fields: u.fields,
    docs: u.docs,
  }));

  return (
    <div className="flex h-screen flex-col">
      <AdminTopbar
        title={
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-navy">KYC хүсэлтүүд</h1>
            <span className="rounded-md bg-[#FBEAE9] px-2.5 py-1 text-[11.5px] font-bold text-crimson">
              {counts.pending} хүлээгдэж буй
            </span>
          </div>
        }
      >
        <span className="text-[12.5px] text-ink-soft">Ажлын дараалал · шинээс хуучин</span>
      </AdminTopbar>
      <KycReview
        // Remount (and re-derive default selection) whenever the tab/page changes,
        // or an approve/reject mutates the current page's set of applicant ids.
        key={`${tab}-${page}-${applicants.map((a) => a.id).join(",")}`}
        applicants={applicants}
        tab={tab}
        page={page}
        hasNext={hasNext}
        counts={counts}
      />
    </div>
  );
}
