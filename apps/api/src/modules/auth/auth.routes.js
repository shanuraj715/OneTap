import { Router } from "express";
import { z } from "zod";
import { isProd } from "../../env.js";
import { requireUser, SESSION_COOKIE } from "../../middleware/auth.js";
import { HttpError } from "../../middleware/error.js";
import { usesPolicy } from "../../middleware/rate-limit.js";
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

authRouter.post("/login", loginFlood, usesPolicy("login-account"), async (req, res) => {
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

  res.cookie(SESSION_COOKIE, result.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    expires: result.expiresAt,
    path: "/",
  });
  res.json({ user: result.user });
});

authRouter.post("/logout", async (req, res) => {
  await logout((req.cookies                                      )?.[SESSION_COOKIE]);
  res.clearCookie(SESSION_COOKIE, { path: "/" });
  res.status(204).end();
});

authRouter.get("/me", async (req, res) => {
  const user = requireUser(req);
  res.json({ user: await describeSessionUser(user) });
});
