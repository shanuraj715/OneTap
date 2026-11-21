import { randomUUID } from "node:crypto";
import { STORAGE_FIELDS, STORAGE_PROVIDERS, STORAGE_PROVIDER_LABELS, STORAGE_REQUIRED_FIELDS } from "@onetap/config-schema";
import { BrandModel, OutletModel } from "@onetap/db";
import { env, publicApiUrl } from "../../env.js";
import { HttpError } from "../../middleware/error.js";
import { localUploadsPath, providerFor } from "./providers/index.js";
import { referencedKeys } from "./storage-links.js";
import { resolveStorage } from "./storage.service.js";

/**
 * What the console's Storage page can do beyond saving settings: try a storage without making it the active one, count
 * what is stored where (per store and outlet), and — in storage-migrate.js — move the files from one place to another.
 */

const UPLOADS_ROOT = localUploadsPath(env.UPLOADS_DIR);
const PROBE_CTX = { brandId: "platform", outletId: "probe" };

/** The storage every upload goes to right now, fully resolved (secrets decrypted). Never leaves the API. */
export const activeConfig = () => resolveStorage(PROBE_CTX);

/** "Cloudflare R2", "Amazon S3"… — what to call a bucket in the console. */
export function describeStorage(cfg) {
  if (cfg.provider === "local") return "This server's disk";
  const host = `${cfg.endpoint ?? ""}`.toLowerCase();
  const name = host.includes("r2.cloudflarestorage.com") ? "Cloudflare R2" : host.includes("digitaloceanspaces") ? "DigitalOcean Spaces" : host.includes("backblaze") || host.includes("backblazeb2") ? "Backblaze B2" : !host ? "Amazon S3" : "S3-compatible storage";
  return cfg.bucket ? `${name} · ${cfg.bucket}` : name;
}

/** What identifies a storage (two descriptions of the same bucket are the same storage). */
export const storageIdentity = (cfg) => (cfg.provider === "local" ? "local" : `s3|${(cfg.endpoint ?? "").replace(/\/$/, "")}|${cfg.bucket}`);

const labelOf = (key) => STORAGE_FIELDS.s3.find((f) => f.key === key)?.label ?? key;

/**
 * A storage config from details typed in the console — for trying it, or moving files to it — without saving anything.
 * A secret left blank is taken from what is saved, but only when the saved storage is the same kind.
 */
export async function configFromInput({ provider, values = {} }) {
  if (!STORAGE_PROVIDERS.includes(provider)) throw new HttpError(400, "Unknown storage provider");
  const saved = await activeConfig().catch(() => null);
  const reuse = saved && saved.provider === provider ? saved : {};
  const cfg = { provider, brandId: PROBE_CTX.brandId, outletId: PROBE_CTX.outletId, uploadsRoot: UPLOADS_ROOT, publicApiUrl };
  for (const f of STORAGE_FIELDS[provider]) {
    const typed = typeof values[f.key] === "string" ? values[f.key].trim() : undefined;
    // a blank secret means "keep the saved one"; a blank plain field means "none"
    const v = f.secret ? typed || reuse[f.key] || "" : typed !== undefined ? typed : reuse[f.key] || "";
    if (v) cfg[f.key] = v;
  }
  const missing = (STORAGE_REQUIRED_FIELDS[provider] ?? []).filter((k) => !cfg[k]).map(labelOf);
  return { cfg, missing };
}

/* ---------------------------------------------------------------------- test */

const withTimeout = (ms) => AbortSignal.timeout(ms);

/**
 * Write a small file, read it back, open it from its public address, delete it — and say how each step went. Proves the keys
 * work AND that the pictures would actually show (a bucket that accepts uploads but isn't public is the usual surprise).
 */
async function probe(cfg) {
  const adapter = providerFor(cfg.provider);
  const key = `platform/_probe/${randomUUID()}.txt`; // (not a dot-folder: the static file server hides those, which would fail the public check for no reason)
  const body = Buffer.from(`tablepe storage probe ${new Date().toISOString()}`);
  const steps = [];
  const started = Date.now();
  let publicUrl = "";

  const run = async (id, label, fn) => {
    const t = Date.now();
    try {
      const r = (await fn()) ?? {};
      steps.push({ id, label, ok: r.warn ? false : true, warn: Boolean(r.warn), detail: r.warn ?? r.detail ?? "", ms: Date.now() - t });
      return true;
    } catch (err) {
      steps.push({ id, label, ok: false, warn: false, detail: err instanceof Error ? err.message : String(err), ms: Date.now() - t });
      return false;
    }
  };

  const wrote = await run("write", "Save a test file (your keys are accepted)", async () => {
    const r = await adapter.put(cfg, { key, body, contentType: "text/plain" });
    publicUrl = r.url.startsWith("/") ? `${publicApiUrl}${r.url}` : r.url; // this server's own files are "/uploads/…": add its public address
    return { detail: cfg.provider === "local" ? "Written to the uploads folder." : "The bucket accepted it." };
  });
  if (wrote) {
    await run("read", "Read it back", async () => {
      const back = await adapter.get(cfg, key);
      if (!Buffer.from(back).equals(body)) throw new Error("What came back is not what was saved.");
      return { detail: "Identical." };
    });
    await run("public", "Open it from its public address (how a customer's browser will)", async () => {
      let res;
      try {
        res = await fetch(publicUrl, { signal: withTimeout(8000) });
      } catch {
        return { warn: `Couldn't open ${publicUrl} from this server. If that address works from a browser, ignore this (some servers can't reach their own public address).` };
      }
      if (!res.ok) {
        return {
          warn: `${publicUrl} answered ${res.status}. ${cfg.provider === "s3" ? "Pictures won't show until the bucket allows public reads (a public bucket, or a Public base URL pointing at a CDN in front of it)." : "Check PUBLIC_API_URL and the web server in front of this API."}`,
        };
      }
      const text = Buffer.from(await res.arrayBuffer());
      return text.equals(body) ? { detail: publicUrl } : { warn: `${publicUrl} opened, but showed something else.` };
    });
    await run("delete", "Delete the test file", async () => {
      await adapter.remove(cfg, key);
      return { detail: "Cleaned up." };
    });
  }

  const must = steps.filter((s) => s.id !== "public");
  return {
    ok: wrote && must.every((s) => s.ok),
    publicOk: steps.find((s) => s.id === "public")?.ok ?? false,
    provider: cfg.provider,
    label: describeStorage(cfg),
    ms: Date.now() - started,
    steps,
    sampleUrl: publicUrl,
  };
}

/**
 * Try a storage. With `input` ({ provider, values }) it tries THOSE details — nothing is saved or switched on; without it,
 * the storage that is saved and in use.
 */
export async function testStorage(input) {
  if (input?.provider) {
    const { cfg, missing } = await configFromInput(input);
    if (missing.length) throw new HttpError(400, `Fill in ${missing.join(", ")} first.`);
    return probe(cfg);
  }
  const cfg = await activeConfig();
  const missing = (STORAGE_REQUIRED_FIELDS[cfg.provider] ?? []).filter((k) => !cfg[k]);
  if (missing.length) throw new HttpError(400, `Storage isn't fully set up — missing ${missing.map(labelOf).join(", ")}.`);
  return probe(cfg);
}

/* --------------------------------------------------------------------- usage */

const MAX_OBJECTS = 300_000;
const DAY = 86_400_000;
const PLATFORM = "platform";
const stat = () => ({ files: 0, bytes: 0 });
const add = (s, size) => {
  s.files += 1;
  s.bytes += size;
};

/** "brand/outlet/kind/file" → { brandId, outletId, kind }, or null for a file that doesn't follow the shape */
export function partsOfKey(key) {
  const p = String(key).split("/");
  return p.length >= 4 && p[0] ? { brandId: p[0], outletId: p[1], kind: p[2] } : null;
}

/** Every file of a storage as a Map(key → { size, modifiedAt }), and whether the listing was cut short. */
export async function listAll(cfg, { prefix = "" } = {}) {
  const adapter = providerFor(cfg.provider);
  const files = new Map();
  let partial = false;
  for await (const f of adapter.list(cfg, { prefix })) {
    if (files.size >= MAX_OBJECTS) {
      partial = true;
      break;
    }
    if (f.key.startsWith("platform/_probe/") || f.key.startsWith("platform/.probe/")) continue; // a test file that was left behind
    files.set(f.key, { size: f.size, modifiedAt: f.modifiedAt });
  }
  return { files, partial };
}

/** The places pictures could be right now: this server's disk, and the storage in use when that is a bucket. */
export async function storageLocations() {
  const active = await activeConfig();
  const local = { id: "local", label: "This server's disk", cfg: { provider: "local", uploadsRoot: UPLOADS_ROOT, publicApiUrl, brandId: PROBE_CTX.brandId, outletId: PROBE_CTX.outletId } };
  if (active.provider === "local") return { active, locations: [local] };
  const missing = (STORAGE_REQUIRED_FIELDS[active.provider] ?? []).filter((k) => !active[k]);
  return { active, locations: missing.length ? [local] : [local, { id: "cloud", label: describeStorage(active), cfg: active, inUse: true }] };
}

let lastScan = null;
export const lastStorageScan = () => lastScan;

/**
 * Count what is stored where — per place, per store, per outlet and per kind of file — and check it against what the stores
 * actually use: pictures that are used but nowhere to be found (broken on the storefront), and files nothing refers to any
 * more (older than a day, so a photo uploaded a moment ago and not yet saved isn't counted). Reads everything; nothing changes.
 */
export async function scanStorage() {
  const started = Date.now();
  const { active, locations } = await storageLocations();
  const listed = [];
  for (const loc of locations) listed.push({ ...loc, ...(await listAll(loc.cfg)) });

  const referenced = await referencedKeys();
  const [brands, outlets] = await Promise.all([BrandModel.find({}).select("name").lean(), OutletModel.find({}, null, { allowGlobalQuery: true }).select("name brandId").lean()]);
  const brandName = new Map(brands.map((b) => [String(b._id), b.name]));
  const outletName = new Map(outlets.map((o) => [String(o._id), o.name]));

  const stores = new Map();
  const kinds = new Map();
  const where = {};
  const unused = {};
  const other = {};
  const present = new Set();
  const cutoff = Date.now() - DAY;

  for (const loc of listed) {
    where[loc.id] = { id: loc.id, label: loc.label, provider: loc.cfg.provider, inUse: Boolean(loc.inUse) || (loc.id === "local" && active.provider === "local"), ...stat(), partial: loc.partial };
    unused[loc.id] = stat();
    other[loc.id] = stat();
    for (const [key, f] of loc.files) {
      add(where[loc.id], f.size);
      present.add(key);
      const parts = partsOfKey(key);
      if (!parts) {
        add(other[loc.id], f.size);
        continue;
      }
      const store = stores.get(parts.brandId) ?? { id: parts.brandId, name: parts.brandId === PLATFORM ? "Marketing website & platform" : (brandName.get(parts.brandId) ?? "A store that no longer exists"), by: {}, outlets: new Map() };
      store.by[loc.id] ??= stat();
      add(store.by[loc.id], f.size);
      const outlet = store.outlets.get(parts.outletId) ?? { id: parts.outletId, name: parts.outletId === "store" ? "Store-wide files" : (outletName.get(parts.outletId) ?? "An outlet that no longer exists"), by: {} };
      outlet.by[loc.id] ??= stat();
      add(outlet.by[loc.id], f.size);
      store.outlets.set(parts.outletId, outlet);
      stores.set(parts.brandId, store);
      const kind = kinds.get(parts.kind) ?? { kind: parts.kind, by: {} };
      kind.by[loc.id] ??= stat();
      add(kind.by[loc.id], f.size);
      kinds.set(parts.kind, kind);
      if (!referenced.has(key) && f.modifiedAt && new Date(f.modifiedAt).getTime() < cutoff) add(unused[loc.id], f.size);
    }
  }

  const broken = [...referenced].filter((k) => !present.has(k));
  const local = listed.find((l) => l.id === "local");
  const cloud = listed.find((l) => l.id === "cloud");
  const waiting = stat(); // on this server's disk but not yet in the storage in use
  if (local && cloud) for (const [key, f] of local.files) if (!cloud.files.has(key)) add(waiting, f.size);

  const sortStores = (a, b) => {
    const total = (x) => Object.values(x.by).reduce((n, s) => n + s.bytes, 0);
    return total(b) - total(a) || a.name.localeCompare(b.name);
  };
  lastScan = {
    scannedAt: new Date().toISOString(),
    tookMs: Date.now() - started,
    active: { provider: active.provider, label: describeStorage(active) },
    locations: Object.values(where),
    total: Object.values(where).reduce((a, w) => ({ files: a.files + w.files, bytes: a.bytes + w.bytes }), stat()),
    stores: [...stores.values()]
      .map((s) => ({ ...s, outlets: [...s.outlets.values()].sort(sortStores) }))
      .sort(sortStores),
    kinds: [...kinds.values()].sort(sortStores),
    health: {
      referenced: referenced.size,
      broken: broken.length,
      brokenExamples: broken.slice(0, 15).map((key) => ({ key, store: brandName.get(partsOfKey(key)?.brandId) ?? partsOfKey(key)?.brandId ?? "" })),
      unused,
      other,
      waiting: local && cloud ? waiting : null,
    },
  };
  return lastScan;
}
