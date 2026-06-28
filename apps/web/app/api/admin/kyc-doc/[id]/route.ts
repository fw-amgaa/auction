import { eq } from "drizzle-orm";

import { db, schema } from "@auction/db";

import { getCurrentUser } from "@/lib/session";
import { contentTypeFor, getObject } from "@/lib/storage";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Forbidden", { status: 403 });

  const { id } = await params;
  const [doc] = await db
    .select()
    .from(schema.kycDocuments)
    .where(eq(schema.kycDocuments.id, id))
    .limit(1);
  if (!doc) return new Response("Not found", { status: 404 });
  // admins can view any document; everyone else only their own
  if (user.role !== "admin" && doc.userId !== user.id) {
    return new Response("Forbidden", { status: 403 });
  }

  try {
    const bytes = await getObject(doc.s3Key);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "content-type": contentTypeFor(doc.fileName ?? doc.s3Key),
        "content-disposition": `inline; filename="${encodeURIComponent(doc.fileName ?? "document")}"`,
        "cache-control": "private, no-store",
      },
    });
  } catch {
    return new Response("File unavailable", { status: 404 });
  }
}
