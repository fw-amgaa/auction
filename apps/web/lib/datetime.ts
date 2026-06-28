/**
 * Times are stored UTC in the DB and displayed in the VIEWER's own timezone.
 * Mongolia spans two fixed zones — UTC+8 (Asia/Ulaanbaatar) and UTC+7
 * (Asia/Hovd: Ховд, Баян-Өлгий, Увс) — so we never hardcode an offset; we let
 * the runtime timezone decide. Rendering happens through <LocalTime/>, which
 * formats client-side (the browser's real zone) and suppresses the SSR/CSR
 * hydration diff.
 */

export type TimeMode = "datetime" | "short" | "date" | "time";

type Dateish = Date | string | number;

const OPTS: Record<TimeMode, Intl.DateTimeFormatOptions> = {
  datetime: { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false },
  short: { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false },
  date: { year: "numeric", month: "2-digit", day: "2-digit" },
  time: { hour: "2-digit", minute: "2-digit", hour12: false },
};

/** Format an instant in the runtime timezone (browser, on the client). */
export function formatLocal(value: Dateish, mode: TimeMode = "datetime"): string {
  // en-CA → ISO-like "YYYY-MM-DD, HH:mm"; drop the comma for a clean look.
  return new Intl.DateTimeFormat("en-CA", OPTS[mode]).format(new Date(value)).replace(", ", " ");
}

/** "YYYY-MM-DD" day key in the runtime timezone (for grouping). */
export function localDayKey(value: Dateish): string {
  return formatLocal(value, "date");
}

/** Value for a <input type="datetime-local"> in the browser's local wall-clock. */
export function toLocalInput(d: Dateish | null): string {
  if (!d) return "";
  const date = new Date(d);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

/**
 * Convert a datetime-local value (entered in the browser's local zone) to a UTC
 * ISO string. Runs on the client, so `new Date(local)` uses the admin's actual
 * timezone — correct whether they're in UB (+8) or Khovd (+7).
 */
export function localInputToIso(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
