import { Router } from "express";
import { z } from "zod";
import { isProd } from "../../env.js";
import { requireUser, SESSION_COOKIE } from "../../middleware/auth.js";
import { login, logout, toSessionUser } from "./auth.service.js";

export const authRouter         = Router();

const credentials = z.object({
  email: z.string().min(3),
  password: z.string().min(1),
});

authRouter.post("/login", async (req, res) => {
  const body = credentials.parse(req.body);
  const result = await login(body.email, body.password, {
    userAgent: req.header("user-agent") ?? undefined,
    ip: req.ip,
  });

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

authRouter.get("/me", (req, res) => {
  const user = requireUser(req);
  res.json({ user: toSessionUser(user) });
});
