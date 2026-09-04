import { createCipheriv, createDecipheriv, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { env, isProd } from "../env";
import { logger } from "../logger";

export const DEV_ENCRYPTION_KEY = "dev-only-insecure-encryption-key-change-me";

if (isProd && env.ENCRYPTION_KEY === DEV_ENCRYPTION_KEY) {
  logger.error("ENCRYPTION_KEY is still the development default. Set a real one before going live.");
  process.exit(1);
}

const key = scryptSync(env.ENCRYPTION_KEY, "onetap.payment-credentials.v1", 32);

/**
 * AES-256-GCM envelope for gateway secrets at rest. Format:
 *   v1.<iv>.<authTag>.<ciphertext>   (all base64url)
 */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ct.toString("base64url")].join(".");
}

export function decryptSecret(envelope: string): string {
  const [version, ivB64, tagB64, ctB64] = envelope.split(".");
  if (version !== "v1" || !ivB64 || !tagB64 || !ctB64) {
    throw new Error("Stored credential is not in a format this build understands");
  }
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64url"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, "base64url")), decipher.final()]).toString("utf8");
}

/** What the admin UI shows instead of a secret. */
export function maskSecret(value: string): string {
  if (value.length <= 8) return "••••••••";
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}

/** Constant-time string compare, for signature checks. */
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
