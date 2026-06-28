import { contentTypeFor, getObject } from "@/lib/storage";

/** Public media (lot images only). KYC docs are served by the gated route. */
export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get("key") ?? "";
  if (!key.startsWith("lots/")) return new Response("Not found", { status: 404 });
  try {
    const bytes = await getObject(key);
    return new Response(new Uint8Array(bytes), {
      headers: { "content-type": contentTypeFor(key), "cache-control": "public, max-age=3600" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
