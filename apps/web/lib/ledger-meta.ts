// Display metadata for ledger entry types. Client-safe (no server-only).

export type LedgerType =
  | "admin_issue"
  | "admin_raise"
  | "admin_lower"
  | "hold"
  | "release"
  | "consume"
  | "offline_refund";

export type LedgerGroup = "income" | "hold" | "release" | "consume";

export const LEDGER_META: Record<
  LedgerType,
  { icon: string; iconBg: string; iconFg: string; title: string; group: LedgerGroup }
> = {
  admin_issue: { icon: "＋", iconBg: "#E5F0FB", iconFg: "#1B5FA8", title: "Анхны лимит олгогдсон", group: "income" },
  admin_raise: { icon: "↑", iconBg: "#E5F0FB", iconFg: "#1B5FA8", title: "Лимит нэмэгдсэн", group: "income" },
  admin_lower: { icon: "↓", iconBg: "#FBEAE9", iconFg: "#C8312C", title: "Лимит бууруулсан", group: "income" },
  offline_refund: { icon: "↩", iconBg: "#FBF1DF", iconFg: "#C77A0A", title: "Офлайн буцаалт", group: "income" },
  hold: { icon: "🔒", iconBg: "#FBF1DF", iconFg: "#C77A0A", title: "Санал өгсөн — барьцаа", group: "hold" },
  release: { icon: "↩", iconBg: "#E5F4EC", iconFg: "#1F8A5B", title: "Саналын барьцаа буцаагдсан", group: "release" },
  consume: { icon: "✓", iconBg: "#EEF1F5", iconFg: "#14294A", title: "Хожсон лотод зарцуулсан", group: "consume" },
};

export function fmtSigned(n: number): string {
  const a = Math.abs(Math.round(n)).toLocaleString("en-US");
  return `${n < 0 ? "−" : "+"}${a}₮`;
}
