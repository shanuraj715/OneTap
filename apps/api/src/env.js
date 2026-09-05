import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().positive().default(3072),
  MONGODB_URI: z.string().min(1).default("mongodb://127.0.0.1:27017/onetap_dev"),
  MONGODB_DB: z.string().min(1).default("onetap_dev"),
  CORS_ORIGINS: z.string().default("http://localhost:3070,http://localhost:3071"),
  /** encrypts payment gateway credentials at rest — MUST be changed for production */
  ENCRYPTION_KEY: z.string().min(16).default("dev-only-insecure-encryption-key-change-me"),
  /** allows the mock payment gateway; never true in production */
  ALLOW_MOCK_GATEWAY: z.coerce.boolean().default(true),
  /** this API's own public origin — used to build URLs for locally-stored uploads */
  PUBLIC_API_URL: z.string().default(""),
  /** where the local storage provider writes uploads (relative to the API's working dir) */
  UPLOADS_DIR: z.string().default(".uploads"),
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
export const corsOrigins = env.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean);
/** This API's public origin, for building absolute URLs to locally-stored uploads. */
export const publicApiUrl = (env.PUBLIC_API_URL || `http://localhost:${env.API_PORT}`).replace(/\/$/, "");
