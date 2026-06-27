import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://auction:auction@localhost:5432/auction",
  },
  casing: "snake_case",
  verbose: true,
  strict: true,
});
