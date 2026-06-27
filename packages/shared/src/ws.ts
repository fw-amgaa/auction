/**
 * WebSocket message contracts between the browser and the bid service.
 * Zod-validated on both ends (ARCHITECTURE.md §9).
 */

import { z } from "zod";

/* ----------------------------- client → server ---------------------------- */

export const ClientMessage = z.discriminatedUnion("t", [
  z.object({ t: z.literal("subscribe"), lotId: z.string().uuid() }),
  z.object({ t: z.literal("unsubscribe"), lotId: z.string().uuid() }),
  z.object({ t: z.literal("watch"), lotId: z.string().uuid(), on: z.boolean() }),
  z.object({ t: z.literal("bid"), lotId: z.string().uuid(), nSteps: z.number().int().min(0).max(5) }),
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
]);

export const LotState = z.object({
  lotId: z.string().uuid(),
  price: z.number().int(),
  /** anonymized leader label, e.g. "#7"; null if no bids yet */
  leaderLabel: z.string().nullable(),
  /** is the connected user the current leader? */
  youLead: z.boolean(),
  endsAt: z.number().int(), // epoch ms
  seq: z.number().int(),
  spectators: z.number().int(),
  hasBids: z.boolean(),
});
export type LotState = z.infer<typeof LotState>;

export const ServerMessage = z.discriminatedUnion("t", [
  z.object({ t: z.literal("state"), state: LotState }),
  z.object({ t: z.literal("accepted"), lotId: z.string().uuid(), amount: z.number().int(), seq: z.number().int() }),
  z.object({ t: z.literal("rejected"), lotId: z.string().uuid(), reason: BidRejectReasonSchema }),
  z.object({ t: z.literal("outbid"), lotId: z.string().uuid(), returned: z.number().int() }),
  z.object({ t: z.literal("extended"), lotId: z.string().uuid(), endsAt: z.number().int(), bySec: z.number().int() }),
  z.object({
    t: z.literal("closed"),
    lotId: z.string().uuid(),
    result: z.enum(["won", "lost", "ended"]),
  }),
  z.object({
    t: z.literal("balance"),
    available: z.number().int(),
    committed: z.number().int(),
    limit: z.number().int(),
  }),
  z.object({ t: z.literal("pong") }),
]);
export type ServerMessage = z.infer<typeof ServerMessage>;
