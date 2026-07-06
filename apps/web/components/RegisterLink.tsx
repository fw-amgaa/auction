"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Registration can be closed by an admin (app_settings "registration_open").
 * While closed, every "Бүртгүүлэх" CTA renders as a button that pops this info
 * toast instead of navigating; hitting /register by URL redirects to
 * /login?registration=closed, which shows the same toast there.
 */
export function RegistrationClosedToast({ show, onClose }: { show: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!show) return;
    const t = setTimeout(onClose, 8000);
    return () => clearTimeout(t);
  }, [show, onClose]);
  if (!show) return null;
  return (
    <div className="fixed right-5 top-5 z-[90] w-[min(380px,calc(100vw-32px))] rounded-xl border border-[#F0DFB6] bg-[#FBF4E2] px-4 py-3.5 shadow-lg">
      <div className="flex items-start gap-3">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#C77A0A] text-sm font-bold text-white">
          i
        </span>
        <div className="min-w-0">
          <div className="text-[13.5px] font-bold text-[#8A6D0B]">Бүртгэл түр хаагдсан</div>
          <div className="mt-0.5 text-[12.5px] leading-relaxed text-[#8A6D0B]">
            Шинэ хэрэглэгчийн бүртгэл одоогоор хаалттай байна. Асууж лавлах зүйл байвал зохион
            байгуулагчтай холбогдоно уу.
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Хаах"
          className="ml-auto shrink-0 text-[#8A6D0B]/70 hover:text-[#8A6D0B]"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

/** A "Бүртгүүлэх" CTA that degrades to an info toast while registration is closed. */
export function RegisterLink({
  open,
  className,
  children,
}: {
  open: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const [show, setShow] = useState(false);
  if (open) {
    return (
      <Link href="/register" className={className}>
        {children}
      </Link>
    );
  }
  return (
    <>
      <button type="button" onClick={() => setShow(true)} className={className}>
        {children}
      </button>
      <RegistrationClosedToast show={show} onClose={() => setShow(false)} />
    </>
  );
}
