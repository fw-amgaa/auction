import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL ?? "postgres://auction:auction@localhost:5432/auction";

// Long-running services (Next.js node server, bid service) — a small pool is fine.
const queryClient = postgres(connectionString, { max: 10 });

export const db = drizzle(queryClient, { schema, casing: "snake_case" });

export type DB = typeof db;
export { schema };
