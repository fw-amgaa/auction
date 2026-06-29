/**
 * WebSocket message contracts between the browser and the bid service.
 * Zod-validated on both ends (ARCHITECTURE.md §9).
 */

import { z } from "zod";

/* ----------------------------- client → server ---------------------------- */

export const ClientMessage = z.discriminatedUnion("t", [
  z.object({ t: z.literal("subscribe"), lotId: z.string().uuid() }),
  z.object({
    t: z.literal("bid"),
    lotId: z.string().uuid(),
    option: z.union([z.literal(1), z.literal(2)]),
  }),
  z.object({ t: z.literal("ping") }),
]);
export type ClientMessage = z.infer<typeof ClientMessage>;

/* ----------------------------- server → client ---------------------------- */

export const BidRejectReasonSchema = z.enum([
  "closed",
  "self",
  "bad_increment",
  "insufficient",
  "not_eligible",
  "rate_limited",
]);
export type BidRejectReason = z.infer<typeof BidRejectReasonSchema>;

export const FeedItem = z.object({
  seq: z.number().int(),
  label: z.string(),
  amount: z.number().int(),
  ts: z.number().int(),
  mine: z.boolean(),
});
export type FeedItem = z.infer<typeof FeedItem>;

export const ServerMessage = z.discriminatedUnion("t", [
  z.object({
    t: z.literal("snapshot"),
    lotId: z.string().uuid(),
    price: z.number().int(),
    reserve: z.number().int(),
    inc1: z.number().int(),
    inc2: z.number().int(),
    leaderLabel: z.string().nullable(),
    youLead: z.boolean(),
    hasBids: z.boolean(),
    endsAt: z.number().int(),
    seq: z.number().int(),
    spectators: z.number().int(),
    status: z.enum(["live", "ended"]),
    feed: z.array(FeedItem),
    available: z.number().int(),
    committed: z.number().int(),
    limit: z.number().int(),
  }),
  z.object({
    t: z.literal("bid"),
    lotId: z.string().uuid(),
    price: z.number().int(),
    seq: z.number().int(),
    endsAt: z.number().int(),
    extended: z.boolean(),
    leaderLabel: z.string(),
    youLead: z.boolean(),
    feedItem: FeedItem,
  }),
  z.object({ t: z.literal("rejected"), lotId: z.string().uuid(), reason: BidRejectReasonSchema }),
  z.object({ t: z.literal("outbid"), lotId: z.string().uuid(), returned: z.number().int() }),
  z.object({
    t: z.literal("balance"),
    available: z.number().int(),
    committed: z.number().int(),
    limit: z.number().int(),
  }),
  z.object({ t: z.literal("spectators"), lotId: z.string().uuid(), count: z.number().int() }),
  z.object({
    t: z.literal("closed"),
    lotId: z.string().uuid(),
    result: z.enum(["won", "lost", "ended"]),
    price: z.number().int(),
  }),
  z.object({ t: z.literal("pong") }),
]);
export type ServerMessage = z.infer<typeof ServerMessage>;
