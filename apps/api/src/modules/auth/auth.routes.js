import { Router } from "express";
import { z } from "zod";
import { isProd } from "../../env.js";
import { bearerToken, requireUser, SESSION_COOKIE } from "../../middleware/auth.js";
import { HttpError } from "../../middleware/error.js";
import { usesPolicy } from "../../middleware/rate-limit.js";
import { APP_CATALOG, APP_REQUIRED_PERMISSION } from "@rasoipulse/config-schema";
import { appOfRequest, assertAppCurrent } from "../app-releases/app-releases.service.js";
import { accountBlockedError, assertAccountNotBlocked, assertNotBlocked, blockInfo, clearAccountFailures, failed, floodLimiter, recordAccountFailure } from "../security/login-guard.js";
import { describeSessionUser, login, logout } from "./auth.service.js";

export const authRouter         = Router();

const credentials = z.object({
  email: z.string().min(3),
  password: z.string().min(1),
});

/**
 * Brute-force protection: a flood limiter in front, then — before the password is even looked at — a check that this
 * address isn't blocked; wrong guesses are counted and a run of them blocks the address for longer each time
 * (see modules/security/login-guard.js). A paused account (right password) is not a guess and isn't counted.
 */
const loginFlood = floodLimiter("login");

/** The sign-in page asks this first, so a blocked address is shown a notice instead of the form. */
authRouter.get("/guard", async (req, res) => {
  res.json(await blockInfo(req, "staff"));
});

/**
 * The one sign-in procedure, shared by the dashboard (`/login`, token in an httpOnly cookie) and the staff app (`/app-login`, token in the
 * answer). Both go through the SAME guards on purpose — the per-address flood limit, the per-address block after wrong passwords and the
 * per-account pause — and count wrong guesses in the same place, so guessing a password through the app can't get around what protects
 * the dashboard (and the other way round).
 */
async function signIn(req) {
  const body = credentials.parse(req.body);
  await assertNotBlocked(req, "staff");
  // …and the account itself, whichever address the guesses come from
  await assertAccountNotBlocked(body.email);
  let result;
  try {
    result = await login(body.email, body.password, {
      userAgent: req.header("user-agent") ?? undefined,
      ip: req.ip,
    });
  } catch (e) {
    if (e instanceof HttpError && e.status === 401) {
      const account = await recordAccountFailure(body.email);
      if (account.blocked) throw accountBlockedError(account);
      await failed(req, "staff", e);
    }
    throw e;
  }
  await clearAccountFailures(body.email);
  return result;
}

authRouter.post("/login", loginFlood, usesPolicy("login-account"), async (req, res) => {
  const result = await signIn(req);
  res.cookie(SESSION_COOKIE, result.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    expires: result.expiresAt,
    path: "/",
  });
  res.json({ user: result.user });
});

/**
 * Sign-in for the staff Android app. It has no browser cookie jar, so the session token comes back in the answer (and is sent as
 * `Authorization: Bearer <token>` afterwards); nothing is set as a cookie. The app keeps it in the phone's secure storage.
 */
authRouter.post("/app-login", loginFlood, usesPolicy("login-account"), async (req, res) => {
  // an app build that is too old (and a forced update is out) is turned away BEFORE any password is checked
  await assertAppCurrent(req);
  const app = appOfRequest(req);
  const result = await signIn(req);
  // some apps are for certain roles only (the Kitchen app: the kitchen team): everyone else is turned away, and the session just opened ends
  const needed = APP_REQUIRED_PERMISSION[app];
  if (needed && !result.user.permissions?.includes(needed)) {
    await logout(result.token).catch(() => undefined);
    throw new HttpError(403, `${APP_CATALOG[app].name} is for the kitchen team (kitchen staff, kitchen managers and owners). This account can't use it.`, { code: "app_not_allowed", app });
  }
  res.json({ token: result.token, expiresAt: result.expiresAt, user: result.user });
});

authRouter.post("/logout", async (req, res) => {
  // the browser's cookie, or the staff app's Bearer token — whichever this sign-in used
  await logout((req.cookies                                      )?.[SESSION_COOKIE]);
  await logout(bearerToken(req));
  res.clearCookie(SESSION_COOKIE, { path: "/" });
  res.status(204).end();
});

authRouter.get("/me", async (req, res) => {
  const user = requireUser(req);
  res.json({ user: await describeSessionUser(user) });
});
