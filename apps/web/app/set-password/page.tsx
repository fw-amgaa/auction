import Link from "next/link";

import { Logo } from "@/components/Logo";
import { peekPasswordToken } from "@/lib/auth-tokens";

import { SetPasswordForm } from "./SetPasswordForm";

export const dynamic = "force-dynamic";

export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const email = token ? await peekPasswordToken(token) : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-sand px-6 py-12 text-ink-strong">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 inline-flex items-center rounded-xl border border-line bg-white px-3.5 py-2.5">
          <Logo height={28} />
        </Link>

        <div className="rounded-2xl border border-line bg-white p-7">
          {!email ? (
            <>
              <h1 className="text-xl font-bold text-navy">Холбоос хүчингүй байна</h1>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                Энэ холбоосын хугацаа дууссан эсвэл буруу байна. Нууц үг сэргээх хүсэлтээ дахин
                илгээнэ үү.
              </p>
              <Link href="/forgot" className="mt-6 inline-block text-sm font-semibold text-crimson">
                Нууц үг сэргээх
              </Link>
            </>
          ) : (
            <SetPasswordForm token={token!} email={email} />
          )}
        </div>
      </div>
    </div>
  );
}
