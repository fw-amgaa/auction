/**
 * Official brand lockup: the Ховд province emblem + the live system wordmark
 * (Ан агнуурын дуудлага худалдааны систем). The wordmark is real text (no longer
 * baked into the image) so it stays crisp and is read by screen readers.
 * `chip` places it on a white rounded panel for dark surfaces (AdminNav, Login).
 */
export function Logo({ height = 34, chip = false }: { height?: number; chip?: boolean }) {
  const fontSize = Math.max(9, Math.round(height * 0.36));
  const lockup = (
    <span className="inline-flex items-center gap-2.5" style={{ height }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/emblem.png"
        alt=""
        height={height}
        style={{ height, width: "auto", display: "block" }}
      />
      <span
        className="whitespace-nowrap font-bold uppercase leading-[1.15] tracking-tight text-navy"
        style={{ fontSize }}
      >
        Ан агнуурын дуудлага
        <br />
        худалдааны систем
      </span>
    </span>
  );
  if (!chip) return lockup;
  return <span className="inline-flex rounded-lg bg-white px-2.5 py-1.5">{lockup}</span>;
}
