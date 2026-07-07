import "server-only";

import { and, count, desc, eq, isNull } from "drizzle-orm";

import { db, schema } from "@auction/db";
import { formatTugrug } from "@auction/shared";

export type NotifGroup = "outbid" | "result" | "auction" | "system";

export interface NotifRow {
  id: string;
  group: NotifGroup;
  icon: string;
  iconBg: string;
  iconFg: string;
  title: string;
  body: string;
  createdAt: Date;
  read: boolean;
}

type NotifType = (typeof schema.notifications.type.enumValues)[number];

function render(type: NotifType, payload: Record<string, unknown>): Omit<NotifRow, "id" | "createdAt" | "read"> {
  const lot = payload.code && payload.species ? `${payload.species}:${payload.code}` : "Лот";
  const amount = typeof payload.amount === "number" ? formatTugrug(payload.amount) : "";
  const returned = typeof payload.returned === "number" ? formatTugrug(payload.returned) : "";
  const price = typeof payload.price === "number" ? formatTugrug(payload.price) : "";
  switch (type) {
    case "outbid":
      return { group: "outbid", icon: "⚠", iconBg: "#FBEAE9", iconFg: "#C8312C", title: "Таны саналыг давсан!", body: `${lot} — өөр оролцогч таныг давлаа. ${returned} буцаагдлаа.` };
    case "won":
      return { group: "result", icon: "🏆", iconBg: "#E5F4EC", iconFg: "#1F8A5B", title: "Баяр хүргэе! Та хожлоо", body: `${lot} — ${price}-өөр хожлоо. Барьцаа худалдан авалтад зарцуулагдлаа.` };
    case "lost":
      return { group: "result", icon: "○", iconBg: "#EEF1F5", iconFg: "#5B6677", title: "Лот дууслаа", body: `${lot} — өөр оролцогч хожлоо. Таны барьцаа бүрэн буцаагдсан.` };
    case "starting_soon":
      return { group: "auction", icon: "◷", iconBg: "#FBF1DF", iconFg: "#C77A0A", title: "Дуудлага удахгүй эхэлнэ", body: `${lot} — удахгүй шууд эхэлнэ.` };
    case "ending_soon":
      return { group: "auction", icon: "◷", iconBg: "#FBF1DF", iconFg: "#C77A0A", title: "Дуудлага дуусах дөхлөө", body: `${lot} — удахгүй хаагдана.` };
    case "limit_issued":
      return { group: "system", icon: "＋", iconBg: "#E5F0FB", iconFg: "#1B5FA8", title: "Лимит олгогдлоо", body: `Захиргаа танд ${amount} лимит олголоо.` };
    case "limit_raised":
      return { group: "system", icon: "↑", iconBg: "#E5F0FB", iconFg: "#1B5FA8", title: "Лимит нэмэгдлээ", body: `Захиргаа таны лимитийг ${amount}-аар нэмлээ.` };
    case "kyc_approved":
      return { group: "system", icon: "✓", iconBg: "#E5F4EC", iconFg: "#1F8A5B", title: "KYC баталгаажлаа", body: "Таны бүртгэл баталгаажлаа. Одоо санал өгөх боломжтой." };
    case "kyc_rejected":
      return { group: "system", icon: "✕", iconBg: "#FBEAE9", iconFg: "#C8312C", title: "KYC татгалзлаа", body: `Шалтгаан: ${String(payload.reason ?? "—")}` };
    default:
      return { group: "system", icon: "•", iconBg: "#EEF1F5", iconFg: "#14294A", title: type, body: "" };
  }
}

export async function getNotifications(userId: string): Promise<NotifRow[]> {
  const rows = await db
    .select()
    .from(schema.notifications)
    .where(eq(schema.notifications.userId, userId))
    .orderBy(desc(schema.notifications.createdAt))
    .limit(100);
  return rows.map((n) => ({
    id: n.id,
    ...render(n.type, n.payload),
    createdAt: n.createdAt,
    read: n.readAt != null,
  }));
}

export async function getUnreadCount(userId: string): Promise<number> {
  const [r] = await db
    .select({ n: count() })
    .from(schema.notifications)
    .where(and(eq(schema.notifications.userId, userId), isNull(schema.notifications.readAt)));
  return r?.n ?? 0;
}
