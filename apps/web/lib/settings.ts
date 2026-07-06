import "server-only";

import { eq } from "drizzle-orm";

import { db, schema } from "@auction/db";

/**
 * Operator-controlled app switches, stored in the `app_settings` KV table.
 * Reads happen per request (the affected pages are force-dynamic), so an admin
 * flip takes effect immediately without a deploy.
 */

const REGISTRATION_OPEN_KEY = "registration_open";

/** Whether public bidder registration is open. Defaults to OPEN when unset. */
export async function isRegistrationOpen(): Promise<boolean> {
  const [row] = await db
    .select({ value: schema.appSettings.value })
    .from(schema.appSettings)
    .where(eq(schema.appSettings.key, REGISTRATION_OPEN_KEY))
    .limit(1);
  return row ? row.value === true : true;
}

export async function setRegistrationOpen(open: boolean): Promise<void> {
  await db
    .insert(schema.appSettings)
    .values({ key: REGISTRATION_OPEN_KEY, value: open, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: schema.appSettings.key,
      set: { value: open, updatedAt: new Date() },
    });
}
