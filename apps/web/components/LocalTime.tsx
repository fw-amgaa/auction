"use client";

import { useEffect, useState } from "react";

import { formatLocal, type TimeMode } from "@/lib/datetime";

/**
 * Renders an instant in the viewer's own timezone. The server renders it in the
 * server zone (UTC) and suppressHydrationWarning absorbs the expected SSR/CSR
 * diff — but suppression also means hydration KEEPS the server-rendered text in
 * the DOM. A later re-render can't fix it either: the virtual tree already
 * holds the client string, so React sees no change to patch. Swapping the key
 * after mount remounts the span, forcing the browser-zone string into the DOM
 * on hard loads (client-side navigations were always fine).
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
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  if (value == null) return <span className={className}>—</span>;
  return (
    <span key={hydrated ? "local" : "ssr"} className={className} suppressHydrationWarning>
      {formatLocal(value, mode)}
    </span>
  );
}
