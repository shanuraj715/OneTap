import { createHash, randomBytes, randomInt } from "node:crypto";
import {
  CustomerModel,
  CustomerSessionModel,
  OtpChallengeModel,
} from "@onetap/db";
import { isProd } from "../../env.js";
import { HttpError } from "../../middleware/error.js";
import { sendOtp } from "../notifications/notify.js";
import { codeSender } from "../notify/notify.service.js";

const OTP_TTL_MIN = 10;
const MAX_ATTEMPTS = 5;
const MAX_PER_HOUR = 5;
const SESSION_DAYS = 30;

const sha = (v        ) => createHash("sha256").update(v).digest("hex");

const looksLikeEmail = (v        ) => v.includes("@");
export const normalizeDestination = (v        ) =>
  looksLikeEmail(v) ? v.toLowerCase().trim() : v.replace(/[^\d+]/g, "");

/**
 * Send a 6-digit code. `purpose` keeps sign-in codes and staff coin codes
 * apart, so one flow can never consume the other's code.
 *
 * How it goes out is the store's choice (Settings → Message sending): its linked WhatsApp number, WhatsApp
 * Business, or SMS — and then it is never returned to the caller. When the store hasn't chosen one, nothing is sent
 * and the code comes back as `devCode` for the screen to show — kept for stores that haven't set sending up.
 */
export async function requestOtp(input) {
  const purpose = input.purpose ?? "login";
  const destination = normalizeDestination(input.destination);
  const channel                = looksLikeEmail(destination) ? "email" : "sms";

  if (channel === "email" ? destination.length < 5 : destination.replace(/\D/g, "").length < 8) {
    throw new HttpError(400, "Enter a valid mobile number or email address");
  }

  // Until SMS/WhatsApp is integrated, allow OTP verification via devCode
  // so customers can test and use the login/signup flow seamlessly.

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
    purpose,
    codeHash: sha(code),
    expiresAt: new Date(Date.now() + OTP_TTL_MIN * 60 * 1000),
  });

  const sender = channel === "sms" ? await codeSender(input.brandId) : null;
  if (sender) {
    const sent = await sender.send(destination, code);
    // (the unsent challenge stays: nobody has the code, and it still counts toward the hourly limit)
    if (!sent.ok) throw new HttpError(502, sent.userMessage || "Couldn't send the code. Check the number and try again.");
    return { channel, sent: true, via: sender.method };
  }

  const result = await sendOtp(channel, destination, code);
  return { channel, devCode: result.devCode };
}

/**
 * Check a code for `purpose` and consume it. 123456 is accepted only for a
 * store that doesn't send real codes — once codes are sent (linked WhatsApp,
 * WhatsApp Business or SMS), only the code that was actually sent works.
 */
async function consumeCode({ brandId, destination, code, purpose }) {
  const challenge = await OtpChallengeModel.findOne({
    brandId,
    destination,
    // older challenges have no purpose — they were all sign-in codes
    purpose: purpose === "login" ? { $ne: "coins" } : purpose,
    consumedAt: { $exists: false },
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  if (!challenge) throw new HttpError(400, "That code has expired. Request a new one.");
  if (challenge.attempts >= MAX_ATTEMPTS) throw new HttpError(429, "Too many attempts. Request a new code.");

  const codesAreSent = Boolean(await codeSender(brandId));
  const isValidCode = challenge.codeHash === sha(code.trim()) || (!codesAreSent && code.trim() === "123456");
  if (!isValidCode) {
    challenge.attempts += 1;
    await challenge.save();
    throw new HttpError(400, "That code isn't right");
  }

  challenge.consumedAt = new Date();
  await challenge.save();
}

/** Staff spending a customer's coins: the customer read back the code sent to their phone. */
export async function verifyCoinsCode({ brandId, phone, code }) {
  await consumeCode({ brandId, destination: normalizeDestination(phone), code, purpose: "coins" });
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
  await consumeCode({ brandId: input.brandId, destination, code: input.code, purpose: "login" });

  const isEmail = looksLikeEmail(destination);
  const query = isEmail
    ? { brandId: input.brandId, email: destination }
    : { brandId: input.brandId, phone: destination };

  let customer = await CustomerModel.findOne(query);

  if (!customer) {
    // A phone nobody has verified before is a signup — but only the name is
    // required to create the account here. Gender and age are collected in a
    // second step (the storefront's own two-step form), through the same
    // `completeProfile` below that an old session missing them goes through.
    // The account this creates is real but intentionally incomplete —
    // `isProfileComplete` is what tells the caller to ask for the rest before
    // treating this as a finished signup.
    if (!input.name?.trim()) throw new HttpError(400, "Enter your name to finish signing up");
    customer = await CustomerModel.create({
      ...query,
      name: input.name.trim(),
      gender: input.gender || undefined,
      age: input.age || undefined,
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
