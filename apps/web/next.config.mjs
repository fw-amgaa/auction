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
    // Self-registration submits up to 5 KYC documents (UI caps each at 20MB)
    // through a Server Action. TWO separate body limits gate that POST, and
    // BOTH must be raised or the request is rejected before registerAction runs
    // (so its try/catch can't produce a friendly error):
    //
    //  1. serverActions.bodySizeLimit — the Server Action payload limit
    //     (default 1MB).
    //  2. proxyClientMaxBodySize — the middleware/proxy body limit. This project
    //     has a middleware whose matcher covers /register, so every request
    //     (incl. the Server Action POST) passes through the proxy, which caps
    //     the body at DEFAULT 10MB. THIS is what crashed uploads near ~10MB,
    //     regardless of bodySizeLimit.
    //
    // Both are set above the max the client can send (5 × 20MB = 100MB) plus
    // multipart overhead; the client also blocks totals over 100MB.
    serverActions: {
      bodySizeLimit: "110mb",
    },
    proxyClientMaxBodySize: "110mb",
  },
};

export default config;
