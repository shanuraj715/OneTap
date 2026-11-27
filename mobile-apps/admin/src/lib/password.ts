import { getRandomBytes } from "expo-crypto";

const LETTERS = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ"; // no look-alikes (l, I, O)
const DIGITS = "23456789";

/** A password a person can read out or send: 14 characters, letters and digits only, made from the phone's secure random numbers. */
export function makePassword(random: (n: number) => Uint8Array = getRandomBytes): string {
  const pick = (set: string, n: number) => Array.from(random(n), (b) => set[b % set.length]).join("");
  const chars = (pick(LETTERS, 11) + pick(DIGITS, 3)).split("");
  const swap = random(chars.length);
  for (let i = chars.length - 1; i > 0; i--) { const j = swap[i]! % (i + 1); [chars[i], chars[j]] = [chars[j]!, chars[i]!]; }
  return chars.join("");
}
/** At least 10 characters with a letter and a digit (the server's rule for team accounts). */
export const strongEnough = (p: string) => p.length >= 10 && /[A-Za-z]/.test(p) && /\d/.test(p);
