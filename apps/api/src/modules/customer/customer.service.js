import { createHash, randomBytes, randomInt } from "node:crypto";
import {
  CustomerModel,
  CustomerSessionModel,
  OtpChallengeModel,
} from "@onetap/db";
import { isProd } from "../../env.js";
import { HttpError } from "../../middleware/error.js";
import { hasProvider, sendOtp } from "../notifications/notify.js";

const OTP_TTL_MIN = 10;
const MAX_ATTEMPTS = 5;
const MAX_PER_HOUR = 5;
const SESSION_DAYS = 30;

const sha = (v        ) => createHash("sha256").update(v).digest("hex");

const looksLikeEmail = (v        ) => v.includes("@");
export const normalizeDestination = (v        ) =>
  looksLikeEmail(v) ? v.toLowerCase().trim() : v.replace(/[^\d+]/g, "");

export async function requestOtp(input   
                  
                   
                      
 )                                                        {
  const destination = normalizeDestination(input.destination);
  const channel                = looksLikeEmail(destination) ? "email" : "sms";

  if (channel === "email" ? destination.length < 5 : destination.replace(/\D/g, "").length < 8) {
    throw new HttpError(400, "Enter a valid mobile number or email address");
  }

  // No provider in production means we cannot verify anyone — fail loudly
  // rather than letting unverified orders through.
  if (isProd && !hasProvider(channel)) {
    throw new HttpError(503, "Verification is not configured for this restaurant yet");
  }

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await OtpChallengeModel.countDocuments({
    brandId: input.brandId,
    destination,
    createdAt: { $gte: hourAgo },
  });
  if (recent >= MAX_PER_HOUR) {
    throw new HttpError(429, "Too many codes requested. Try again in an hour.");
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await OtpChallengeModel.create({
    brandId: input.brandId,
    outletId: input.outletId,
    destination,
    channel,
    codeHash: sha(code),
    expiresAt: new Date(Date.now() + OTP_TTL_MIN * 60 * 1000),
  });

  const result = await sendOtp(channel, destination, code);
  return { channel, devCode: result.devCode };
}

/**
 * Every field a brand-new customer must supply, checked here rather than
 * trusted from the client's own "is this a signup" flag — the client can't be
 * trusted to know whether the phone it just verified already has an account
 * (that would leak which numbers are registered before proving ownership of
 * one), so the service is what actually knows, right after the OTP check.
 */
function requireSignupFields(input) {
  const missing = [];
  if (!input.name?.trim()) missing.push("name");
  if (!input.gender) missing.push("gender");
  if (!input.age) missing.push("age");
  if (missing.length) {
    throw new HttpError(400, `Enter your ${missing.join(" and ")} to finish signing up`);
  }
}

export async function verifyOtp(input) {
  const destination = normalizeDestination(input.destination);

  const challenge = await OtpChallengeModel.findOne({
    brandId: input.brandId,
    destination,
    consumedAt: { $exists: false },
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  if (!challenge) throw new HttpError(400, "That code has expired. Request a new one.");
  if (challenge.attempts >= MAX_ATTEMPTS) throw new HttpError(429, "Too many attempts. Request a new code.");

  if (challenge.codeHash !== sha(input.code.trim())) {
    challenge.attempts += 1;
    await challenge.save();
    throw new HttpError(400, "That code isn't right");
  }

  challenge.consumedAt = new Date();
  await challenge.save();

  const isEmail = looksLikeEmail(destination);
  const query = isEmail
    ? { brandId: input.brandId, email: destination }
    : { brandId: input.brandId, phone: destination };

  let customer = await CustomerModel.findOne(query);

  if (!customer) {
    // A phone nobody has verified before is a signup — the full profile is
    // mandatory here, not optional, however the caller phrased the request.
    requireSignupFields(input);
    customer = await CustomerModel.create({
      ...query,
      name: input.name.trim(),
      gender: input.gender,
      age: input.age,
      email: !isEmail && input.email ? input.email : undefined,
    });
  } else {
    // A returning customer is never re-asked for their profile — but if this
    // record predates gender/age (or, from the old flow, predates name being
    // mandatory), backfill whatever it's still missing from what was
    // submitted rather than leaving it incomplete forever. Never overwrites a
    // value the customer already has.
    let dirty = false;
    if (input.name?.trim() && !customer.name) {
      customer.name = input.name.trim();
      dirty = true;
    }
    if (input.gender && !customer.gender) {
      customer.gender = input.gender;
      dirty = true;
    }
    if (input.age && !customer.age) {
      customer.age = input.age;
      dirty = true;
    }
    if (!isEmail && input.email && !customer.email) {
      customer.email = input.email;
      dirty = true;
    }
    if (dirty) await customer.save();
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await CustomerSessionModel.create({
    tokenHash: sha(token),
    customerId: String(customer._id),
    brandId: input.brandId,
    expiresAt,
  });

  return { token, expiresAt, customer };
}

/**
 * For a customer who is already logged in (a session from before this
 * feature, or one created for someone else and backfilled without gender/age)
 * but still fails `isProfileComplete` — fills in the rest without going
 * through OTP again, since owning the session cookie already proves identity.
 */
export async function completeProfile(customer, input) {
  requireSignupFields({
    name: input.name ?? customer.name,
    gender: input.gender ?? customer.gender,
    age: input.age ?? customer.age,
  });
  if (input.name?.trim()) customer.name = input.name.trim();
  if (input.gender) customer.gender = input.gender;
  if (input.age) customer.age = input.age;
  if (input.email && !customer.email) customer.email = input.email;
  await customer.save();
  return customer;
}

export async function customerFromToken(token                    )                              {
  if (!token) return null;
  const session = await CustomerSessionModel.findOne({ tokenHash: sha(token) }).lean();
  if (!session || session.expiresAt.getTime() < Date.now()) return null;
  return CustomerModel.findOne({ _id: session.customerId });
}

export async function endCustomerSession(token                    )                {
  if (!token) return;
  await CustomerSessionModel.deleteOne({ tokenHash: sha(token) });
}
