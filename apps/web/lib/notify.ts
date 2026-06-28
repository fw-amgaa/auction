import "server-only";

import { db, schema } from "@auction/db";

type NotificationType = (typeof schema.notifications.type.enumValues)[number];

export async function notify(
  userId: string,
  type: NotificationType,
  payload: Record<string, unknown> = {},
): Promise<void> {
  await db.insert(schema.notifications).values({ userId, type, payload });
}
