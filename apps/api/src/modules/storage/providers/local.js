import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, normalize, resolve, sep } from "node:path";

/** Keys are always "/"-joined; use forward slashes in the URL regardless of OS. */
const keyToUrlPath = (key) => key.split(/[\\/]+/).filter(Boolean).join("/");

/** Reject a key that tries to escape the uploads root. */
function safeAbsolute(root, key) {
  const abs = resolve(root, normalize(key));
  if (abs !== root && !abs.startsWith(root + sep)) {
    throw new Error("Invalid storage key");
  }
  return abs;
}

/** @type {import("./types.js").StorageAdapter} */
export const localProvider = {
  id: "local",

  async put(cfg, { key, body }) {
    const root = cfg.uploadsRoot ?? "";
    const abs = safeAbsolute(root, key);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, body);

    const base = cfg.publicBaseUrl?.replace(/\/$/, "") || `${cfg.publicApiUrl?.replace(/\/$/, "")}/uploads`;
    return { key, url: `${base}/${keyToUrlPath(key)}` };
  },

  async remove(cfg, key) {
    const root = cfg.uploadsRoot ?? "";
    try {
      await rm(safeAbsolute(root, key), { force: true });
    } catch {
      /* already gone — deletion is best-effort */
    }
  },
};

/** Exposed for the static-file mount in app.js. */
export const localUploadsPath = (uploadsDir, cwd = process.cwd()) => join(cwd, uploadsDir);
