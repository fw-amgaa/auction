import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db, schema } from "@auction/db";

export const dynamic = "force-dynamic";

/** Latest Terms version — read by the register dialog (public). */
export async function GET() {
  const [terms] = await db
    .select()
    .from(schema.termsVersions)
    .orderBy(desc(schema.termsVersions.publishedAt))
    .limit(1);

  return NextResponse.json({
    version: terms?.version ?? "v1",
    body: terms?.body ?? "Үйлчилгээний нөхцөл удахгүй нийтлэгдэнэ.",
    publishedAt: terms?.publishedAt ?? null,
  });
}
