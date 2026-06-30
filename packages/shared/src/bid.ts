/**
 * Bid math — the SINGLE definition of the auction's bidding rules.
 * Used by the browser for optimistic UI (the quick-bid buttons) and by the
 * bid service as the authoritative check before the Redis Lua script runs.
 *
 * Rules:
 *  - each category has TWO fixed ascending increments (constants.ts).
 *  - the two MAIN options raise by those increments (option 1 / 2).
 *  - in the FINAL STRETCH (last FINAL_STRETCH_SEC), two extra "fast" options
 *    unlock that raise by DOUBLE each increment (option 3 = inc1×2, 4 = inc2×2).
 *    Before the window they are locked (the bid service enforces this on its
 *    own clock; the client only mirrors it for UI affordances).
 *  - a raise = currentPrice + chosen increment.
 *  - the first bid opens at reserve + increment (no special "open at reserve").
 *  - the displayed price before any bids is the reserve.
 */

/** Which bid option was chosen. 1/2 are always available; 3/4 only in the final stretch. */
export type BidOptionId = 1 | 2 | 3 | 4;

/** The two "fast" options (double increments) that unlock in the final stretch. */
export const FAST_BID_OPTIONS: readonly BidOptionId[] = [3, 4] as const;

/** Is this one of the final-stretch "fast" (double-increment) options? */
export function isFastOption(option: BidOptionId): boolean {
  return option === 3 || option === 4;
}

/**
 * The increment for a given option.
 *  1 → inc1,  2 → inc2,  3 → inc1×2,  4 → inc2×2.
 */
export function incrementForOption(increments: readonly [number, number], option: BidOptionId): number {
  switch (option) {
    case 1:
      return increments[0];
    case 2:
      return increments[1];
    case 3:
      return increments[0] * 2;
    case 4:
      return increments[1] * 2;
  }
}

/** The price resulting from raising the current price by the chosen option. */
export function liveBidAmount(
  price: number,
  increments: readonly [number, number],
  option: BidOptionId,
): number {
  return price + incrementForOption(increments, option);
}

/** One quick-bid option for the live UI. */
export interface BidOption {
  /** which increment: 1/2 main, 3/4 fast (double) */
  option: BidOptionId;
  /** the increment added on top of the current price */
  increment: number;
  /** the resulting bid amount */
  amount: number;
  /** whether the user can afford this given their available credit */
  affordable: boolean;
  /** a fast (double) option — only usable in the final stretch */
  fast: boolean;
  /** locked because it's a fast option and we're not yet in the final stretch */
  locked: boolean;
}

export function bidOptions(params: {
  price: number;
  increments: readonly [number, number];
  available: number;
  /** are we within FINAL_STRETCH_SEC of the end? unlocks options 3 & 4 */
  inFinalStretch: boolean;
}): BidOption[] {
  const { price, increments, available, inFinalStretch } = params;
  return ([1, 2, 3, 4] as const).map((option) => {
    const increment = incrementForOption(increments, option);
    const amount = price + increment;
    const fast = isFastOption(option);
    return {
      option,
      increment,
      amount,
      affordable: amount <= available,
      fast,
      locked: fast && !inFinalStretch,
    };
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
  option: BidOptionId;
  /** the amount the client computed (must match price + increment) */
  amount: number;
  /** are we within FINAL_STRETCH_SEC of the end? required to use options 3/4 */
  inFinalStretch: boolean;
}

export type BidValidationResult =
  | { ok: true; amount: number }
  | { ok: false; reason: "closed" | "self" | "bad_increment" | "insufficient" | "not_eligible" | "locked" };

/**
 * Pure, authoritative validation of a single bid. Mirrors the Redis Lua logic
 * (minus the live time/leader/eligibility checks the server holds elsewhere).
 */
export function validateBid(input: BidValidationInput): BidValidationResult {
  const { price, increments, committed, limit, isLeader, option, amount, inFinalStretch } = input;

  if (isLeader) return { ok: false, reason: "self" };
  if (option !== 1 && option !== 2 && option !== 3 && option !== 4) {
    return { ok: false, reason: "bad_increment" };
  }
  // Fast (double) options are locked until the final stretch.
  if (isFastOption(option) && !inFinalStretch) return { ok: false, reason: "locked" };
  if (amount !== price + incrementForOption(increments, option)) {
    return { ok: false, reason: "bad_increment" };
  }
  if (committed + amount > limit) return { ok: false, reason: "insufficient" };

  return { ok: true, amount };
}
