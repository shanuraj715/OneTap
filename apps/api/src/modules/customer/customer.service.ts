import { createHash, randomBytes, randomInt } from "node:crypto";
import {
  CustomerModel,
  CustomerSessionModel,
  OtpChallengeModel,
  type CustomerDoc,
} from "@onetap/db";
import { isProd } from "../../env";
import { HttpError } from "../../middleware/error";
import { hasProvider, sendOtp, type NotifyChannel } from "../notifications/notify";

const OTP_TTL_MIN = 10;
const MAX_ATTEMPTS = 5;
const MAX_PER_HOUR = 5;
const SESSION_DAYS = 30;

const sha = (v: string) => createHash("sha256").update(v).digest("hex");

const looksLikeEmail = (v: string) => v.includes("@");
export const normalizeDestination = (v: string) =>
  looksLikeEmail(v) ? v.toLowerCase().trim() : v.replace(/[^\d+]/g, "");

export async function requestOtp(input: {
  brandId: string;
  outletId: string;
  destination: string;
}): Promise<{ channel: NotifyChannel; devCode?: string }> {
  const destination = normalizeDestination(input.destination);
  const channel: NotifyChannel = looksLikeEmail(destination) ? "email" : "sms";

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

export async function verifyOtp(input: {
  brandId: string;
  destination: string;
  code: string;
  name?: string;
}): Promise<{ token: string; expiresAt: Date; customer: CustomerDoc }> {
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
  customer ??= await CustomerModel.create({ ...query, name: input.name });
  if (input.name && !customer.name) {
    customer.name = input.name;
    await customer.save();
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

export async function customerFromToken(token: string | undefined): Promise<CustomerDoc | null> {
  if (!token) return null;
  const session = await CustomerSessionModel.findOne({ tokenHash: sha(token) }).lean();
  if (!session || session.expiresAt.getTime() < Date.now()) return null;
  return CustomerModel.findOne({ _id: session.customerId });
}

export async function endCustomerSession(token: string | undefined): Promise<void> {
  if (!token) return;
  await CustomerSessionModel.deleteOne({ tokenHash: sha(token) });
}
