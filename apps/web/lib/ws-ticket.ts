import "server-only";

import { createHmac } from "node:crypto";

import { WS_TICKET_TTL_SEC } from "@auction/shared";

const SECRET = process.env.WS_TICKET_SECRET ?? "change-me-in-prod";

function b64url(s: string): string {
  return Buffer.from(s).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export interface TicketInput {
  uid: string;
  role: "bidder" | "admin";
  kyc: "pending" | "approved" | "rejected";
  limit: number;
}

/** Mint a short-lived HMAC ticket the browser uses to open the bid WebSocket. */
export function mintTicket(input: TicketInput): string {
  const payload = { ...input, exp: Date.now() + WS_TICKET_TTL_SEC * 1000 };
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac("sha256", SECRET)
    .update(body)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `${body}.${sig}`;
}

export function wsUrl(): string {
  return process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8080";
}
