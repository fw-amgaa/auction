import { getNotifications } from "@/lib/notifications";
import { requireUser } from "@/lib/session";

import { type NotifItem, NotificationsView } from "./NotificationsView";

export const dynamic = "force-dynamic";

function dayLabel(d: Date): string {
  const today = new Date();
  const yest = new Date(today.getTime() - 86400000);
  const k = (x: Date) => x.toISOString().slice(0, 10);
  if (k(d) === k(today)) return "Өнөөдөр";
  if (k(d) === k(yest)) return "Өчигдөр";
  return k(d);
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
    time: n.createdAt.toISOString().slice(11, 16),
    read: n.read,
  }));
  return <NotificationsView items={items} />;
}
