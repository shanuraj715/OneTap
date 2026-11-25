import { OtpChallengeModel, OtpThrottleModel } from "@rasoipulse/db";
import { OTP_FORGET_AFTER_SEC, formatWaitLong, otpResendWait } from "@rasoipulse/config-schema";
import { HttpError } from "../../middleware/error.js";

/**
 * The resend rule for verification codes (waits are in config-schema/otp.js): a number gets its next code only
 * after the wait that follows the one before. This is the ONLY place that decides — the sign-in screen's countdown
 * is a convenience, so a script calling the API directly gets exactly the same answer as the browser.
 *
 * `reserveSend` is one atomic step in the database (a conditional update, or a unique-key insert for the first
 * code), so any number of requests arriving together let exactly one through.
 */

/** the codes a person could still type for this flow — same filter the check uses */
export const livePurposeFilter = (purpose) => (purpose === "login" ? { $ne: "coins" } : purpose);

async function liveCodeExists({ brandId, destination, purpose }, now) {
  return Boolean(
    await OtpChallengeModel.exists({
      brandId,
      destination,
      purpose: livePurposeFilter(purpose),
      consumedAt: { $exists: false },
      expiresAt: { $gt: now },
    }),
  );
}

async function tooSoon(key, doc, now) {
  const retryAfterSec = Math.max(1, Math.ceil((new Date(doc.nextAllowedAt).getTime() - now.getTime()) / 1000));
  return new HttpError(429, `Please wait ${formatWaitLong(retryAfterSec)} before asking for another code.`, {
    code: "otp_wait",
    retryAfterSec,
    // a code that was already sent is still good — the sign-in screen can take the customer straight to typing it
    liveCode: await liveCodeExists(key, now),
    via: doc.via ?? null,
  });
}

/**
 * Take the right to send ONE code to this number, or refuse with 429 + how long to wait.
 * → { previousCount, resendAfterSec } — hand `previousCount` back to `releaseSend` if the code can't be sent.
 */
export async function reserveSend({ brandId, destination, purpose }) {
  const key = { brandId, destination, purpose };
  await OtpThrottleModel.init(); // the unique key must exist before two requests race to create the first row
  for (let tries = 0; tries < 4; tries += 1) {
    const now = new Date();
    const fresh = (count) => ({
      count,
      lastSentAt: now,
      nextAllowedAt: new Date(now.getTime() + otpResendWait(count) * 1000),
      expiresAt: new Date(now.getTime() + OTP_FORGET_AFTER_SEC * 1000),
    });
    const doc = await OtpThrottleModel.findOne(key).lean();

    if (!doc) {
      try {
        await OtpThrottleModel.create({ ...key, ...fresh(1) });
        return { previousCount: 0, resendAfterSec: otpResendWait(1) };
      } catch (e) {
        if (e?.code === 11000) continue; // another request created it a moment ago — look again
        throw e;
      }
    }

    if (new Date(doc.expiresAt) <= now) {
      // forgotten (the cleanup that deletes old rows just hasn't run yet): a new stretch starts
      const won = await OtpThrottleModel.findOneAndUpdate({ ...key, expiresAt: { $lte: now } }, { $set: { ...fresh(1), via: null } });
      if (won) return { previousCount: 0, resendAfterSec: otpResendWait(1) };
      continue;
    }

    if (new Date(doc.nextAllowedAt) > now) throw await tooSoon(key, doc, now);

    // allowed — but only if nobody else took this slot between the read and now
    const won = await OtpThrottleModel.findOneAndUpdate({ ...key, count: doc.count, nextAllowedAt: { $lte: now } }, { $set: fresh(doc.count + 1) });
    if (won) return { previousCount: doc.count, resendAfterSec: otpResendWait(doc.count + 1) };
  }
  throw new HttpError(429, "Please wait a moment before asking for another code.", { code: "otp_wait", retryAfterSec: 5, liveCode: false, via: null });
}

/**
 * The code could not be sent, so the customer has not been given one: take it back off the count. The same number
 * can try again after the shortest wait (not at once — each try ties up the sender).
 */
export async function releaseSend({ brandId, destination, purpose }, previousCount) {
  await OtpThrottleModel.updateOne(
    { brandId, destination, purpose },
    { $set: { count: previousCount, nextAllowedAt: new Date(Date.now() + otpResendWait(1) * 1000) } },
  );
}

/** remember how the code went out */
export async function noteSent({ brandId, destination, purpose }, via) {
  await OtpThrottleModel.updateOne({ brandId, destination, purpose }, { $set: { via } });
}

/** the number signed in with its code: it starts over */
export async function clearThrottle({ brandId, destination, purpose }) {
  await OtpThrottleModel.deleteOne({ brandId, destination, purpose });
}
