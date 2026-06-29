"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { APIError } from "better-auth/api";

import { db, schema } from "@auction/db";

import { auth } from "@/lib/auth";

export interface LoginState {
  error?: string;
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  // route admins to the admin console, everyone else to the catalog
  const [u] = await db
    .select({ role: schema.users.role })
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

  // redirect throws NEXT_REDIRECT; keep it outside the try so it isn't swallowed
  redirect(redirectTo);
}
