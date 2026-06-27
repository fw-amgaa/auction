"use server";

import { AuthError } from "next-auth";

import { signIn } from "@/auth";

export interface LoginState {
  error?: string;
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/catalog",
    });
    return {};
  } catch (e) {
    if (e instanceof AuthError) {
      return { error: "Нэвтрэх нэр эсвэл нууц үг буруу байна." };
    }
    throw e; // re-throw NEXT_REDIRECT (successful sign-in) and anything else
  }
}
