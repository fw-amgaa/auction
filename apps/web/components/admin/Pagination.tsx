import Link from "next/link";

/**
 * Shared prev/next pagination for admin tables. Two modes:
 *  - link mode (`hrefFor`): server pages render real links
 *  - button mode (`onPage`): client components with local page state
 *
 * Renders nothing when there is only one page.
 */
export function Pagination({
  page,
  hasNext,
  hrefFor,
  onPage,
  compact = false,
}: {
  page: number;
  hasNext: boolean;
  hrefFor?: (n: number) => string;
  onPage?: (n: number) => void;
  /** Dense variant for sidebars (smaller controls, border-top instead of margin). */
  compact?: boolean;
}) {
  if (page <= 1 && !hasNext) return null;

  const wrap = compact
    ? "flex items-center justify-between border-t border-[#EBEEF3] px-4 py-3 text-[12.5px]"
    : "mt-4 flex items-center justify-between text-[13px]";
  const ctl = compact
    ? "rounded-[7px] border border-line-cool px-2.5 py-1.5 font-medium"
    : "rounded-[9px] border border-line-cool px-3.5 py-2 font-medium";
  const active = `${ctl} text-ink-soft transition-colors hover:bg-[#F7F8FA]`;
  const inactive = `${ctl} cursor-not-allowed text-[#C7CFD9]`;

  const nav = (n: number, label: string, enabled: boolean) => {
    if (!enabled) return <span className={inactive}>{label}</span>;
    if (hrefFor) return <Link href={hrefFor(n)} className={active}>{label}</Link>;
    return (
      <button type="button" onClick={() => onPage?.(n)} className={active}>
        {label}
      </button>
    );
  };

  return (
    <div className={wrap}>
      <span className="text-muted">Хуудас {page}</span>
      <div className={compact ? "flex gap-1.5" : "flex gap-2"}>
        {nav(page - 1, "← Өмнөх", page > 1)}
        {nav(page + 1, "Дараах →", hasNext)}
      </div>
    </div>
  );
}
