import { fileURLToPath } from "node:url";

/** monorepo root — silences the "multiple lockfiles" warning and fixes file tracing */
const workspaceRoot = fileURLToPath(new URL("../../", import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@onetap/ui", "@onetap/config-schema"],
  outputFileTracingRoot: workspaceRoot,
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
