import { BrandModel, LoginLogModel } from "@rasoipulse/db";
import { logger } from "../../logger.js";
import { tooMany } from "../site/guard.js";

/**
 * A record of every sign-in to the dashboards — who, when, from where, and
 * whether it worked. Shown on the platform console's dashboard.
 */

/** "Chrome on macOS", worked out from the browser's user-agent text. */
export function describeDevice(userAgent) {
  const ua = String(userAgent ?? "");
  if (!ua) return "Unknown device";
  const browser = /curl\/|node|python|axios|okhttp|Go-http|PostmanRuntime/i.test(ua)
    ? "Script"
    : /Edg\//.test(ua)
      ? "Edge"
      : /OPR\/|Opera/.test(ua)
        ? "Opera"
        : /Firefox\/|FxiOS\//.test(ua)
          ? "Firefox"
          : /Chrome\/|CriOS\//.test(ua)
            ? "Chrome"
            : /Safari\//.test(ua)
              ? "Safari"
              : "Browser";
  // order matters: Android and iPhone user agents also say "Linux" / "Mac OS X"
  const os = /Windows/.test(ua)
    ? "Windows"
    : /Android/.test(ua)
      ? "Android"
      : /iPhone|iPad|iPod/.test(ua)
        ? "iOS"
        : /Mac OS X|Macintosh/.test(ua)
          ? "macOS"
          : /Linux|X11|CrOS/.test(ua)
            ? "Linux"
            : "";
  return os ? `${browser} on ${os}` : browser;
}

async function write({ email, user, success, reason, ip, userAgent }) {
  const membership = user && !user.isSuperAdmin ? user.memberships?.[0] : null;
  const brand = membership?.brandId ? await BrandModel.findById(membership.brandId).select("name").lean() : null;
  await LoginLogModel.create({
    userId: user ? String(user._id) : undefined,
    email: String(email ?? "").slice(0, 200),
    name: user?.name,
    success,
    reason,
    isSuperAdmin: Boolean(user?.isSuperAdmin),
    scope: !user ? "unknown" : user.isSuperAdmin ? "platform" : membership ? "store" : "unknown",
    brandId: membership?.brandId,
    brandName: brand?.name,
    role: user?.isSuperAdmin ? "super_admin" : membership?.role,
    ip: ip ? String(ip).slice(0, 64) : undefined,
    userAgent: userAgent ? String(userAgent).slice(0, 300) : undefined,
    device: describeDevice(userAgent),
  });
}

/**
 * Note a sign-in attempt. Fire and forget: writing the log never slows a
 * sign-in down or makes it fail. Failed attempts from one address are only
 * logged up to a limit, so a script guessing passwords can't fill the database.
 */
export function recordLogin(entry) {
  if (!entry.success && tooMany(`loginlog:${entry.ip ?? "unknown"}`, 30, 60 * 60 * 1000)) return;
  void write(entry).catch((err) => logger.warn({ err: err.message }, "login log write failed"));
}
