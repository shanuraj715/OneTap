import { OutletModel } from "@rasoipulse/db";
import { env, isProd } from "../../env.js";
import { HttpError } from "../../middleware/error.js";

/**
 * A store's domains — dominos.com, www.dominos.com — are where its storefront
 * is served. Every outlet of a store shares them (outlets are told apart by
 * the path, /laxmi-nagar). They're managed by the platform, and a domain can
 * belong to only one store: the storefront finds the store FROM the domain, so
 * a second store claiming it would take over the first one's customers.
 */

const DOMAIN_RE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$/;
// local development hosts ("localhost:3070", "127.0.0.1:3070") stay allowed
// (acme.localhost:3070 too — browsers open any *.localhost on this machine, which is how store addresses are tried out locally)
const LOCAL_RE = /^(?:(?:[a-z0-9-]+\.)*localhost|127\.0\.0\.1|\[::1\])(?::\d{2,5})?$/;

/** The domain stores' Rasoi Pulse addresses live under on THIS server ("rasoipulse.in", or "localhost:3070" in development), or "" for none. Validated at startup (env.js). */
export const configuredBase = () => env.STORE_SUBDOMAIN_BASE.trim().toLowerCase();

/** Is this one of the machine's own addresses (acme.localhost:3070) rather than something on the internet? */
export const isLocalHost = (host) => LOCAL_RE.test(host);

/** "https://WWW.Dominos.com/menu" → "www.dominos.com". Throws on anything that isn't a domain. */
export function normalizeHostname(raw) {
  const host = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .replace(/[/?#].*$/, "")
    .replace(/\.$/, "");
  if (!host) throw new HttpError(400, "Enter a domain, like dominos.com.");
  if (host.length > 253 || !(DOMAIN_RE.test(host) || LOCAL_RE.test(host))) {
    throw new HttpError(400, `"${String(raw).trim()}" isn't a valid domain. Use something like dominos.com.`);
  }
  return host;
}

export function normalizeHostnames(list) {
  return [...new Set((list ?? []).filter((h) => String(h ?? "").trim()).map(normalizeHostname))];
}

/** A real, public domain (not localhost, an IP, or a .test/.local name). */
export function isPublicHost(host) {
  if (!host || LOCAL_RE.test(host)) return false;
  if (/^\d+\.\d+\.\d+\.\d+(:\d+)?$/.test(host)) return false;
  if (/\.(test|local|localhost|internal|example|invalid)(:\d+)?$/.test(host)) return false;
  return host.includes(".");
}

/** Refuse a domain another store already uses. */
export async function assertHostnamesFree(hostnames, brandId) {
  if (!hostnames.length) return;
  const clash = await OutletModel.findOne(
    { hostnames: { $in: hostnames }, brandId: { $ne: String(brandId) } },
    { hostnames: 1 },
    { allowGlobalQuery: true },
  ).lean();
  if (clash) {
    const taken = hostnames.find((h) => clash.hostnames.includes(h));
    throw new HttpError(409, `${taken} is already used by another store.`);
  }
}

/**
 * The address a store's storefront is served on — what its table QR codes
 * point to. In production that's the store's own main domain (https); in
 * development, or for a store without a public domain yet, it's the platform
 * storefront from STOREFRONT_ORIGIN, as before.
 */
export function storefrontOriginFor(outlet, { production = isProd } = {}) {
  const host = outlet?.canonicalHostname || outlet?.hostnames?.find(isPublicHost) || "";
  if (production && isPublicHost(host)) return `https://${host}`;
  return env.STOREFRONT_ORIGIN.replace(/\/$/, "");
}

/** Set a store's domains (on every outlet) and its main one. */
export async function setStoreDomains(brandId, input) {
  const hostnames = normalizeHostnames(input.hostnames);
  const primary = input.primary ? normalizeHostname(input.primary) : hostnames[0] ?? "";
  if (primary && !hostnames.includes(primary)) throw new HttpError(400, "The main domain has to be one of the store's domains.");
  await assertHostnamesFree(hostnames, brandId);
  await OutletModel.updateMany({ brandId: String(brandId) }, { $set: { hostnames, canonicalHostname: primary } });
  return { hostnames, primary };
}

/** A store's domains as the platform console shows them (every outlet shares them). */
export async function storeDomains(brandId) {
  const outlet = await OutletModel.findOne({ brandId: String(brandId) }).sort({ createdAt: 1 }).lean();
  return { hostnames: outlet?.hostnames ?? [], primary: outlet?.canonicalHostname || outlet?.hostnames?.[0] || "" };
}
