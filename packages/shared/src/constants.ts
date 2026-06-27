/**
 * Auction-wide constants. These encode the resolved product rules
 * (see ARCHITECTURE.md §6 and §13). Single source of truth — imported by
 * both the browser (apps/web) and the authoritative bid service (apps/bid).
 */

/** Bid step is 10% of a lot's reserve price. */
export const STEP_PCT = 0.1;

/** A raise is between +1 and +5 steps (i.e. 10%–50% of reserve). */
export const MIN_STEPS = 1;
export const MAX_STEPS = 5;

/**
 * Anti-snipe: if a bid lands within this many seconds of the end,
 * the auction is extended.
 */
export const ANTI_SNIPE_WINDOW_SEC = 15;
export const ANTI_SNIPE_EXTENSION_SEC = 30;

/** Per-user bid rate limit (token bucket) on the live socket. */
export const BID_RATE_PER_SEC = 5;

/** Short-lived WebSocket connect ticket lifetime. */
export const WS_TICKET_TTL_SEC = 60;
