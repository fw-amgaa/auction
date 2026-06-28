import "server-only";

import { db, schema } from "@auction/db";

export async function writeAudit(entry: {
  actorId: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  meta?: Record<string, unknown>;
}): Promise<void> {
  await db.insert(schema.auditLog).values({
    actorId: entry.actorId,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    meta: entry.meta ?? {},
  });
}
