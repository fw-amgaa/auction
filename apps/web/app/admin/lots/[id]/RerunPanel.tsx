"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { formatTugrug } from "@auction/shared";

import { localInputToIso, toLocalInput } from "@/lib/datetime";

import { rerunLot } from "../actions";

/**
 * Re-run (relist) control for a finished lot — shown when a winner fails to pay.
 * Clears the previous winner/price/payment and reopens the auction on a fresh
 * schedule; the previous round stays in the history + audit log.
 */
export function RerunPanel({
  lotId,
  winnerName,
  finalPrice,
  payment,
}: {
  lotId: string;
  winnerName: string | null;
  finalPrice: number;
  payment: "pending" | "paid" | "defaulted";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  // Sensible defaults in the admin's own timezone (start in 10 min, run 1 hour).
  useEffect(() => {
    const now = Date.now();
    setStartsAt(toLocalInput(new Date(now + 10 * 60_000)));
    setEndsAt(toLocalInput(new Date(now + 70 * 60_000)));
  }, []);

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await rerunLot(lotId, {
        startsAt: localInputToIso(startsAt),
        endsAt: localInputToIso(endsAt),
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      setDone(true);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-line-cool bg-white p-5">
      <h3 className="mb-1 text-sm font-bold text-navy">Дахин дуудлага (re-run)</h3>
      <p className="text-[12.5px] leading-relaxed text-ink-soft">
        Хожсон оролцогч төлбөрөө төлөөгүй бол лотыг дахин нээж, шинээр дуудлага явуулна.
        {winnerName ? (
          <>
            {" "}
            Өмнөх хожигч: <strong className="text-navy">{winnerName}</strong> ·{" "}
            <span className="tnum">{formatTugrug(finalPrice)}</span>
            {payment === "defaulted" ? " (төлбөргүй)" : ""}.
          </>
        ) : null}{" "}
        Өмнөх саналуудын түүх хадгалагдана.
      </p>

      {done && (
        <div className="mt-3 rounded-[10px] border border-[#C7E5D5] bg-[#E5F4EC] px-3.5 py-2.5 text-[12.5px] font-semibold text-[#197a50]">
          ✅ Лот дахин товлогдлоо. Хуваарийн дагуу автоматаар нээгдэнэ.
        </div>
      )}

      {!open ? (
        !done && (
          <button
            onClick={() => setOpen(true)}
            className="mt-3 rounded-[9px] bg-crimson px-4 py-2.5 text-[13.5px] font-bold text-white hover:bg-crimson-hover"
          >
            ↻ Дахин ажиллуулах
          </button>
        )
      ) : (
        <div className="mt-3.5 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-[12.5px] font-semibold text-ink-strong">
                Шинэ эхлэх огноо
              </span>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="h-11 w-full rounded-[9px] border border-line-cool bg-[#FAF8F4] px-3 text-sm outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[12.5px] font-semibold text-ink-strong">
                Шинэ дуусах огноо
              </span>
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="h-11 w-full rounded-[9px] border border-line-cool bg-[#FAF8F4] px-3 text-sm outline-none"
              />
            </label>
          </div>

          {error && <div className="text-[12.5px] font-semibold text-crimson">{error}</div>}

          <div className="flex gap-2.5">
            <button
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
              className="rounded-[9px] border border-[#CDD4DE] bg-white px-4 py-2.5 text-[13.5px] font-semibold text-ink-soft"
            >
              Болих
            </button>
            <button
              onClick={submit}
              disabled={pending || !startsAt || !endsAt}
              className="rounded-[9px] bg-crimson px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-crimson-hover disabled:opacity-60"
            >
              {pending ? "Товлож байна…" : "↻ Дахин нээх"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
