import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { LoginGuardModel } from "@onetap/db";
import { env } from "../../env.js";
import { HttpError } from "../../middleware/error.js";

/**
 * Brute-force protection for sign-in.
 *
 *  1. A flood limiter (express-rate-limit): at most LOGIN_FLOOD_PER_MINUTE sign-in requests a minute per address,
 *     whatever they are — stops a script hammering the endpoint before it even gets to guess.
 *  2. An escalating block, kept in the database (so it survives restarts and is shared by every API process): a
 *     few failures in a window block the address for a while; every further block lasts longer.
 *
 * Two separate counters, so a customer mistyping codes can't lock the team out of the dashboard and vice versa:
 * "staff" (the dashboards) and "customer" (a diner's one-time code).
 */

const DEFAULT_STEPS = [300, 900, 3600, 21600, 86400];
const parsed = env.LOGIN_BLOCK_STEPS_SECONDS.split(",").map((n) => Number(n.trim())).filter((n) => n > 0);
export const BLOCK_STEPS = parsed.length ? parsed : DEFAULT_STEPS;
export const guardOn = env.LOGIN_GUARD === "on";
export const GUARD_SETTINGS = {
  maxFailures: env.LOGIN_MAX_FAILURES,
  windowSeconds: env.LOGIN_FAILURE_WINDOW_SECONDS,
  steps: BLOCK_STEPS,
  forgetSeconds: env.LOGIN_STRIKE_FORGET_SECONDS,
  floodPerMinute: env.LOGIN_FLOOD_PER_MINUTE,
};

/** An address that belongs to our own network (loopback, private ranges) — i.e. a proxy of ours, not a visitor. */
export function isInternal(ip) {
  const a = String(ip ?? "").replace(/^::ffff:/i, "").toLowerCase();
  if (isIP(a) === 4) {
    const [p, q] = a.split(".").map(Number);
    return p === 10 || p === 127 || p === 0 || (p === 169 && q === 254) || (p === 172 && q >= 16 && q <= 31) || (p === 192 && q === 168) || (p === 100 && q >= 64 && q <= 127);
  }
  return a === "::1" || a === "::" || /^f[cd]/.test(a) || /^fe[89ab]/.test(a);
}

/**
 * The visitor's real address. Customers reach the API through the storefront's own server and nginx, so the
 * connection itself comes from OUR machine — treating that as "the visitor" would put every customer behind one
 * address, and one attacker would block them all. So: take the address chain (X-Forwarded-For, then the connection),
 * and read it from the right, skipping hops that are our own network; the first outside address is the visitor.
 * Whatever a visitor writes in the header only ever sits to the LEFT of that, so it can't be used to hide.
 */
export function callerIp(req) {
  const chain = String(req.headers["x-forwarded-for"] ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  chain.push(req.socket?.remoteAddress ?? req.ip ?? "unknown");
  for (let i = chain.length - 1; i >= 0; i--) if (!isInternal(chain[i])) return chain[i];
  return chain[chain.length - 1]; // everything is internal (a laptop): the connection itself
}

/** The caller's address as the guard keeps it (IPv6 grouped by /64 — one customer of an ISP owns a whole /64). */
export const addressOf = (req) => ipKeyGenerator(callerIp(req), 64);
const keyOf = (scope, addr) => `${scope}|${addr}`;

/** "5 minutes", "1 hour", "45 seconds" */
export function humanSeconds(total) {
  const s = Math.max(1, Math.round(total));
  if (s < 90) return `${s} second${s === 1 ? "" : "s"}`;
  const m = Math.round(s / 60);
  if (m < 90) return `${m} minute${m === 1 ? "" : "s"}`;
  const h = Math.round(s / 3600);
  if (h < 48) return `${h} hour${h === 1 ? "" : "s"}`;
  const d = Math.round(s / 86400);
  return `${d} day${d === 1 ? "" : "s"}`;
}

/** What the caller is told when blocked. */
export function blockedError(info) {
  return new HttpError(429, `Too many failed attempts. Try again in ${humanSeconds(info.retryAfterSec)}.`, {
    code: "ip_blocked",
    retryAfterSec: info.retryAfterSec,
    blockedUntil: info.blockedUntil,
  });
}

/** Is this address blocked right now, and for how long? */
export const blockInfo = (req, scope) => blockInfoFor(keyOf(scope, addressOf(req)), GUARD_SETTINGS);

async function blockInfoFor(key, settings) {
  if (!guardOn) return { blocked: false };
  const row = await LoginGuardModel.findOne({ key }).lean();
  const left = row?.blockedUntil ? (new Date(row.blockedUntil).getTime() - Date.now()) / 1000 : 0;
  if (left > 0) return { blocked: true, retryAfterSec: Math.ceil(left), blockedUntil: row.blockedUntil };
  const failuresLeft = row && row.windowStart && Date.now() - new Date(row.windowStart).getTime() < settings.windowSeconds * 1000 ? Math.max(0, settings.maxFailures - row.failures) : settings.maxFailures;
  return { blocked: false, attemptsLeft: failuresLeft };
}

/** Throws the 429 when the address is blocked — call before even looking at the credentials. */
export async function assertNotBlocked(req, scope) {
  const info = await blockInfo(req, scope);
  if (info.blocked) throw blockedError(info);
}

/**
 * Count one failed attempt. Returns { blocked, retryAfterSec?, attemptsLeft? } — `blocked` is true when THIS failure
 * tipped the address over (the caller should answer with the block, not "wrong password").
 */
export const recordFailure = (req, scope) => recordFailureFor(keyOf(scope, addressOf(req)), addressOf(req), scope, GUARD_SETTINGS);

async function recordFailureFor(key, addr, scope, settings) {
  if (!guardOn) return { blocked: false };
  const now = new Date();
  const { maxFailures, windowSeconds, steps, forgetSeconds } = settings;

  // a window that has run out starts again from zero
  await LoginGuardModel.updateOne({ key, windowStart: { $lt: new Date(now.getTime() - windowSeconds * 1000) }, $or: [{ blockedUntil: null }, { blockedUntil: { $lte: now } }] }, { $set: { failures: 0, windowStart: now } });
  const row = await LoginGuardModel.findOneAndUpdate(
    { key },
    { $inc: { failures: 1 }, $set: { lastAttemptAt: now, ip: addr, scope }, $setOnInsert: { windowStart: now, strikes: 0 } },
    { upsert: true, new: true },
  ).lean();

  const alreadyBlocked = row.blockedUntil && new Date(row.blockedUntil) > now;
  if (alreadyBlocked) return { blocked: true, retryAfterSec: Math.ceil((new Date(row.blockedUntil) - now) / 1000), blockedUntil: row.blockedUntil };

  if (row.failures >= maxFailures) {
    // a long quiet spell since the last block wipes the climb: back to the shortest block
    const quiet = row.lastBlockAt && now - new Date(row.lastBlockAt) > forgetSeconds * 1000;
    const strikes = (quiet ? 0 : row.strikes ?? 0) + 1;
    const seconds = steps[Math.min(strikes - 1, steps.length - 1)];
    const blockedUntil = new Date(now.getTime() + seconds * 1000);
    const expireAt = new Date(blockedUntil.getTime() + Math.max(forgetSeconds, windowSeconds) * 1000);
    const won = await LoginGuardModel.updateOne(
      { key, failures: { $gte: maxFailures }, $or: [{ blockedUntil: null }, { blockedUntil: { $lte: now } }] },
      { $set: { blockedUntil, lastBlockAt: now, strikes, failures: 0, windowStart: now, expireAt } },
    );
    if (won.modifiedCount) return { blocked: true, retryAfterSec: seconds, blockedUntil, strikes };
    return blockInfoFor(key, settings); // another request tipped it at the same moment
  }

  await LoginGuardModel.updateOne({ key }, { $set: { expireAt: new Date(now.getTime() + Math.max(forgetSeconds, windowSeconds) * 1000) } });
  return { blocked: false, attemptsLeft: maxFailures - row.failures };
}

/** Turn a failed attempt into the right answer: the block if this one tipped it over, otherwise the original error with "attempts left". */
export async function failed(req, scope, err) {
  const r = await recordFailure(req, scope);
  if (r.blocked) throw blockedError(r);
  if (r.attemptsLeft !== undefined && err instanceof HttpError) err.details = { ...(err.details ?? {}), attemptsLeft: r.attemptsLeft };
  throw err;
}

/* ------------------------------------------------------ one account, from any address */

/**
 * The per-address block above stops one machine guessing. A botnet guessing ONE account's password from hundreds of
 * addresses gets one or two tries from each and walks past it — so the same counting is also kept per account
 * (the submitted email, whether or not it exists, so the answer reveals nothing): 10 wrong passwords in 15 minutes
 * pause that account's sign-in for 1 minute, then 5, 15 and 60. The pauses are short on purpose — someone can make
 * an owner wait a few minutes by typing their email wrongly, but not lock them out for a day.
 */
export const ACCOUNT_GUARD = { maxFailures: 10, windowSeconds: 900, steps: [60, 300, 900, 3600], forgetSeconds: 86400 };

const emailKey = (email) => keyOf("staff-account", createHash("sha256").update(String(email).trim().toLowerCase()).digest("hex").slice(0, 24));
/** "o•••@acme.test" — enough for the console to say which account, without printing the whole address */
const maskEmail = (email) => String(email).trim().toLowerCase().replace(/^(.).*?(@.*)?$/, (_m, a, b) => `${a}•••${b ?? ""}`);

export function accountBlockedError(info) {
  return new HttpError(429, `Too many failed attempts for this account. Try again in ${humanSeconds(info.retryAfterSec)}.`, {
    code: "account_blocked",
    retryAfterSec: info.retryAfterSec,
    blockedUntil: info.blockedUntil,
  });
}

/** Throws the 429 when this account's sign-in is paused — call before looking at the password. */
export async function assertAccountNotBlocked(email) {
  const info = await blockInfoFor(emailKey(email), ACCOUNT_GUARD);
  if (info.blocked) throw accountBlockedError(info);
}

/** Count one wrong password against the account. Returns { blocked, retryAfterSec? } — true when THIS one tipped it over. */
export const recordAccountFailure = (email) => recordFailureFor(emailKey(email), maskEmail(email), "staff-account", ACCOUNT_GUARD);

/** A right password clears the account's count. */
export async function clearAccountFailures(email) {
  if (guardOn) await LoginGuardModel.deleteOne({ key: emailKey(email) });
}

/** express-rate-limit, per address, for ANY request to a sign-in endpoint (right or wrong). */
export const floodLimiter = (name) => {
  const mw = rateLimit({
    windowMs: 60_000,
    limit: GUARD_SETTINGS.floodPerMinute,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skip: () => !guardOn,
    keyGenerator: (req) => `${name}|${addressOf(req)}`,
    // express-rate-limit complains when the key doesn't go through ipKeyGenerator; ours does (addressOf)
    validate: { keyGeneratorIpFallback: false },
    handler: (req, res, next, options) => {
      const retry = Number(res.getHeader("Retry-After")) || Math.ceil(options.windowMs / 1000);
      next(new HttpError(429, `Too many sign-in requests. Try again in ${humanSeconds(retry)}.`, { code: "rate_limited", retryAfterSec: retry, policy: `${name}-flood` }));
    },
  });
  mw.policy = `${name}-flood`; // listed in the route inventory as "login-flood" / "otp-flood"
  return mw;
};

/* ---------------------------------------------------- what the platform console shows */

/** Addresses currently blocked, or being watched after failed attempts. */
export async function listBlocks() {
  const now = new Date();
  const rows = await LoginGuardModel.find({ $or: [{ blockedUntil: { $gt: now } }, { failures: { $gt: 0 } }, { strikes: { $gt: 0 } }] }).sort({ blockedUntil: -1, lastAttemptAt: -1 }).limit(200).lean();
  return rows.map((r) => ({
    id: String(r._id),
    ip: r.ip,
    scope: r.scope,
    blocked: Boolean(r.blockedUntil && new Date(r.blockedUntil) > now),
    blockedUntil: r.blockedUntil ?? null,
    failures: r.failures ?? 0,
    strikes: r.strikes ?? 0,
    lastAttemptAt: r.lastAttemptAt ?? null,
  }));
}
export async function clearBlock(id) {
  await LoginGuardModel.deleteOne({ _id: id });
}
export async function clearAllBlocks() {
  await LoginGuardModel.deleteMany({});
}
