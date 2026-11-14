import { fileURLToPath } from "node:url";
import { apiServerUrl } from "./src/lib/api-config.js";

/** monorepo root — silences the "multiple lockfiles" warning and fixes file tracing */
const workspaceRoot = fileURLToPath(new URL("../../", import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@onetap/config-schema"],
  outputFileTracingRoot: workspaceRoot,
  poweredByHeader: false,
  async rewrites() {
    // The contact form posts to this site's own /api/site/leads; the hop to the
    // API happens on the server, so no CORS and nothing to configure per domain.
    return [{ source: "/api/site/:path*", destination: `${apiServerUrl()}/api/site/:path*` }];
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
