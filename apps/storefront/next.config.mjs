import { fileURLToPath } from "node:url";
import { apiServerUrl } from "./src/lib/api-config.js";

/** monorepo root — silences the "multiple lockfiles" warning and fixes file tracing */
const workspaceRoot = fileURLToPath(new URL("../../", import.meta.url));

/**
 * Where `/api/*` on the storefront's own domain is passed through to (see
 * src/lib/clientApi.js) — the API address from src/lib/api-config.js, which
 * ships with a default and can be overridden per deployment.
 */
const apiTarget = apiServerUrl();

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
