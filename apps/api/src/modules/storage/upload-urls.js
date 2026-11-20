import { publicApiUrl } from "../../env.js";

/**
 * Pictures this server stores are kept in the database WITHOUT a domain: "/uploads/<key>". The domain is added when
 * the data goes out (publicApiUrl on this deployment), so moving to another domain, or running the same database
 * from a laptop and a server, never leaves pictures pointing at an address that no longer exists.
 *
 * An upload key always looks like  <brand>/<outlet>/<kind>/<uuid>.<ext>  (brand is "platform" for the website, outlet
 * is "store" for store-wide files). That shape is how we recognise OUR pictures wherever they were saved from —
 * "http://localhost:3072/uploads/…", an old domain, or already domain-free — and leave every other address alone
 * (a logo pasted from another site, a CDN link, a data: URL).
 */
const KEY = "[A-Za-z0-9_-]+/[A-Za-z0-9_-]+/[a-z0-9-]+/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.[a-z0-9]{1,8}";
/** a whole string value: an optional origin, then /uploads/<key> and nothing else */
const WHOLE = new RegExp(`^(?:https?://[^/\\s"\\\\]+)?(/uploads/${KEY})$`);
/** the same, found inside JSON text: only where the string value starts and ends exactly there */
const IN_JSON = new RegExp(`(?<=")(?:https?://[^"\\\\\\s/]+)?(/uploads/${KEY})(?=")`, "g");

/** "/uploads/<key>" if this is one of our own pictures (any domain, or none), else null */
export function uploadPathOf(value) {
  return typeof value === "string" ? (value.match(WHOLE)?.[1] ?? null) : null;
}

/** The form that is kept in the database: our own pictures lose their domain, anything else is returned unchanged. */
export function toStoredUrl(value) {
  return uploadPathOf(value) ?? value;
}

/** The address a browser can open: our own pictures get THIS deployment's domain, anything else is returned unchanged. */
export function toPublicUrl(value, base = publicApiUrl) {
  const path = uploadPathOf(value);
  return path ? `${base}${path}` : value;
}

/** The same thing for a whole JSON document (text) on its way out. */
export function rewriteJsonText(text, base = publicApiUrl) {
  return text.includes("/uploads/") ? text.replace(IN_JSON, (_all, path) => `${base}${path}`) : text;
}

/** Strip the domain from our own pictures anywhere inside a request body (changes the object in place). */
export function canonicalizeDeep(value, depth = 0) {
  if (!value || typeof value !== "object" || depth > 12 || Buffer.isBuffer(value)) return value;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const item = value[i];
      if (typeof item === "string") value[i] = toStoredUrl(item);
      else canonicalizeDeep(item, depth + 1);
    }
    return value;
  }
  for (const key of Object.keys(value)) {
    if (key === "__proto__" || key === "constructor") continue;
    const item = value[key];
    if (typeof item === "string") value[key] = toStoredUrl(item);
    else canonicalizeDeep(item, depth + 1);
  }
  return value;
}
