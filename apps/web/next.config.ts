import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // Compile workspace TS packages directly from source.
  transpilePackages: ["@auction/shared", "@auction/db", "@auction/ui"],
  // db client uses node-only deps; keep them server-side (not bundled for client).
  serverExternalPackages: ["postgres"],
};

export default config;
