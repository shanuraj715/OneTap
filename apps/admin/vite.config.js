import { readFileSync } from "node:fs";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/** The web version (version.json at the repository root — the same file the API, the storefront and the website use), shown in the sidebar's footer. */
const appVersion = (() => {
  try {
    const v = String(JSON.parse(readFileSync(new URL("../../version.json", import.meta.url), "utf8")).version ?? "");
    return /^v-\d{2}\.\d{2}\.\d{2}-\d{3,}$/.test(v) ? v : "dev";
  } catch {
    return "dev";
  }
})();

export default defineConfig({
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(appVersion) },
  server: { port: 3071, strictPort: true },
  preview: { port: 3071, strictPort: true },
});
