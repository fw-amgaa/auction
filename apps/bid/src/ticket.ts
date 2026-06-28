import { createHmac, timingSafeEqual } from "node:crypto";

const SECRET = process.env.WS_TICKET_SECRET ?? "change-me-in-prod";

export interface Ticket {
  uid: string;
  role: "bidder" | "admin";
  kyc: "pending" | "approved" | "rejected";
  limit: number;
  exp: number;
}

function b64urlDecode(s: string): string {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

/** Verify an HMAC ticket minted by apps/web (lib/ws-ticket.ts). */
export function verifyTicket(token: string): Ticket | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts as [string, string];
  const expected = createHmac("sha256", SECRET).update(body).digest();
  let given: Buffer;
  try {
    given = Buffer.from(sig.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  } catch {
    return null;
  }
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const payload = JSON.parse(b64urlDecode(body)) as Ticket;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
