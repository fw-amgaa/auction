import { AdminTopbar } from "@/components/AdminTopbar";
import { getApplicants } from "@/lib/admin";
import { requirePageAccess } from "@/lib/session";
import { timeAgo } from "@/lib/time";

import { type Applicant, KycReview } from "./KycReview";

export const dynamic = "force-dynamic";

export default async function AdminKycPage() {
  await requirePageAccess("kyc.review");
  const all = await getApplicants();
  const applicants: Applicant[] = all.map((u) => ({
    id: u.id,
    name: u.name,
    accountType: u.accountType,
    kyc: u.kyc,
    ago: timeAgo(u.createdAt),
    fields: u.fields,
    docs: u.docs,
  }));
  const pendingCount = applicants.filter((a) => a.kyc === "pending").length;

  return (
    <div className="flex h-screen flex-col">
      <AdminTopbar
        title={
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-navy">KYC хүсэлтүүд</h1>
            <span className="rounded-md bg-[#FBEAE9] px-2.5 py-1 text-[11.5px] font-bold text-crimson">
              {pendingCount} хүлээгдэж буй
            </span>
          </div>
        }
      >
        <span className="text-[12.5px] text-ink-soft">Ажлын дараалал · шинээс хуучин</span>
      </AdminTopbar>
      <KycReview applicants={applicants} />
    </div>
  );
}
