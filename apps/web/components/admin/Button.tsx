import Link from "next/link";

/**
 * Shared dashboard button. Every admin action button goes through this so
 * hover, focus, disabled and loading behavior stay identical everywhere.
 *
 * Not a client component on purpose: it renders plain markup, so server pages
 * can use AdminLinkButton directly and client components get the same styles.
 */

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "subtle"
  | "success"
  | "success-outline"
  | "danger"
  | "ghost";
export type ButtonSize = "md" | "sm";

const BASE =
  "inline-flex items-center justify-center gap-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy disabled:cursor-not-allowed disabled:opacity-55";

const SIZES: Record<ButtonSize, string> = {
  md: "rounded-[9px] px-4 py-2.5 text-[13.5px]",
  sm: "rounded-[7px] px-2.5 py-1.5 text-[12px]",
};

const VARIANTS: Record<ButtonVariant, { rest: string; hover: string }> = {
  primary: { rest: "bg-crimson font-bold text-white", hover: "hover:bg-crimson-hover" },
  success: { rest: "bg-success font-bold text-white", hover: "hover:bg-[#197a50]" },
  "success-outline": {
    rest: "border border-[#1F8A5B]/40 bg-white font-semibold text-[#1F8A5B]",
    hover: "hover:bg-[#E5F4EC]",
  },
  secondary: { rest: "border border-line-cool bg-white font-semibold text-navy", hover: "hover:bg-[#F3F5F8]" },
  subtle: { rest: "border border-line-cool bg-[#F3F5F8] font-semibold text-navy", hover: "hover:bg-[#E9EDF2]" },
  danger: { rest: "border border-[#E0908C] bg-white font-semibold text-crimson", hover: "hover:bg-[#FBEAE9]" },
  ghost: { rest: "border border-[#CDD4DE] bg-white font-semibold text-ink-soft", hover: "hover:bg-[#F7F8FA]" },
};

/** Compose the button classes; hover styles are dropped while disabled/loading. */
export function buttonClass(opts: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  className?: string;
}): string {
  const v = VARIANTS[opts.variant ?? "secondary"];
  return [BASE, SIZES[opts.size ?? "md"], v.rest, opts.disabled ? "" : v.hover, opts.className ?? ""]
    .filter(Boolean)
    .join(" ");
}

export function Spinner({ className = "size-3.5" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
    />
  );
}

export function AdminButton({
  variant = "secondary",
  size = "md",
  loading = false,
  disabled,
  className,
  children,
  type = "button",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Disables the button and shows a spinner next to the label. */
  loading?: boolean;
}) {
  const isDisabled = disabled || loading;
  return (
    <button
      type={type}
      disabled={isDisabled}
      className={buttonClass({ variant, size, disabled: isDisabled, className })}
      {...rest}
    >
      {loading && <Spinner className={size === "sm" ? "size-3" : "size-3.5"} />}
      {children}
    </button>
  );
}

export function AdminLinkButton({
  variant = "secondary",
  size = "md",
  className,
  ...rest
}: React.ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  return <Link className={buttonClass({ variant, size, className })} {...rest} />;
}
