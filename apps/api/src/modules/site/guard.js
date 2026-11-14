import { createHash, createHmac, randomBytes } from "node:crypto";
import { env, isProd } from "../../env.js";
import { safeEqual } from "../../lib/crypto.js";
import { logger } from "../../logger.js";
import { HttpError } from "../../middleware/error.js";

/**
 * Keeping the enquiry form from being used to fill the database.
 *
 * Nothing on the internet can prove "this is a human" by itself — what works
 * is stacking cheap checks so that spamming costs far more than it is worth,
 * and capping the damage if someone pays that cost anyway:
 *
 *  1. A signed, single-use challenge the form fetches when it opens. The
 *     browser must solve a small proof-of-work (about a second of CPU) and
 *     wait a few seconds before sending. A script that just POSTs the form —
 *     which is what almost all spam does — has no token and is refused.
 *  2. A hidden field only bots fill in.
 *  3. Cloudflare Turnstile — a real "are you human" check — when its keys are
 *     set (TURNSTILE_SITE_KEY / TURNSTILE_SECRET_KEY). Off until you add them.
 *  4. Limits per visitor, per phone number and for the whole site, counted
 *     from what is actually stored (so they survive restarts), which bound how
 *     much can ever be written however many scripts are running.
 */

/* ------------------------------------------------------------- challenge */

/** Leading zero bits the proof-of-work needs: about 65,000 hashes, ~1–3s in a browser. */
export const CHALLENGE_BITS = 16;
/** Faster than this is a script, not someone filling in a form. */
const MIN_FILL_MS = 3_000;
const MAX_AGE_MS = 60 * 60 * 1000;

const sign = (id, iat, bits) => createHmac("sha256", env.ENCRYPTION_KEY).update(`lead-challenge|${id}|${iat}|${bits}`).digest("base64url");

/** A fresh challenge for the form to solve. Stateless: the signature is the proof it came from here. */
export function issueChallenge() {
  const id = randomBytes(12).toString("base64url");
  const iat = Date.now();
  return { token: `${id}.${iat}.${CHALLENGE_BITS}.${sign(id, iat, CHALLENGE_BITS)}`, bits: CHALLENGE_BITS, turnstileSiteKey: env.TURNSTILE_SITE_KEY || null };
}

function leadingZeroBits(buf) {
  let bits = 0;
  for (const byte of buf) {
    if (byte === 0) {
      bits += 8;
      continue;
    }
    return bits + Math.clz32(byte) - 24;
  }
  return bits;
}

/** The hash the browser has to grind on — keep in step with the form's solver. */
export const challengeHash = (token, nonce) => createHash("sha256").update(`${token}:${nonce}`).digest();

/**
 * Checks a solved challenge and returns its id (kept on the stored lead, so a
 * token can only ever be used once). Throws a plain-language 400 otherwise.
 */
export function checkChallenge(challenge) {
  const reload = () => new HttpError(400, "We couldn't confirm you're a person — please reload the page and try again.");
  const token = challenge?.token;
  const nonce = challenge?.nonce;
  if (typeof token !== "string" || typeof nonce !== "string" || token.length > 200 || !/^\d{1,12}$/.test(nonce)) throw reload();
  const [id, iatText, bitsText, sig] = token.split(".");
  const iat = Number(iatText);
  const bits = Number(bitsText);
  if (!id || !sig || !Number.isFinite(iat) || !Number.isInteger(bits) || !safeEqual(sig, sign(id, iat, bits))) throw reload();
  const age = Date.now() - iat;
  if (age > MAX_AGE_MS) throw new HttpError(400, "This form has been open a while — please send it again.");
  if (age < MIN_FILL_MS) throw new HttpError(400, "That was a bit quick — please check your details and send again.");
  if (leadingZeroBits(challengeHash(token, nonce)) < bits) throw reload();
  return id;
}

/* ------------------------------------------------------------ turnstile */

/**
 * Cloudflare Turnstile, when configured. A wrong answer is refused; if
 * Cloudflare itself can't be reached the check is skipped (and logged) rather
 * than turning every real visitor away — the other layers still apply.
 */
export async function checkTurnstile(token, ip) {
  if (!env.TURNSTILE_SECRET_KEY) return;
  const deny = () => new HttpError(400, "We couldn't confirm you're a person — please tick the box and send again.");
  if (typeof token !== "string" || !token || token.length > 4096) throw deny();
  let result;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token, ...(ip ? { remoteip: ip } : {}) }),
      signal: AbortSignal.timeout(5_000),
    });
    result = await res.json();
  } catch (err) {
    logger.warn({ err }, "Turnstile couldn't be reached — skipping that check");
    return;
  }
  if (result?.success !== true) throw deny();
}

/* ------------------------------------------------------------- visitors */

const DEFAULT_SECRET = "dev-only-website-revalidate-secret";
let warned = false;

/**
 * Who is really sending. Behind the website's own server the connection comes
 * from that server, so it passes the visitor's address along — and is only
 * believed when it proves it is the website with the secret it shares with
 * this API. Anyone else gets their connection's address, whatever headers
 * they send.
 */
export function clientIp(req) {
  const forwarded = req.get("x-client-ip");
  const secret = req.get("x-site-secret");
  if (forwarded && secret && safeEqual(secret, env.WEBSITE_REVALIDATE_SECRET)) {
    if (isProd && env.WEBSITE_REVALIDATE_SECRET === DEFAULT_SECRET) {
      // the default is public knowledge, so it proves nothing
      if (!warned) {
        warned = true;
        logger.warn("WEBSITE_REVALIDATE_SECRET is still the default — visitor addresses from the website can't be trusted. Set a real secret on the API and the website.");
      }
      return req.ip;
    }
    return forwarded.slice(0, 64);
  }
  return req.ip;
}

/** A stable, non-reversible stand-in for an address — enough to count repeats, nothing to leak. */
export const hashIp = (ip) => createHmac("sha256", env.ENCRYPTION_KEY).update(`lead-ip|${ip}`).digest("hex").slice(0, 24);

/** The last 10 digits, so "+91 98100 00000" and "9810000000" count as one number. */
export const phoneKey = (phone) => String(phone).replace(/\D/g, "").slice(-10);

/* ------------------------------------------------------- in-memory limits */

const hits = new Map();

/** True once `key` has been seen more than `max` times within `windowMs`. For cheap, pre-database checks. */
export function tooMany(key, max, windowMs) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  return recent.length > max;
}

/* ------------------------------------------------------------- content */

/** Spam is almost always links; a real enquiry has none or one. */
export function looksLikeSpam(lead) {
  const text = [lead.name, lead.businessName, lead.city, lead.message].join(" ");
  const links = (text.match(/https?:\/\/|www\.|\.(?:ru|xyz|top|click)\b/gi) ?? []).length;
  return links > 2 || /https?:\/\/|www\./i.test(lead.name);
}

/** Stored-lead limits: [per visitor, per phone number, whole site] for an hour and for a day. */
export const LIMITS = {
  hour: { ip: 4, phone: 3, site: 150 },
  day: { ip: 10, phone: 6, site: 600 },
};
