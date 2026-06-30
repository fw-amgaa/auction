/**
 * Auction-wide constants. These encode the resolved product rules.
 * Single source of truth — imported by both the browser (apps/web) and the
 * authoritative bid service (apps/bid).
 */

/* ------------------------------ categories -------------------------------- */
/**
 * The auction has exactly TWO categories. Each carries:
 *  - a fixed list of lot codes (a lot's code must be one of these)
 *  - two fixed ascending bid increments (the only amounts a raise may add)
 *
 * A bidder registers with one or more codes and may only see/bid the lots
 * whose code they hold (per-code eligibility).
 */

function range(prefix: string, from: number, to: number): string[] {
  const out: string[] = [];
  for (let n = from; n <= to; n++) out.push(`${prefix}${n}`);
  return out;
}

export const CATEGORIES = {
  ugalz: {
    name: "Алтайн угалз",
    codes: range("U", 1, 11), // U1 … U11 (Latin U)
    increments: [3_000_000, 4_000_000] as const,
  },
  tekh: {
    name: "Алтайн тэх",
    codes: range("T", 101, 124), // T101 … T124 (Latin T)
    increments: [600_000, 1_200_000] as const,
  },
} as const;

export type CategoryCode = keyof typeof CATEGORIES;

export const CATEGORY_CODES = Object.keys(CATEGORIES) as CategoryCode[];

/** Flat list of every valid lot code with the category it belongs to. */
export const ALL_LOT_CODES: { code: string; category: CategoryCode }[] = CATEGORY_CODES.flatMap(
  (category) => CATEGORIES[category].codes.map((code) => ({ code, category })),
);

const CODE_TO_CATEGORY = new Map<string, CategoryCode>(
  ALL_LOT_CODES.map(({ code, category }) => [code, category]),
);

/** The category a lot code belongs to (or null if it is not a valid code). */
export function categoryForCode(code: string): CategoryCode | null {
  return CODE_TO_CATEGORY.get(code) ?? null;
}

/** Is this a recognised lot code? */
export function isValidLotCode(code: string): boolean {
  return CODE_TO_CATEGORY.has(code);
}

/** The two ascending bid increments for a category. */
export function incrementsForCategory(category: CategoryCode): readonly [number, number] {
  return CATEGORIES[category].increments;
}

/** The two ascending bid increments for a lot code (falls back to ugalz). */
export function incrementsForCode(code: string): readonly [number, number] {
  const cat = categoryForCode(code);
  return cat ? CATEGORIES[cat].increments : CATEGORIES.ugalz.increments;
}

/* ------------------------------- bidding ---------------------------------- */

/**
 * Anti-snipe: if a bid lands within this many seconds of the end,
 * the auction is extended by ANTI_SNIPE_EXTENSION_SEC.
 */
export const ANTI_SNIPE_WINDOW_SEC = 10;
export const ANTI_SNIPE_EXTENSION_SEC = 10;

/**
 * Final stretch: inside this many seconds of the end, two extra "fast" bid
 * options unlock — double the category's two increments (options 3 & 4). Before
 * the window they are locked; the bid service enforces this against its own
 * clock so the gate can't be spoofed by the client.
 */
export const FINAL_STRETCH_SEC = 180; // last 3 minutes

/** Per-user bid rate limit (token bucket) on the live socket. */
export const BID_RATE_PER_SEC = 5;

/** Short-lived WebSocket connect ticket lifetime. */
export const WS_TICKET_TTL_SEC = 60;
