import { fileURLToPath } from "node:url";

/** monorepo root — silences the "multiple lockfiles" warning and fixes file tracing */
const workspaceRoot = fileURLToPath(new URL("../../", import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@rasoipulse/config-schema"],
  outputFileTracingRoot: workspaceRoot,
  poweredByHeader: false,
  // the first staff app was given /app as its download page: keep that address working
  async redirects() {
    return [{ source: "/app", destination: "/apps/oma", permanent: true }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
};

export default nextConfig;
