/**
 * All auction times are stored UTC in the DB and displayed in Mongolia time.
 * Mongolia is a fixed UTC+8 (no DST), so we shift by a constant offset — this
 * is deterministic on both server and client (no hydration mismatch) and is
 * independent of where the server runs.
 */
const MN_OFFSET_MS = 8 * 60 * 60 * 1000;

type Dateish = Date | string | number;

function shifted(d: Dateish): Date {
  return new Date(new Date(d).getTime() + MN_OFFSET_MS);
}

/** "YYYY-MM-DD HH:mm" in Mongolia time. */
export function fmtMnDateTime(d: Dateish): string {
  return shifted(d).toISOString().slice(0, 16).replace("T", " ");
}

/** "MM-DD HH:mm" in Mongolia time (compact table cells). */
export function fmtMnShort(d: Dateish): string {
  return shifted(d).toISOString().slice(5, 16).replace("T", " ");
}

/** "YYYY-MM-DD" in Mongolia time. */
export function fmtMnDate(d: Dateish): string {
  return shifted(d).toISOString().slice(0, 10);
}

/** "HH:mm" in Mongolia time. */
export function fmtMnTime(d: Dateish): string {
  return shifted(d).toISOString().slice(11, 16);
}

/** Value for a <input type="datetime-local"> showing Mongolia wall-clock. */
export function toMnInput(d: Dateish | null): string {
  if (!d) return "";
  return shifted(d).toISOString().slice(0, 16);
}

/** Parse a datetime-local string (entered as Mongolia time) back to a UTC Date. */
export function parseMnInput(v: string | null): Date | null {
  if (!v) return null;
  // v is "YYYY-MM-DDTHH:mm" meant as +08:00
  const d = new Date(`${v}:00+08:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}
