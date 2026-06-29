"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Logo } from "@/components/Logo";

import { forgotAction, type ForgotState } from "./actions";

export default function ForgotPage() {
  const [state, formAction, pending] = useActionState<ForgotState, FormData>(forgotAction, {});

  return (
    <div className="flex min-h-screen items-center justify-center bg-sand px-6 py-12 text-ink-strong">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 inline-flex items-center rounded-xl border border-line bg-white px-3.5 py-2.5">
          <Logo height={28} />
        </Link>

        <div className="rounded-2xl border border-line bg-white p-7">
          {state.sent ? (
            <>
              <h1 className="text-xl font-bold text-navy">Холбоосыг илгээлээ</h1>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                Хэрэв энэ хаягаар бүртгэл байгаа бол нууц үг сэргээх холбоос илгээгдсэн. И-мэйлээ
                шалгана уу. Холбоос 1 цагийн дотор хүчинтэй.
              </p>
              <Link href="/login" className="mt-6 inline-block text-sm font-semibold text-crimson">
                ‹ Нэвтрэх рүү буцах
              </Link>
            </>
          ) : (
            <form action={formAction}>
              <h1 className="text-xl font-bold text-navy">Нууц үг сэргээх</h1>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                Бүртгэлтэй и-мэйл хаягаа оруулна уу. Бид нууц үг тохируулах холбоос илгээнэ.
              </p>

              <label className="mt-5 mb-1.5 block text-xs font-semibold text-ink-strong">И-мэйл</label>
              <input
                name="email"
                type="email"
                required
                placeholder="name@mail.mn"
                className="h-11 w-full rounded-[10px] border border-line bg-white px-3.5 text-sm outline-none focus:border-navy"
              />

              {state.error && (
                <div className="mt-3 rounded-[9px] border border-[#F2D6D4] bg-[#FBEAE9] px-3 py-2.5 text-xs text-[#A02622]">
                  {state.error}
                </div>
              )}

              <button
                type="submit"
                disabled={pending}
                className="mt-5 h-12 w-full rounded-[11px] bg-crimson text-[15px] font-bold text-white transition-colors hover:bg-crimson-hover disabled:opacity-60"
              >
                {pending ? "Илгээж байна…" : "Холбоос илгээх"}
              </button>

              <div className="mt-5 text-center text-sm text-ink-soft">
                <Link href="/login" className="font-semibold text-crimson">
                  ‹ Нэвтрэх
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
