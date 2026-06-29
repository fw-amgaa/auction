import path from "node:path";
import { fileURLToPath } from "node:url";

// Native ESM config (.mjs): the package is `"type": "module"`, and Next 16's
// next.config.ts → .compiled.js step emits CommonJS, which breaks under ESM.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import("next").NextConfig} */
const config = {
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
