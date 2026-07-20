import { getCurrentUser } from "@/lib/session";
import { mintTicket, wsUrl } from "@/lib/ws-ticket";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (user.role !== "admin" && user.kyc !== "approved") {
    return new Response("Forbidden", { status: 403 });
  }

  const ticket = mintTicket({
    uid: user.id,
    role: user.role,
    kyc: user.kyc,
    limit: user.limit,
  });

  return Response.json(
    { ticket, wsUrl: wsUrl() },
    { headers: { "cache-control": "private, no-store" } },
  );
}
