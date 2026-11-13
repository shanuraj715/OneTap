import { fileURLToPath } from "node:url";

/** monorepo root — silences the "multiple lockfiles" warning and fixes file tracing */
const workspaceRoot = fileURLToPath(new URL("../../", import.meta.url));

/**
 * Where `/api/*` on the storefront's own domain is passed through to (see
 * src/lib/clientApi.js). On the server this should be the API's internal
 * address (API_INTERNAL_URL, e.g. http://127.0.0.1:3072) so the hop never
 * leaves the machine; it falls back to the public API URL.
 */
const apiTarget = (process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3072").replace(/\/$/, "");

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@onetap/ui", "@onetap/config-schema"],
  outputFileTracingRoot: workspaceRoot,
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiTarget}/api/:path*` }];
  },
  async redirects() {
    return [
      {
        source: "/variants",
        destination: "/",
        permanent: false,
      },
      {
        source: "/variation",
        destination: "/",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
