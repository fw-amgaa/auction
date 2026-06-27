import { eq } from "drizzle-orm";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { db, schema } from "@auction/db";
import { loginSchema } from "@auction/shared";

import { authConfig } from "./auth.config";
import { verifyPassword } from "./lib/password";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(creds) {
        const parsed = loginSchema.safeParse(creds);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const [u] = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.email, email))
          .limit(1);

        if (!u || !u.passwordHash || u.disabled) return null;
        const ok = await verifyPassword(u.passwordHash, password);
        if (!ok) return null;

        return { id: u.id, email: u.email, name: u.name ?? undefined, role: u.role };
      },
    }),
  ],
});
