"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { setPasswordAction, type SetPasswordState } from "./actions";

export function SetPasswordForm({ token, email }: { token: string; email: string }) {
  const [state, formAction, pending] = useActionState<SetPasswordState, FormData>(setPasswordAction, {});
  const [show, setShow] = useState(false);

  if (state.ok) {
    return (
      <>
        <h1 className="text-xl font-bold text-navy">Нууц үг тохирлоо</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          Таны нууц үг амжилттай хадгалагдлаа. Одоо шинэ нууц үгээрээ нэвтэрнэ үү.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-[11px] bg-crimson text-sm font-bold text-white transition-colors hover:bg-crimson-hover"
        >
          Нэвтрэх
        </Link>
      </>
    );
  }

  const inputCls =
    "h-11 w-full rounded-[10px] border border-line bg-white px-3.5 text-sm outline-none focus:border-navy";

  return (
    <form action={formAction}>
      <h1 className="text-xl font-bold text-navy">Нууц үг тохируулах</h1>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
        <span className="font-semibold text-navy">{email}</span> хаягийн шинэ нууц үгээ оруулна уу.
      </p>

      <input type="hidden" name="token" value={token} />

      <label className="mt-5 mb-1.5 block text-xs font-semibold text-ink-strong">Шинэ нууц үг</label>
      <input name="password" type={show ? "text" : "password"} required minLength={8} placeholder="Дор хаяж 8 тэмдэгт" className={inputCls} />

      <label className="mt-4 mb-1.5 block text-xs font-semibold text-ink-strong">Нууц үг давтах</label>
      <input name="confirm" type={show ? "text" : "password"} required placeholder="••••••••" className={inputCls} />

      <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-ink-soft">
        <input type="checkbox" checked={show} onChange={() => setShow((v) => !v)} className="accent-crimson" />
        Нууц үг харах
      </label>

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
        {pending ? "Хадгалж байна…" : "Нууц үг хадгалах"}
      </button>
    </form>
  );
}
