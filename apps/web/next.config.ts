import path from "node:path";
import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const config: NextConfig = {
  reactStrictMode: true,
  // hide the dev overlay button (was overlapping the admin sidebar logout)
  devIndicators: false,
  // Compile workspace TS packages directly from source.
  transpilePackages: ["@auction/shared", "@auction/db", "@auction/ui"],
  // db client uses node-only deps; keep them server-side (not bundled for client).
  serverExternalPackages: ["postgres"],
  // Self-contained server build for Docker. outputFileTracingRoot points at the
  // monorepo root so workspace packages are traced into .next/standalone.
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../../"),
};

export default config;
