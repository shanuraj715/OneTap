import { getRandomBytes } from "expo-crypto";

// no 0/O, 1/l/I: easy to read out over the phone
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

/** A password for a new person: `length` random characters (at least 8, which is what the server asks for) with no look-alike characters. */
export function generatePassword(length = 10): string {
  const n = Math.max(8, length);
  const limit = 256 - (256 % ALPHABET.length); // throw away bytes that would make some characters likelier than others
  let out = "";
  while (out.length < n) {
    for (const b of getRandomBytes(n * 2)) {
      if (b < limit && out.length < n) out += ALPHABET[b % ALPHABET.length];
    }
  }
  return out;
}
