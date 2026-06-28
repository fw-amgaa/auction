"use client";

import { formatLocal, type TimeMode } from "@/lib/datetime";

/**
 * Renders an instant in the viewer's own timezone. Server renders it in the
 * server zone, the client re-renders in the browser zone; suppressHydrationWarning
 * absorbs that expected diff so the user always ends up seeing their local time.
 */
export function LocalTime({
  value,
  mode = "datetime",
  className,
}: {
  value: string | number | null | undefined;
  mode?: TimeMode;
  className?: string;
}) {
  if (value == null) return <span className={className}>—</span>;
  return (
    <span className={className} suppressHydrationWarning>
      {formatLocal(value, mode)}
    </span>
  );
}
