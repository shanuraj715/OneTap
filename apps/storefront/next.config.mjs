import { fileURLToPath } from "node:url";

/** monorepo root — silences the "multiple lockfiles" warning and fixes file tracing */
const workspaceRoot = fileURLToPath(new URL("../../", import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@onetap/ui", "@onetap/config-schema"],
  outputFileTracingRoot: workspaceRoot,
};

export default nextConfig;
