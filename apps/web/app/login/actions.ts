"use server";

import { eq } from "drizzle-orm";
import { AuthError } from "next-auth";

import { db, schema } from "@auction/db";

import { signIn } from "@/auth";

export interface LoginState {
  error?: string;
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  // route admins to the admin console, everyone else to the catalog
  const [u] = await db
    .select({ role: schema.users.role })
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);
  const redirectTo = u?.role === "admin" ? "/admin" : "/catalog";

  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo,
    });
    return {};
  } catch (e) {
    if (e instanceof AuthError) {
      return { error: "Нэвтрэх нэр эсвэл нууц үг буруу байна." };
    }
    throw e; // re-throw NEXT_REDIRECT (successful sign-in) and anything else
  }
}
