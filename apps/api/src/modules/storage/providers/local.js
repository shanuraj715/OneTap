import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
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

    // No domain in what is stored: "/uploads/<key>" — the API adds this deployment's domain when it sends it out
    // (see upload-urls.js). Only an explicitly configured public base (a CDN in front of the files) is kept as it is.
    const base = cfg.publicBaseUrl?.replace(/\/$/, "");
    return { key, url: base ? `${base}/${keyToUrlPath(key)}` : `/uploads/${keyToUrlPath(key)}` };
  },

  /** A big file from disk (copied, never held in memory). */
  async putFile(cfg, { key, filePath }) {
    const abs = safeAbsolute(cfg.uploadsRoot ?? "", key);
    await mkdir(dirname(abs), { recursive: true });
    await copyFile(filePath, abs);
    const base = cfg.publicBaseUrl?.replace(/\/$/, "");
    return { key, url: base ? `${base}/${keyToUrlPath(key)}` : `/uploads/${keyToUrlPath(key)}` };
  },
  /** Where a stored file is on this disk (so it can be sent with byte ranges), or null when it isn't there. */
  async pathOf(cfg, key) {
    const abs = safeAbsolute(cfg.uploadsRoot ?? "", key);
    return (await stat(abs).then((i) => i.isFile(), () => false)) ? abs : null;
  },
  async remove(cfg, key) {
    const root = cfg.uploadsRoot ?? "";
    try {
      await rm(safeAbsolute(root, key), { force: true });
    } catch {
      /* already gone — deletion is best-effort */
    }
  },

  /** The file's bytes. */
  async get(cfg, key) {
    return readFile(safeAbsolute(cfg.uploadsRoot ?? "", key));
  },

  /** `{ size, modifiedAt }`, or null when there is no such file. */
  async head(cfg, key) {
    try {
      const info = await stat(safeAbsolute(cfg.uploadsRoot ?? "", key));
      return info.isFile() ? { size: info.size, modifiedAt: info.mtime } : null;
    } catch {
      return null;
    }
  },

  /** Every file under the uploads folder (or under `prefix`), one `{ key, size, modifiedAt }` at a time. */
  async *list(cfg, { prefix = "" } = {}) {
    const root = cfg.uploadsRoot ?? "";
    const start = prefix ? safeAbsolute(root, prefix.replace(/\/+$/, "")) : root;
    async function* walk(dir) {
      let entries;
      try {
        entries = await readdir(dir, { withFileTypes: true });
      } catch {
        return; // the folder doesn't exist (yet): nothing stored
      }
      for (const entry of entries) {
        const abs = join(dir, entry.name);
        if (entry.isDirectory()) yield* walk(abs);
        else if (entry.isFile()) {
          const info = await stat(abs);
          yield { key: abs.slice(root.length + 1).split(sep).join("/"), size: info.size, modifiedAt: info.mtime };
        }
      }
    }
    yield* walk(start);
  },

  /** Where a stored file is opened from (the form that is kept in the database). */
  urlFor(cfg, key) {
    const base = cfg.publicBaseUrl?.replace(/\/$/, "");
    return base ? `${base}/${keyToUrlPath(key)}` : `/uploads/${keyToUrlPath(key)}`;
  },
};

/** Exposed for the static-file mount in app.js. */
export const localUploadsPath = (uploadsDir, cwd = process.cwd()) => join(cwd, uploadsDir);
