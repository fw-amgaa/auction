"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { APIError } from "better-auth/api";

import { db, schema } from "@auction/db";

import { auth } from "@/lib/auth";

export interface LoginState {
  error?: string;
  /** "info" renders as an amber notice (e.g. KYC pending) rather than a red error. */
  variant?: "error" | "info";
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  // route admins to the admin console, everyone else to the catalog
  const [u] = await db
    .select({
      id: schema.users.id,
      role: schema.users.role,
      kyc: schema.users.kyc,
      disabled: schema.users.disabled,
    })
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);
  const redirectTo = u?.role === "admin" ? "/admin" : "/catalog";

  try {
    // nextCookies() persists the session cookie set during this call
    await auth.api.signInEmail({ body: { email, password }, headers: await headers() });
  } catch (e) {
    if (e instanceof APIError) {
      return { error: "Нэвтрэх нэр эсвэл нууц үг буруу байна." };
    }
    throw e;
  }

  // Credentials are valid here. Bidders may only enter once KYC is APPROVED —
  // gate them now (admins are staff and bypass KYC). We check after auth so the
  // KYC state is never revealed to someone who doesn't hold the password. The
  // just-created session is revoked so the set cookie can't be used.
  if (u && u.role !== "admin" && (u.disabled || u.kyc !== "approved")) {
    await db.delete(schema.sessions).where(eq(schema.sessions.userId, u.id));
    if (u.disabled) {
      return {
        error: "Таны бүртгэл түр хаагдсан байна. Зохион байгуулагчтай холбогдоно уу.",
      };
    }
    if (u.kyc === "rejected") {
      return {
        error: "Таны KYC баталгаажуулалт татгалзсан байна. Дэлгэрэнгүйг зохион байгуулагчаас лавлана уу.",
      };
    }
    return {
      variant: "info",
      error: "Таны бүртгэл KYC баталгаажуулалт хүлээгдэж байна. Баталгаажсаны дараа нэвтрэх боломжтой.",
    };
  }

  // redirect throws NEXT_REDIRECT; keep it outside the try so it isn't swallowed
  redirect(redirectTo);
}
