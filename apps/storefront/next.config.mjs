import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

/** The web version (version.json at the repository root — the same file the API and the admin panel use), shown in the footer. */
const appVersion = (() => {
  if (process.env.APP_VERSION?.trim()) return process.env.APP_VERSION.trim();
  try {
    const v = String(JSON.parse(readFileSync(new URL("../../version.json", import.meta.url), "utf8")).version ?? "");
    return /^v-\d{2}\.\d{2}\.\d{2}-\d{3,}$/.test(v) ? v : "dev";
  } catch {
    return "dev";
  }
})();

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
  env: { NEXT_PUBLIC_APP_VERSION: appVersion },
  transpilePackages: ["@rasoipulse/ui", "@rasoipulse/config-schema"],
  outputFileTracingRoot: workspaceRoot,
  // local trials of store addresses open on acme.localhost:3070; the dev server should treat those as its own
  allowedDevOrigins: ["*.localhost"],
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
