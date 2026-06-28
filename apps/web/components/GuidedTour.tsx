"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export interface TourStep {
  sel: string;
  title: string;
  body: string;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Spotlight coachmark tour. Starts automatically on first visit (or with
 * ?tour=1) and can be replayed from Help. Persists "seen" in localStorage.
 */
export function GuidedTour({ steps, storageKey }: { steps: TourStep[]; storageKey: string }) {
  const params = useSearchParams();
  const [i, setI] = useState<number | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [vp, setVp] = useState({ w: 1280, h: 800 });

  // decide whether to start
  useEffect(() => {
    const forced = params.get("tour") === "1";
    let seen = false;
    try {
      seen = !!localStorage.getItem(storageKey);
    } catch {
      /* ignore */
    }
    if (forced || !seen) {
      const t = setTimeout(() => setI(0), 700);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [params, storageKey]);

  // measure the active target
  useEffect(() => {
    if (i === null) return;
    const measure = () => {
      setVp({ w: window.innerWidth, h: window.innerHeight });
      const el = document.querySelector(steps[i]!.sel);
      if (!el) {
        setRect(null);
        return;
      }
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      const r = el.getBoundingClientRect();
      const pad = 8;
      setRect({ x: r.left - pad, y: r.top - pad, w: r.width + pad * 2, h: r.height + pad * 2 });
    };
    const t = setTimeout(measure, 60);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [i, steps]);

  if (i === null) return null;

  function end() {
    try {
      localStorage.setItem(storageKey, "1");
    } catch {
      /* ignore */
    }
    setI(null);
  }
  const next = () => (i! >= steps.length - 1 ? end() : setI(i! + 1));
  const back = () => i! > 0 && setI(i! - 1);

  // tooltip placement: below the target if room, else above
  let tipX = 24;
  let tipY = 100;
  if (rect) {
    const below = rect.y + rect.h + 14;
    tipY = below < vp.h - 200 ? below : Math.max(14, rect.y - 196);
    tipX = Math.min(Math.max(14, rect.x), vp.w - 334);
  }
  const step = steps[i]!;

  return (
    <div className="fixed inset-0 z-[90]" style={{ pointerEvents: "none" }}>
      {rect && (
        <div
          className="fixed rounded-2xl border-2 border-crimson transition-all duration-300"
          style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h, boxShadow: "0 0 0 9999px rgba(14,30,56,.62)" }}
        />
      )}
      <div
        className="fixed w-[312px] max-w-[calc(100vw-24px)] rounded-[15px] border border-line bg-white p-[18px] shadow-2xl transition-all duration-300"
        style={{ left: tipX, top: tipY, pointerEvents: "auto" }}
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wide text-crimson">
            Алхам {i + 1} / {steps.length}
          </span>
          <button onClick={end} className="text-[12px] text-muted">Алгасах ✕</button>
        </div>
        <div className="text-[17px] font-bold text-navy">{step.title}</div>
        <div className="mt-1.5 text-[13.5px] leading-relaxed text-ink-soft">{step.body}</div>
        <div className="mt-4 flex items-center justify-between">
          <div className="flex gap-1.5">
            {steps.map((_, k) => (
              <span key={k} className="size-[7px] rounded-full" style={{ background: k === i ? "#C8312C" : "#E0DACD" }} />
            ))}
          </div>
          <div className="flex gap-2">
            {i > 0 && (
              <button onClick={back} className="rounded-[9px] border border-[#CDD4DE] px-3.5 py-2 text-[13px] font-semibold text-ink-strong">
                Буцах
              </button>
            )}
            <button onClick={next} className="rounded-[9px] bg-crimson px-4.5 py-2 text-[13px] font-bold text-white" style={{ paddingInline: 18 }}>
              {i === steps.length - 1 ? "Дуусгах" : "Цааш"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
