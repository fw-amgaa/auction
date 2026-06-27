/**
 * Currency is always whole tögrög, represented as an integer (number for
 * UI, bigint at the DB boundary). Never floats. Display is symbol-last with
 * thousands separators per the design handoff: 5,300,000₮
 */

export function formatTugrug(amount: number | bigint): string {
  const n = typeof amount === "bigint" ? amount : Math.round(amount);
  return `${n.toLocaleString("en-US")}₮`;
}

/** Parse a user-typed amount ("5,300,000" / "5300000₮") into integer tögrög. */
export function parseTugrug(input: string): number {
  const digits = input.replace(/[^\d]/g, "");
  return digits ? Number.parseInt(digits, 10) : 0;
}
