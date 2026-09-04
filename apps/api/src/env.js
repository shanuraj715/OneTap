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
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";
export const corsOrigins = env.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean);
/** This API's public origin, for building absolute URLs to locally-stored uploads. */
export const publicApiUrl = (env.PUBLIC_API_URL || `http://localhost:${env.API_PORT}`).replace(/\/$/, "");
