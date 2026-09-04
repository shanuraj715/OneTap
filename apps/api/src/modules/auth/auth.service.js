import { createHash, randomBytes } from "node:crypto";
import {
  permissionsForRole,
            
                   
} from "@onetap/config-schema";
import { SessionModel, UserModel,              } from "@onetap/db";
import { HttpError } from "../../middleware/error.js";
import { hashPassword, verifyPassword } from "./password.js";

const SESSION_DAYS = 14;

const hashToken = (token        ) => createHash("sha256").update(token).digest("hex");

                            
                     
              
 

export async function login(email        , password        , meta           ) {
  const user = await UserModel.findOne({ email: email.toLowerCase().trim() });
  // Same message either way — don't leak which emails exist.
  if (!user || !user.isActive || !(await verifyPassword(password, user.passwordHash))) {
    throw new HttpError(401, "Incorrect email or password");
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

  return { token, expiresAt, user: toSessionUser(user) };
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
    permissions: role ? permissionsForRole(role) : [],
  };
}

/** Create the first owner for a brand if that brand has no users yet. */
export async function ensureOwner(input   
                  
                
               
                   
 )                                               {
  const existing = await UserModel.findOne({ email: input.email.toLowerCase() });
  if (existing) return { created: false, email: existing.email };

  await UserModel.create({
    email: input.email.toLowerCase(),
    name: input.name,
    passwordHash: await hashPassword(input.password),
    isSuperAdmin: false,
    memberships: [{ brandId: input.brandId, role: "owner", outletIds: [] }],
  });
  return { created: true, email: input.email.toLowerCase() };
}
