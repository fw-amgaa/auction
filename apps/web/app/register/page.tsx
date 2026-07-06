import { redirect } from "next/navigation";

import { isRegistrationOpen } from "@/lib/settings";

import { RegisterForm } from "./RegisterForm";

export const dynamic = "force-dynamic";

/**
 * Server gate for the admin registration switch: when registration is closed,
 * a direct visit to /register bounces to the login page, which shows the
 * "registration closed" info toast. registerAction re-checks on submit.
 */
export default async function RegisterPage() {
  if (!(await isRegistrationOpen())) redirect("/login?registration=closed");
  return <RegisterForm />;
}
