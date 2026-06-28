import { getNotifications } from "@/lib/notifications";
import { requireUser } from "@/lib/session";

import { type NotifItem, NotificationsView } from "./NotificationsView";

export const dynamic = "force-dynamic";

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
    createdAt: n.createdAt.toISOString(),
    read: n.read,
  }));
  return <NotificationsView items={items} />;
}
