/**
 * Bid math — the SINGLE definition of the auction's bidding rules.
 * Used by the browser for optimistic UI (enable/disable +1…+5 buttons) and by
 * the bid service as the authoritative check before the Redis Lua script runs.
 *
 * Rules (ARCHITECTURE.md §6, §13):
 *  - step = round(reserve * 10%)
 *  - opening bid (no bids yet) may equal the reserve exactly
 *  - each raise = currentPrice + N*step, with N ∈ [1,5]
 */

import { MAX_STEPS, MIN_STEPS, STEP_PCT } from "./constants";

/** The bid step for a lot, derived from its reserve. */
export function stepFor(reserve: number): number {
  return Math.round(reserve * STEP_PCT);
}

/**
 * The price resulting from raising the current price by N steps.
 */
export function priceForSteps(currentPrice: number, reserve: number, nSteps: number): number {
  return currentPrice + nSteps * stepFor(reserve);
}

/**
 * The 1..5 quick-bid options for the live UI. When the lot has no bids yet,
 * the opening option (the reserve itself) is included as well.
 */
export interface BidOption {
  /** number of steps above current price; 0 means "open at reserve" */
  nSteps: number;
  amount: number;
  /** whether the user can afford this given their available credit */
  affordable: boolean;
  /** the special opening-at-reserve option */
  opening: boolean;
}

export function bidOptions(params: {
  reserve: number;
  currentPrice: number;
  hasBids: boolean;
  available: number;
}): BidOption[] {
  const { reserve, currentPrice, hasBids, available } = params;
  const opts: BidOption[] = [];

  if (!hasBids) {
    opts.push({ nSteps: 0, amount: reserve, affordable: reserve <= available, opening: true });
  }
  for (let n = MIN_STEPS; n <= MAX_STEPS; n++) {
    const amount = priceForSteps(currentPrice, reserve, n);
    opts.push({ nSteps: n, amount, affordable: amount <= available, opening: false });
  }
  return opts;
}

export type BidRejectReason =
  | "closed"
  | "self"
  | "bad_increment"
  | "insufficient"
  | "not_eligible";

export interface BidValidationInput {
  reserve: number;
  currentPrice: number;
  hasBids: boolean;
  /** the bidder's current committed total (sum of holds) */
  committed: number;
  /** the bidder's admin-issued credit limit */
  limit: number;
  /** is the bidder already the current leader? */
  isLeader: boolean;
  nSteps: number;
  amount: number;
}

export type BidValidationResult =
  | { ok: true; amount: number }
  | { ok: false; reason: BidRejectReason };

/**
 * Pure, authoritative validation of a single bid. Mirrors the Redis Lua logic
 * (minus the live time/leader checks the server holds in Redis).
 */
export function validateBid(input: BidValidationInput): BidValidationResult {
  const { reserve, currentPrice, hasBids, committed, limit, isLeader, nSteps, amount } = input;

  if (isLeader) return { ok: false, reason: "self" };

  // Opening bid: may equal the reserve exactly.
  if (!hasBids && nSteps === 0) {
    if (amount !== reserve) return { ok: false, reason: "bad_increment" };
  } else {
    if (nSteps < MIN_STEPS || nSteps > MAX_STEPS) {
      return { ok: false, reason: "bad_increment" };
    }
    if (amount !== priceForSteps(currentPrice, reserve, nSteps)) {
      return { ok: false, reason: "bad_increment" };
    }
  }

  if (committed + amount > limit) return { ok: false, reason: "insufficient" };

  return { ok: true, amount };
}
