import { fmtMnDate, fmtMnTime } from "@/lib/datetime";
import { getNotifications } from "@/lib/notifications";
import { requireUser } from "@/lib/session";

import { type NotifItem, NotificationsView } from "./NotificationsView";

export const dynamic = "force-dynamic";

function dayLabel(d: Date): string {
  const now = Date.now();
  const k = fmtMnDate(d);
  if (k === fmtMnDate(now)) return "Өнөөдөр";
  if (k === fmtMnDate(now - 86400000)) return "Өчигдөр";
  return k;
}

export default async function NotificationsPage() {
  const user = await requireUser();
  const rows = await getNotifications(user.id);
  const items: NotifItem[] = rows.map((n) => ({
    id: n.id,
    group: n.group,
    icon: n.icon,
    iconBg: n.iconBg,
    iconFg: n.iconFg,
    title: n.title,
    body: n.body,
    day: dayLabel(n.createdAt),
    time: fmtMnTime(n.createdAt),
    read: n.read,
  }));
  return <NotificationsView items={items} />;
}
