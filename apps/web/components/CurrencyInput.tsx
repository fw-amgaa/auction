"use client";

/**
 * Numeric input that displays grouped digits (1,000,000) while keeping the raw
 * digit string in parent state. onChange receives digits only (no separators).
 */
export function CurrencyInput({
  value,
  onChange,
  placeholder,
  className,
  suffix = "₮",
}: {
  value: string;
  onChange: (digits: string) => void;
  placeholder?: string;
  className?: string;
  suffix?: string;
}) {
  const digits = value.replace(/\D/g, "");
  const display = digits ? Number(digits).toLocaleString("en-US") : "";
  return (
    <div className="relative">
      <input
        value={display}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
        inputMode="numeric"
        placeholder={placeholder}
        className={className ?? "tnum h-11 w-full rounded-[9px] border border-line-cool bg-[#FAF8F4] pl-3.5 pr-8 text-sm outline-none focus:border-navy"}
      />
      {suffix && <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-muted">{suffix}</span>}
    </div>
  );
}
