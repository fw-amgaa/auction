import { getCurrentUser } from "@/lib/session";
import { putObject } from "@/lib/storage";

/** Admin image upload for lots. Returns storage keys (served via /api/media). */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return new Response("Forbidden", { status: 403 });

  const form = await req.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  const keys: string[] = [];
  for (const f of files) {
    if (!f.type.startsWith("image/")) continue;
    const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `lots/${crypto.randomUUID()}-${safe}`;
    await putObject(key, Buffer.from(await f.arrayBuffer()));
    keys.push(key);
  }
  return Response.json({ keys });
}
