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
  experimental: {
    // Self-registration submits 3–4 KYC documents (UI allows up to 10MB each)
    // through a Server Action. Next's default Server Action body limit is 1MB,
    // which rejects the POST with a framework-level 500 before registerAction
    // ever runs. Raise it to cover the advertised per-file size × max doc count.
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
};

export default config;
