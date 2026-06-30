"use client";

import { useState } from "react";

const STRIPES = "repeating-linear-gradient(135deg,#DCE3EC 0 12px,#D2DAE5 12px 24px)";

/**
 * Thumbnail preview for an uploaded KYC document. Renders the actual file via
 * the doc-serving endpoint (`/api/admin/kyc-doc/[id]`, which authorizes admins
 * and the owning user) — an `<img>` for images, an inline first page for PDFs —
 * and falls back to a striped label box if the file can't be displayed.
 *
 * Inner previews use `pointer-events-none` so the click reaches the wrapping
 * link/button that opens the full document.
 */
export function DocThumb({
  id,
  kind,
  label,
  className = "h-[100px]",
}: {
  id: string;
  /** "PDF" for PDFs, anything else (e.g. "ЗУРАГ") is treated as an image. */
  kind: string;
  label?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = `/api/admin/kyc-doc/${id}`;

  if (failed) {
    return (
      <div
        className={`flex w-full items-center justify-center text-[12.5px] font-bold text-ink-soft ${className}`}
        style={{ backgroundImage: STRIPES }}
      >
        {kind}
      </div>
    );
  }

  if (kind === "PDF") {
    return (
      <div className={`relative w-full overflow-hidden bg-[#EEF1F5] ${className}`}>
        <object
          data={`${src}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
          type="application/pdf"
          aria-label={label ?? "PDF баримт"}
          className="pointer-events-none absolute inset-0 size-full"
        >
          <div
            className="flex size-full items-center justify-center text-[12.5px] font-bold text-ink-soft"
            style={{ backgroundImage: STRIPES }}
          >
            PDF
          </div>
        </object>
        <span className="pointer-events-none absolute bottom-1 right-1 rounded bg-navy/80 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white">
          PDF
        </span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={label ?? ""}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`w-full bg-[#EEF1F5] object-cover ${className}`}
    />
  );
}
