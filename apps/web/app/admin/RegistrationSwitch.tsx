"use client";

import { useOptimistic, useTransition } from "react";

import { setRegistrationOpenAction } from "./actions";

/**
 * Dashboard switch for public bidder registration. When off, every
 * "Бүртгүүлэх" CTA shows an info toast and /register redirects to /login.
 */
export function RegistrationSwitch({ open, canToggle }: { open: boolean; canToggle: boolean }) {
  const [pending, startTransition] = useTransition();
  const [shown, setShown] = useOptimistic(open);

  const toggle = () => {
    if (!canToggle || pending) return;
    startTransition(async () => {
      setShown(!shown);
      await setRegistrationOpenAction(!shown);
    });
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line-cool bg-white px-5 py-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-bold text-navy">Шинэ бүртгэл</span>
          <span
            className="rounded-md px-2 py-0.5 text-[11px] font-bold"
            style={
              shown
                ? { background: "#E5F4EC", color: "#1F8A5B" }
                : { background: "#FBEAE9", color: "#C8312C" }
            }
          >
            {shown ? "НЭЭЛТТЭЙ" : "ХААЛТТАЙ"}
          </span>
        </div>
        <div className="mt-0.5 text-[12.5px] text-muted">
          {shown
            ? "Шинэ оролцогчид бүртгүүлэх боломжтой. Унтраавал бүртгүүлэх хуудас хаагдана."
            : "Бүртгүүлэх хуудас хаалттай — шинэ оролцогч бүртгүүлэх боломжгүй."}
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={shown}
        aria-label="Шинэ бүртгэл нээх / хаах"
        disabled={!canToggle || pending}
        onClick={toggle}
        className="relative h-7 w-[52px] shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        style={{ background: shown ? "#1F8A5B" : "#C9CFD9" }}
        title={canToggle ? undefined : "Эрх хүрэхгүй байна (users.create)"}
      >
        <span
          className="absolute top-0.5 size-6 rounded-full bg-white shadow transition-all"
          style={{ left: shown ? 24 : 2 }}
        />
      </button>
    </div>
  );
}
