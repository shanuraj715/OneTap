import { createHash, randomBytes } from "node:crypto";
import {
  permissionsForRole,
            
                   
} from "@onetap/config-schema";
import { SessionModel, UserModel,              } from "@onetap/db";
import { HttpError } from "../../middleware/error.js";
import { platformConfig } from "../cache/platform-config.js";
import { storePlan } from "../platform/plan.service.js";
import { recordLogin } from "./login-log.js";
import { hashPassword, verifyPassword } from "./password.js";

const SESSION_DAYS = 14;

const hashToken = (token        ) => createHash("sha256").update(token).digest("hex");

                            
                     
              
 

export async function login(email        , password        , meta           ) {
  const user = await UserModel.findOne({ email: email.toLowerCase().trim() });
  const note = (success, reason, who = user) => recordLogin({ email, user: who, success, reason, ip: meta.ip, userAgent: meta.userAgent });
  // Same message either way — don't leak which emails exist. (The sign-in log below does say which, for the platform owner only.)
  if (!user) {
    note(false, "unknown_account", null);
    throw new HttpError(401, "Incorrect email or password");
  }
  if (!user.isActive) {
    note(false, "inactive");
    throw new HttpError(401, "Incorrect email or password");
  }
  if (!(await verifyPassword(password, user.passwordHash))) {
    note(false, "wrong_password");
    throw new HttpError(401, "Incorrect email or password");
  }
  // Blocked by the platform in every store they belong to (over a plan's
  // people limit) — the password was right, so say why instead of "incorrect".
  if (!user.isSuperAdmin && user.memberships.length > 0 && user.memberships.every((m) => m.blockedAt)) {
    note(false, "paused");
    throw new HttpError(403, "Your access is paused. Please contact your store owner.");
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await SessionModel.create({
    tokenHash: hashToken(token),
    userId: String(user._id),
    expiresAt,
    userAgent: meta.userAgent,
    ip: meta.ip,
  });

  user.lastLoginAt = new Date();
  await user.save();
  note(true, "");

  return { token, expiresAt, user: await describeSessionUser(user) };
}

export async function logout(token                    )                {
  if (!token) return;
  await SessionModel.deleteOne({ tokenHash: hashToken(token) });
}

export async function userFromToken(token                    )                          {
  if (!token) return null;
  const session = await SessionModel.findOne({ tokenHash: hashToken(token) }).lean();
  if (!session || session.expiresAt.getTime() < Date.now()) return null;

  const user = await UserModel.findOne({ _id: session.userId });
  return user && user.isActive ? user : null;
}

/** Flatten a user to what the admin needs. Single-brand for now. */
export function toSessionUser(user         )              {
  const membership = user.memberships[0];
  const role              = user.isSuperAdmin ? "super_admin" : (membership?.role ?? null);
  return {
    id: String(user._id),
    email: user.email,
    name: user.name,
    isSuperAdmin: user.isSuperAdmin,
    role,
    brandId: membership?.brandId ?? null,
    /** set when the platform has paused this person's access to their store */
    blockedAt: membership?.blockedAt ?? null,
    permissions: role ? permissionsForRole(role) : [],
  };
}

/**
 * `toSessionUser`, plus — for a store's team — whether TablePe has switched their store off. The admin shows
 * that notice instead of the dashboard, so people learn why nothing works rather than meeting a wall of
 * errors. A team member can still sign in to a disabled store for exactly that reason. The platform's own
 * super admin is never affected.
 */
export async function describeSessionUser(user) {
  // whether dashboards get live updates over a WebSocket or ask for their orders on a timer (a platform switch)
  const realtime = { websocket: (await platformConfig()).realtimeWebsocket !== false };
  const session = { ...toSessionUser(user), realtime };
  if (user.isSuperAdmin || !session.brandId) return { ...session, storeDisabled: null };
  try {
    const { disabled, brand } = await storePlan(session.brandId);
    return { ...session, storeDisabled: disabled ? { at: disabled.at, message: disabled.message, storeName: brand.name } : null };
  } catch {
    // a store that can't be read (it was deleted a moment ago, say) isn't "switched off" — it just isn't there
    return { ...session, storeDisabled: null };
  }
}

/**
 * Create the first owner for a brand. If the email is brand new, creates the
 * user outright. If it already exists (e.g. the same person owns a second
 * brand) but has no membership for THIS brand yet, adds one — an email
 * collision must never silently leave a freshly created brand ownerless.
 */
export async function ensureOwner(input




 )                                               {
  const existing = await UserModel.findOne({ email: input.email.toLowerCase() });
  if (existing) {
    const already = existing.memberships.some((m) => m.brandId === input.brandId);
    if (!already) {
      existing.memberships.push({ brandId: input.brandId, role: "owner", outletIds: [] });
      await existing.save();
    }
    return { created: false, email: existing.email };
  }

  await UserModel.create({
    email: input.email.toLowerCase(),
    name: input.name,
    passwordHash: await hashPassword(input.password),
    isSuperAdmin: false,
    memberships: [{ brandId: input.brandId, role: "owner", outletIds: [] }],
  });
  return { created: true, email: input.email.toLowerCase() };
}

/**
 * Create the platform superadmin if it doesn't exist yet. Not tied to any
 * brand — `isSuperAdmin` alone grants every permission, across every tenant
 * (see `toSessionUser`) — so no `memberships` entry is needed or created.
 */
export async function ensureSuperAdmin(input



 )                                               {
  const existing = await UserModel.findOne({ email: input.email.toLowerCase() });
  if (existing) return { created: false, email: existing.email };

  await UserModel.create({
    email: input.email.toLowerCase(),
    name: input.name,
    passwordHash: await hashPassword(input.password),
    isSuperAdmin: true,
    memberships: [],
  });
  return { created: true, email: input.email.toLowerCase() };
}
