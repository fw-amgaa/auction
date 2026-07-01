"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { Logo } from "@/components/Logo";

import { loginAction, type LoginState } from "./actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(loginAction, {});
  const [showPass, setShowPass] = useState(false);

  return (
    <div className="flex min-h-screen text-ink-strong">
      {/* left brand panel */}
      <div className="relative isolate hidden flex-1 flex-col justify-between overflow-hidden bg-navy-deep p-14 text-white md:flex">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/argali.png"
          alt="Ховд аймгийн уулархаг агнуурын нутаг — угалз"
          className="absolute inset-0 -z-10 size-full object-cover"
        />
        <div className="login-scrim absolute inset-0 -z-10" />
        <Link href="/" className="relative inline-flex w-fit items-center rounded-xl bg-white px-3.5 py-2.5">
          <Logo height={30} />
        </Link>
        {/* copy sits at the bottom so it clears the argali's head in the photo */}
        <div className="relative">
          <div className="text-3xl font-bold leading-tight">
            Зэрлэг ан амьтан
            <br />
            агнах эрхийн албан
            <br />
            ёсны дуудлага худалдаа
          </div>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/75">
            Ил тод, шударга, бодит цагийн дуудлага худалдаагаар агнуурын эрхийг хуваарилна.
          </p>
          <div className="mt-8 text-xs text-white/55">
            © 2026 Байгаль орчны яам. Бүх эрх хуулиар хамгаалагдсан.
          </div>
        </div>
      </div>

      {/* right form panel */}
      <div className="flex flex-1 items-center justify-center bg-sand px-6 py-10">
        <form action={formAction} className="w-full max-w-sm">
          <h1 className="text-2xl font-bold text-navy">Нэвтрэх</h1>
          <p className="mt-1.5 text-sm text-ink-soft">
            Бүртгэлдээ нэвтэрч дуудлага худалдаанд оролцоно уу.
          </p>

          <label className="mt-6 mb-1.5 block text-xs font-semibold text-ink-strong">
            И-мэйл
          </label>
          <input
            name="email"
            type="email"
            required
            placeholder="name@mail.mn"
            className="h-11 w-full rounded-[10px] border border-line bg-white px-3.5 text-sm outline-none focus:border-navy"
          />

          <div className="mt-4 mb-1.5 flex items-center justify-between">
            <label className="text-xs font-semibold text-ink-strong">Нууц үг</label>
            <Link href="/forgot" className="text-xs font-semibold text-crimson hover:underline">
              Нууц үг мартсан уу?
            </Link>
          </div>
          <div className="relative">
            <input
              name="password"
              type={showPass ? "text" : "password"}
              required
              placeholder="••••••••"
              className="h-11 w-full rounded-[10px] border border-line bg-white pl-3.5 pr-11 text-sm outline-none focus:border-navy"
            />
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center text-muted"
              aria-label="Нууц үг харах"
            >
              {showPass ? "🙈" : "👁"}
            </button>
          </div>

          {state.error &&
            (state.variant === "info" ? (
              <div className="mt-4 flex items-start gap-2 rounded-[9px] border border-[#F0DFB6] bg-[#FBF4E2] px-3 py-2.5 text-xs leading-relaxed text-[#8A6D0B]">
                <span aria-hidden>⏳</span>
                {state.error}
              </div>
            ) : (
              <div className="mt-4 flex items-start gap-2 rounded-[9px] border border-[#F2D6D4] bg-[#FBEAE9] px-3 py-2.5 text-xs leading-relaxed text-[#A02622]">
                <span aria-hidden>⚠</span>
                {state.error}
              </div>
            ))}

          <button
            type="submit"
            disabled={pending}
            className="mt-5 h-12 w-full rounded-[11px] bg-crimson text-[15px] font-bold text-white transition-colors hover:bg-crimson-hover disabled:opacity-60"
          >
            {pending ? "Нэвтэрч байна…" : "Нэвтрэх"}
          </button>

          <div className="mt-5 text-center text-sm text-ink-soft">
            Бүртгэлгүй юу?{" "}
            <Link href="/register" className="font-semibold text-crimson">
              Бүртгүүлэх
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
