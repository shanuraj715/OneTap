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


/** monorepo root — silences the "multiple lockfiles" warning and fixes file tracing */
const workspaceRoot = fileURLToPath(new URL("../../", import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: { NEXT_PUBLIC_APP_VERSION: appVersion },
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
