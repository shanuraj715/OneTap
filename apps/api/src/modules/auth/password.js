import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const KEYLEN = 64;

/** scrypt from node:crypto — no native dependency to build or keep patched. */
export async function hashPassword(password        )                  {
  const salt = randomBytes(16);
  const key = (await scryptAsync(password, salt, KEYLEN))          ;
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(password        , stored        )                   {
  const [scheme, saltHex, keyHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !keyHex) return false;

  const expected = Buffer.from(keyHex, "hex");
  const actual = (await scryptAsync(password, Buffer.from(saltHex, "hex"), KEYLEN))          ;
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
