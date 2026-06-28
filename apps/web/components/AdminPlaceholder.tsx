import { AdminTopbar } from "@/components/AdminTopbar";

export function AdminPlaceholder({ title, phase }: { title: string; phase: string }) {
  return (
    <div>
      <AdminTopbar title={title} />
      <div className="p-6">
        <div className="rounded-2xl border border-dashed border-line-cool bg-white p-12 text-center">
          <div className="text-base font-semibold text-navy">{title}</div>
          <div className="mt-2 text-sm text-muted">{phase}-д хийгдэнэ.</div>
        </div>
      </div>
    </div>
  );
}
