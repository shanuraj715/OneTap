import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().positive().default(3072),
  MONGODB_URI: z.string().min(1).default("mongodb://127.0.0.1:27017/rasoipulse_dev"),
  MONGODB_DB: z.string().min(1).default("rasoipulse_dev"),
  CORS_ORIGINS: z.string().default("http://localhost:3070,http://localhost:3071"),
  /** encrypts payment gateway credentials at rest — MUST be changed for production */
  ENCRYPTION_KEY: z.string().min(16).default("dev-only-insecure-encryption-key-change-me"),
  /** allows the mock payment gateway; never true in production */
  ALLOW_MOCK_GATEWAY: z.coerce.boolean().default(true),
  /** this API's own public origin — used to build URLs for locally-stored uploads */
  PUBLIC_API_URL: z.string().default(""),
  /** where Google's Gemini API lives — only ever changed by the tests, which point it at a stand-in server */
  GEMINI_API_BASE_URL: z.string().default("https://generativelanguage.googleapis.com"),
  /** where the local storage provider writes uploads (relative to the API's working dir) */
  UPLOADS_DIR: z.string().default(".uploads"),
  /** where the staff app's APK files are kept (never inside the code tree: a deploy must not delete them) */
  APP_RELEASES_DIR: z.string().default(".app-releases"),
  /** the biggest APK the console accepts (MB) */
  APP_RELEASE_MAX_MB: z.coerce.number().int().min(1).max(2000).default(300),
  /**
   * The public origin of the diner-facing storefront. Every table QR code is
   * built from this, so a wrong value here is not a degraded experience — it is
   * a stack of printed cards that open nothing.
   *
   * It went unset in production for a month, silently defaulting to localhost,
   * because it was read straight off `process.env` in the tables router instead
   * of going through this schema. Hence both the entry and the check below.
   */
  STOREFRONT_ORIGIN: z.string().url().default("http://localhost:3070"),
  /**
   * The Rasoi Pulse marketing website (apps/website). After any change to its
   * pages, settings or public plans, the API asks it to refresh right away;
   * the shared secret proves the request came from here. Without it, the
   * website still refreshes on its own every few minutes.
   */
  WEBSITE_URL: z.string().default("http://localhost:3073"),
  /**
   * Where this server itself reaches the website for that refresh, when it is on
   * the same machine (http://127.0.0.1:3073). Keeps the call off the public
   * internet — a hosting firewall or a Cloudflare hiccup can't break it. Blank
   * = use WEBSITE_URL.
   */
  WEBSITE_INTERNAL_URL: z.string().default(""),
  /**
   * "on" in exactly ONE running API: that process holds the linked WhatsApp numbers' connections and sends the
   * queued messages. Every other copy (local dev, a second server) sharing the same database must leave it off —
   * WhatsApp throws a number off when two copies connect with the same session.
   */
  WHATSAPP_WORKER: z.enum(["on", "off"]).default("off"),
  /**
   * Brute-force protection on every sign-in (dashboard + customer codes). A network address that fails
   * LOGIN_MAX_FAILURES times within LOGIN_FAILURE_WINDOW_SECONDS is blocked for the first of LOGIN_BLOCK_STEPS_SECONDS;
   * each further block moves one step up the list (and stays on the last), and the climb is forgotten after
   * LOGIN_STRIKE_FORGET_SECONDS without another block. LOGIN_FLOOD_PER_MINUTE caps sign-in requests of ANY kind.
   * "off" disables the whole thing (useful on a laptop where everyone is 127.0.0.1).
   */
  LOGIN_GUARD: z.enum(["on", "off"]).default("on"),
  LOGIN_MAX_FAILURES: z.coerce.number().int().min(1).default(5),
  LOGIN_FAILURE_WINDOW_SECONDS: z.coerce.number().int().min(1).default(900),
  LOGIN_BLOCK_STEPS_SECONDS: z.string().default("300,900,3600,21600,86400"),
  LOGIN_STRIKE_FORGET_SECONDS: z.coerce.number().int().min(1).default(86400),
  LOGIN_FLOOD_PER_MINUTE: z.coerce.number().int().min(1).default(30),
  /**
   * Request limits for the whole API (middleware/rate-limit.js; docs/api-rate-limiting.md lists what is limited and why).
   * "off" switches them all off. RATE_LIMIT_SCALE multiplies every limit: 0.5 is twice as strict, 2 twice as loose.
   * Requests from our own network (loopback, private ranges — the storefront's and website's servers, health checks)
   * are never limited by address; the sign-in guard above is separate and has its own switch.
   */
  RATE_LIMITS: z.enum(["on", "off"]).default("on"),
  RATE_LIMIT_SCALE: z.coerce.number().positive().default(1),
  /** the ONE process that sends queued SMS / WhatsApp Business API marketing messages (same rule as WHATSAPP_WORKER) */
  MARKETING_WORKER: z.enum(["on", "off"]).default("off"),
  /** Meta's WhatsApp Cloud API address. Only ever changed to point a test at a stand-in — leave it alone. */
  WHATSAPP_GRAPH_URL: z.string().url().default("https://graph.facebook.com"),
  WEBSITE_REVALIDATE_SECRET: z.string().default("dev-only-website-revalidate-secret"),
  /**
   * Cloudflare Turnstile for the website's enquiry form — a real "are you a
   * person" check on top of the built-in spam guard. Both blank = off. Create
   * a widget at dash.cloudflare.com → Turnstile; the site key is public, the
   * secret key stays here.
   */
  /**
   * The domain stores' Rasoi Pulse addresses live under — a store "acme" opens on
   * acme.<this>. A server setting rather than a database one because local
   * development and production share one database but not one domain:
   * rasoipulse.in in production, localhost:3070 on a developer's machine
   * (acme.localhost:3070 opens in a browser with no DNS at all). Empty = the
   * platform offers no Rasoi Pulse addresses.
   */
  STORE_SUBDOMAIN_BASE: z.string().default(""),
  TURNSTILE_SITE_KEY: z.string().default(""),
  TURNSTILE_SECRET_KEY: z.string().default(""),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";

/**
 * A localhost storefront origin in production is always a misconfiguration, and
 * it is one that hides: the API starts, every page works, and the only symptom
 * is that QR codes printed weeks later open nothing. Refusing to boot turns a
 * silent failure into a deploy-time one.
 */
if (isProd && /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|192\.168\.|10\.)/i.test(env.STOREFRONT_ORIGIN)) {
  console.error(
    `Invalid environment: STOREFRONT_ORIGIN is "${env.STOREFRONT_ORIGIN}" in production.\n` +
      "Every table QR code is built from this, so they would all point at an address only the server can reach.\n" +
      "Set STOREFRONT_ORIGIN to the public storefront URL (e.g. https://food.example.com) and restart.",
  );
  process.exit(1);
}
const subdomainBase = env.STORE_SUBDOMAIN_BASE.trim().toLowerCase();
const LOCAL_BASE = /^localhost(?::\d{2,5})?$/;
if (subdomainBase && !LOCAL_BASE.test(subdomainBase) && !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z][a-z0-9-]+$/.test(subdomainBase)) {
  console.error(`Invalid environment: STORE_SUBDOMAIN_BASE is "${env.STORE_SUBDOMAIN_BASE}", which isn't a domain. Use something like rasoipulse.in (no https://, no path).`);
  process.exit(1);
}
if (isProd && LOCAL_BASE.test(subdomainBase)) {
  console.error(
    `Invalid environment: STORE_SUBDOMAIN_BASE is "${env.STORE_SUBDOMAIN_BASE}" in production.\n` +
      "Every store's Rasoi Pulse address would be built on it, and none would open. Set it to your real domain (e.g. rasoipulse.in) and restart.",
  );
  process.exit(1);
}
export const corsOrigins = env.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean);
/** This API's public origin, for building absolute URLs to locally-stored uploads. */
export const publicApiUrl = (env.PUBLIC_API_URL || `http://localhost:${env.API_PORT}`).replace(/\/$/, "");
