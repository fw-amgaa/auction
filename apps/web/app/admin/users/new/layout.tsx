import { requirePageAccess } from "@/lib/session";

/**
 * Server guard for the (client) "create user" page. The page itself is a client
 * component, so its access check lives here: only users.create may reach the
 * form. The createUserAction is independently gated as the real backstop.
 */
export default async function NewUserLayout({ children }: { children: React.ReactNode }) {
  await requirePageAccess("users.create");
  return <>{children}</>;
}
