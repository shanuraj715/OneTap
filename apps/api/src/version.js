import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { isValidVersion } from "@rasoipulse/config-schema";

/**
 * The version this API is running: the one in `version.json` at the repository root (the same file the storefront, the website and the admin
 * panel are built from), or `APP_VERSION` when a deployment sets it, or "dev" when neither is there. Read once, at start.
 */
function readVersion() {
  const fromEnv = process.env.APP_VERSION?.trim();
  if (fromEnv) return fromEnv;
  try {
    const text = readFileSync(fileURLToPath(new URL("../../../version.json", import.meta.url)), "utf8");
    const v = String(JSON.parse(text).version ?? "");
    return isValidVersion(v) ? v : "dev";
  } catch {
    return "dev";
  }
}

export const APP_VERSION = readVersion();
/** The response header that carries it on every answer. */
export const VERSION_HEADER = "X-RasoiPulse-Version";
