import crypto from "node:crypto";
import { promisify } from "node:util";
import { env } from "../../env.js";

const scrypt = promisify(crypto.scrypt);

/** The rider app signs in with a phone number and a 4–6 digit PIN the manager sets in the dashboard. */
export const PIN_RE = /^\d{4,6}$/;

/** The last 10 digits of whatever was typed ("+91 98765 43210" → "9876543210"); "" when there are fewer than 10. */
export const loginPhoneOf = (phone) => {
  const digits = String(phone ?? "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : "";
};

/** A salted scrypt hash — the PIN itself is never stored. */
export async function hashPin(pin) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(String(pin), salt, 32);
  return `s1$${salt.toString("hex")}$${key.toString("hex")}`;
}

const DUMMY = `s1$${"00".repeat(16)}$${"00".repeat(32)}`;
/** Constant-time check. With no stored hash it still does the same work, so a wrong phone number takes as long as a wrong PIN. */
export async function checkPin(pin, stored) {
  const [version, saltHex, keyHex] = String(stored || DUMMY).split("$");
  if (version !== "s1" || !saltHex || !keyHex) return false;
  const key = await scrypt(String(pin), Buffer.from(saltHex, "hex"), 32);
  const expected = Buffer.from(keyHex, "hex");
  return Boolean(stored) && expected.length === key.length && crypto.timingSafeEqual(expected, key);
}

/* ------------------------------------------------------------------ the sign-in token */

const TOKEN_DAYS = 14;
const secret = () => crypto.createHash("sha256").update(`rasoipulse-rider-app:${env.ENCRYPTION_KEY}`).digest();
const sign = (body) => crypto.createHmac("sha256", secret()).update(body).digest("base64url");

/**
 * A rider's sign-in: `rdr1.<payload>.<signature>`, signed by the server and carrying who the rider is, which store and outlet, the
 * rider's `pinVersion` and an expiry. There is no sessions table: setting the PIN again or switching the login off raises
 * `pinVersion`, which makes every earlier token invalid on its next use.
 */
export function signRiderToken({ riderId, brandId, outletId, pinVersion }) {
  const expiresAt = new Date(Date.now() + TOKEN_DAYS * 86_400_000);
  const payload = Buffer.from(JSON.stringify({ r: riderId, b: brandId, o: outletId, v: pinVersion, e: expiresAt.getTime() })).toString("base64url");
  return { token: `rdr1.${payload}.${sign(payload)}`, expiresAt };
}

/** → { riderId, brandId, outletId, pinVersion } or null (not ours, tampered with, or expired). */
export function readRiderToken(token) {
  const [tag, payload, signature] = String(token ?? "").split(".");
  if (tag !== "rdr1" || !payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  try {
    const t = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!t.r || !t.b || !t.o || typeof t.e !== "number" || t.e < Date.now()) return null;
    return { riderId: String(t.r), brandId: String(t.b), outletId: String(t.o), pinVersion: Number(t.v) || 0 };
  } catch {
    return null;
  }
}
