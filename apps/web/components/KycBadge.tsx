type Kyc = "pending" | "approved" | "rejected";

const META: Record<Kyc, { icon: string; label: string; bg: string; fg: string }> = {
  approved: { icon: "✓", label: "Баталгаажсан", bg: "#E5F4EC", fg: "#197a50" },
  pending: { icon: "◷", label: "Хүлээгдэж буй", bg: "#FBF1DF", fg: "#C77A0A" },
  rejected: { icon: "✕", label: "Татгалзсан", bg: "#FBEAE9", fg: "#C8312C" },
};

export function KycBadge({ status }: { status: Kyc }) {
  const m = META[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-bold"
      style={{ background: m.bg, color: m.fg }}
    >
      {m.icon} {m.label}
    </span>
  );
}
