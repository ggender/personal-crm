import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// No nonces: inline scripts of Next.js are allowed, everything else comes from this site only.
const contentSecurityPolicy = [
  "default-src 'self'",
  // React in `pnpm dev` needs eval for its error overlay and stack traces; the production build does not.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  // Browsers ignore it over plain http, so local runs and end-to-end tests are not affected.
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  // The same ban on frames for browsers that do not know frame-ancestors.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Only features Chrome knows: unknown ones show up as errors in the browser console.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
];

const nextConfig: NextConfig = {
  // Self-contained server in .next/standalone for the Docker image (see Dockerfile).
  output: "standalone",
  // End-to-end tests build into their own folder, so they do not disturb a running `pnpm dev`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // The app does not name its software: no "X-Powered-By: Next.js".
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
