import { isRegistrationOpen } from "@/lib/settings";

import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [sp, registrationOpen] = await Promise.all([searchParams, isRegistrationOpen()]);
  return (
    <LoginForm
      registrationOpen={registrationOpen}
      registrationClosedNotice={!registrationOpen && sp.registration === "closed"}
    />
  );
}
