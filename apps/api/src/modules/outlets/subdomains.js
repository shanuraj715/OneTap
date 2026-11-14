import dns from "node:dns/promises";
import https from "node:https";
import { randomBytes } from "node:crypto";
import { hasFeature } from "@onetap/config-schema";
import { HttpError } from "../../middleware/error.js";
import { platformSettings, storePlan } from "../platform/plan.service.js";
import { assertHostnamesFree, isPublicHost, normalizeHostname, setStoreDomains, storeDomains } from "./domains.js";

/**
 * A store's TablePe address — acme.<base domain> — and who may have their own
 * domain instead.
 *
 * There is nothing to install per store. The storefront already finds a
 * store from the address it was opened on (see domains.js), so a subdomain is
 * just one more address on the store's list. The server side is set up once,
 * for every store: a wildcard DNS record (*.base), one wildcard certificate
 * and one nginx block that accepts any subdomain (deploy/wildcard-subdomains.md).
 * From then on, creating, renaming and removing a store's address is a database
 * change made from the platform console.
 *
 * An own domain (dominos.com) needs the restaurant's DNS and a certificate of
 * its own, so it is a plan feature (`customDomain`): without it a store gets a
 * TablePe address only.
 */

/** Names that would look official or collide with TablePe's own addresses. */
const RESERVED_LABELS = new Set([
  "www", "api", "admin", "app", "apps", "mail", "email", "smtp", "imap", "pop", "ftp", "sftp", "ssh", "ns", "ns1", "ns2", "dns",
  "cdn", "static", "assets", "img", "images", "media", "files", "status", "support", "help", "docs", "blog", "dashboard", "console",
  "portal", "login", "signin", "signup", "auth", "account", "accounts", "billing", "pay", "payments", "checkout", "store", "stores",
  "shop", "test", "demo", "dev", "staging", "stage", "prod", "root", "localhost", "tablepe", "onetap", "food", "website", "web",
  "preview", "internal", "secure", "security", "abuse", "postmaster", "webmaster", "hostmaster", "noreply", "no-reply",
]);

const LABEL_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;

/** "Acme Momos" is not a label — this accepts only what can be a DNS name, and says why not. */
export function normalizeLabel(raw) {
  const label = String(raw ?? "").trim().toLowerCase();
  if (label.length < 3) throw new HttpError(400, "The address needs at least 3 characters.");
  if (label.length > 40) throw new HttpError(400, "The address can be at most 40 characters.");
  if (!LABEL_RE.test(label)) throw new HttpError(400, "Use only lowercase letters, numbers and hyphens, and don't start or end with a hyphen.");
  if (label.startsWith("xn--") || label.includes("--")) throw new HttpError(400, "Two hyphens in a row aren't allowed.");
  if (RESERVED_LABELS.has(label)) throw new HttpError(400, `"${label}" is kept for TablePe itself. Choose another name.`);
  return label;
}

/** The base domain stores' addresses live under ("tablepe.in"), or "" for none. */
export function normalizeBase(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return "";
  const host = normalizeHostname(text);
  if (!host.includes(".") || host.includes(":")) throw new HttpError(400, `"${text}" isn't a domain you can put stores under. Use something like tablepe.in.`);
  return host;
}

/** Exactly one label below the base — what a wildcard certificate (*.base) covers. */
export const isUnderBase = (host, base) => Boolean(base) && host.endsWith(`.${base}`) && !host.slice(0, -(base.length + 1)).includes(".");

/** The store's TablePe address among its domains, if it has one. */
export const subdomainOf = (hostnames, base) => hostnames.find((h) => isUnderBase(h, base)) ?? null;
const labelOf = (host, base) => host.slice(0, -(base.length + 1));

async function base() {
  return (await platformSettings()).subdomainBase;
}

/** What the console shows about a store's TablePe address. */
export async function subdomainInfo(brandId) {
  const b = await base();
  const { hostnames } = await storeDomains(brandId);
  const host = b ? subdomainOf(hostnames, b) : null;
  return { base: b, host, label: host ? labelOf(host, b) : "" };
}

/** Is `rawLabel` free for this store, and what would its address be? For live feedback while typing. */
export async function checkLabel(rawLabel, brandId) {
  const b = await base();
  if (!b) return { available: false, reason: "Set the base domain in Platform settings first." };
  let label;
  try {
    label = normalizeLabel(rawLabel);
  } catch (err) {
    return { available: false, reason: err.message };
  }
  const host = `${label}.${b}`;
  try {
    await assertHostnamesFree([host], brandId ?? "");
  } catch {
    return { available: false, host, reason: `${host} is already used by another store.` };
  }
  return { available: true, host };
}

/** Give a store its TablePe address, or change it. */
export async function setStoreSubdomain(brandId, rawLabel) {
  const b = await base();
  if (!b) throw new HttpError(400, "Set the base domain in Platform settings before creating store addresses.");
  const label = normalizeLabel(rawLabel);
  const host = `${label}.${b}`;
  const current = await storeDomains(brandId);
  const old = subdomainOf(current.hostnames, b);
  if (old === host) return current;
  await assertHostnamesFree([host], brandId);

  const hostnames = old ? current.hostnames.map((h) => (h === old ? host : h)) : [host, ...current.hostnames];
  // Table QR codes follow the main address. Keep a store's own domain as the main one; otherwise this becomes it.
  const primary = !current.primary || current.primary === old || !isPublicHost(current.primary) ? host : current.primary;
  return setStoreDomains(brandId, { hostnames, primary });
}

/** Take the TablePe address away. The store's other domains, if any, keep working. */
export async function removeStoreSubdomain(brandId) {
  const b = await base();
  const current = await storeDomains(brandId);
  const old = b ? subdomainOf(current.hostnames, b) : null;
  if (!old) throw new HttpError(404, "This store has no TablePe address.");
  const hostnames = current.hostnames.filter((h) => h !== old);
  const primary = current.primary === old ? hostnames.find(isPublicHost) ?? hostnames[0] ?? "" : current.primary;
  return setStoreDomains(brandId, { hostnames, primary });
}

/* --------------------------------------------------------- own domains */

/**
 * Own domains need the plan's "Own domain name" feature. Only domains being
 * ADDED are checked, so a store that already has one keeps it — and can still
 * change its main domain — even if its plan later loses the feature.
 */
export function assertOwnDomainsAllowed(hostnames, { entitlements, base: b, current = [], planName = "" }) {
  const added = hostnames.filter((h) => !current.includes(h) && isPublicHost(h) && !isUnderBase(h, b));
  if (!added.length || hasFeature(entitlements, "customDomain")) return;
  throw new HttpError(
    403,
    `${planName ? `The ${planName} plan doesn't` : "This plan doesn't"} include an own domain name, so ${added[0]} can't be added. ` +
      "Give the store a TablePe address instead, or unlock “Own domain name” for this store on its Features tab.",
  );
}

/** The same check for a store that exists: uses its plan, its overrides and the domains it has now. */
export async function assertStoreMayAddDomains(brandId, hostnames) {
  const [{ entitlements, plan }, b, current] = await Promise.all([storePlan(brandId), base(), storeDomains(brandId)]);
  assertOwnDomainsAllowed(hostnames, { entitlements, base: b, current: current.hostnames, planName: plan?.name });
}

/* ---------------------------------------------------------- live check */

/**
 * Does an address actually work from the outside — DNS found, certificate
 * valid for it, and something answering? Looks the way a visitor's browser
 * would. `host` always comes from a stored store address, never from the
 * request, so this can't be pointed at anything else.
 */
export async function hostStatus(host, { port = 443 } = {}) {
  const out = { host, dns: false, addresses: [], tls: null, httpStatus: null, error: "" };
  try {
    const found = await dns.lookup(host, { all: true });
    out.addresses = [...new Set(found.map((a) => a.address))];
    out.dns = out.addresses.length > 0;
  } catch (err) {
    out.error = err.code ?? "DNS";
  }
  if (!out.dns) return { ...out, state: "no-dns" };

  await new Promise((resolve) => {
    const req = https.request({ host, port, method: "HEAD", path: "/", servername: host, timeout: 6000 }, (res) => {
      out.tls = true;
      out.httpStatus = res.statusCode ?? null;
      res.resume();
      resolve();
    });
    req.on("timeout", () => req.destroy(Object.assign(new Error("timed out"), { code: "ETIMEDOUT" })));
    req.on("error", (err) => {
      // a certificate that doesn't fit this name is a different problem from nothing answering at all
      out.tls = /CERT|SELF_SIGNED|ERR_TLS|HOSTNAME_MISMATCH|UNABLE_TO_VERIFY/i.test(`${err.code} ${err.message}`) ? false : null;
      out.error = err.code ?? err.message;
      resolve();
    });
    req.end();
  });

  const state = out.tls === false ? "bad-cert" : out.tls === null ? "no-https" : out.httpStatus >= 500 ? "error" : "live";
  return { ...out, state };
}

/** A made-up address under the base domain: if it gets as far as the storefront, DNS + certificate + nginx are all set up. */
export async function probeBase() {
  const b = await base();
  if (!b) throw new HttpError(400, "Set the base domain first.");
  return hostStatus(`check-${randomBytes(4).toString("hex")}.${b}`);
}
