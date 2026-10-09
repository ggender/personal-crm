import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server in .next/standalone for the Docker image (see Dockerfile).
  output: "standalone",
  // End-to-end tests build into their own folder, so they do not disturb a running `pnpm dev`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
