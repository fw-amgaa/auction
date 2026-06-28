import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // hide the dev overlay button (was overlapping the admin sidebar logout)
  devIndicators: false,
  // Compile workspace TS packages directly from source.
  transpilePackages: ["@auction/shared", "@auction/db", "@auction/ui"],
  // db client uses node-only deps; keep them server-side (not bundled for client).
  serverExternalPackages: ["postgres"],
};

export default config;
