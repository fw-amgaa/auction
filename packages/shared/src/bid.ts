/**
 * Bid math — the SINGLE definition of the auction's bidding rules.
 * Used by the browser for optimistic UI (the two quick-bid buttons) and by the
 * bid service as the authoritative check before the Redis Lua script runs.
 *
 * Rules:
 *  - each category has TWO fixed ascending increments (constants.ts).
 *  - a raise = currentPrice + chosen increment (option 1 or 2).
 *  - the first bid opens at reserve + increment (no special "open at reserve").
 *  - the displayed price before any bids is the reserve.
 */

/** The increment for a given option (1 or 2). */
export function incrementForOption(increments: readonly [number, number], option: 1 | 2): number {
  return option === 1 ? increments[0] : increments[1];
}

/** The price resulting from raising the current price by the chosen option. */
export function liveBidAmount(
  price: number,
  increments: readonly [number, number],
  option: 1 | 2,
): number {
  return price + incrementForOption(increments, option);
}

/** One quick-bid option for the live UI. */
export interface BidOption {
  /** which fixed increment: 1 or 2 */
  option: 1 | 2;
  /** the increment added on top of the current price */
  increment: number;
  /** the resulting bid amount */
  amount: number;
  /** whether the user can afford this given their available credit */
  affordable: boolean;
}

export function bidOptions(params: {
  price: number;
  increments: readonly [number, number];
  available: number;
}): BidOption[] {
  const { price, increments, available } = params;
  return ([1, 2] as const).map((option) => {
    const increment = incrementForOption(increments, option);
    const amount = price + increment;
    return { option, increment, amount, affordable: amount <= available };
  });
}

export interface BidValidationInput {
  /** the current price (reserve when there are no bids yet) */
  price: number;
  /** the lot's two fixed increments */
  increments: readonly [number, number];
  /** the bidder's current committed total (sum of holds) */
  committed: number;
  /** the bidder's admin-issued credit limit */
  limit: number;
  /** is the bidder already the current leader? */
  isLeader: boolean;
  /** which increment was chosen */
  option: 1 | 2;
  /** the amount the client computed (must match price + increment) */
  amount: number;
}

export type BidValidationResult =
  | { ok: true; amount: number }
  | { ok: false; reason: "closed" | "self" | "bad_increment" | "insufficient" | "not_eligible" };

/**
 * Pure, authoritative validation of a single bid. Mirrors the Redis Lua logic
 * (minus the live time/leader/eligibility checks the server holds elsewhere).
 */
export function validateBid(input: BidValidationInput): BidValidationResult {
  const { price, increments, committed, limit, isLeader, option, amount } = input;

  if (isLeader) return { ok: false, reason: "self" };
  if (option !== 1 && option !== 2) return { ok: false, reason: "bad_increment" };
  if (amount !== price + incrementForOption(increments, option)) {
    return { ok: false, reason: "bad_increment" };
  }
  if (committed + amount > limit) return { ok: false, reason: "insufficient" };

  return { ok: true, amount };
}
