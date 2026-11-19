/**
 * How soon a customer may ask for ANOTHER verification code for the same number.
 *
 * The API enforces this (a request that comes too early is refused, whoever sends it) and the sign-in screen shows
 * the same countdown — so the numbers live here, once. Each code sent makes the next wait longer:
 *
 *   after the 1st code → 30 seconds,  2nd → 1 minute,  3rd → 2 minutes,  4th → 5 minutes,
 *   5th → 15 minutes,  6th → 1 hour,  7th and every one after → 6 hours.
 *
 * The count starts again after OTP_FORGET_AFTER_SEC without a request, or the moment the number signs in.
 */
export const OTP_RESEND_WAITS_SEC = [30, 60, 120, 300, 900, 3_600, 21_600];

/** a number nobody has asked a code for in this long is treated as new */
export const OTP_FORGET_AFTER_SEC = 24 * 3_600;

/** seconds to wait before the next code, once `sent` codes have gone out (1 or more) */
export const otpResendWait = (sent) => OTP_RESEND_WAITS_SEC[Math.min(Math.max(Math.floor(sent), 1), OTP_RESEND_WAITS_SEC.length) - 1];

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** in a sentence: "30 seconds", "5 minutes", "1 hour 5 minutes" */
export function formatWaitLong(totalSec) {
  const s = Math.max(1, Math.ceil(totalSec));
  if (s < 60) return plural(s, "second");
  if (s < 3_600) {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return r ? `${plural(m, "minute")} ${plural(r, "second")}` : plural(m, "minute");
  }
  const minutes = Math.round(s / 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${plural(h, "hour")} ${plural(m, "minute")}` : plural(h, "hour");
}

/** on a button, counting down: "24s", "4:32", "5:59:12" */
export function formatCountdown(totalSec) {
  const s = Math.max(0, Math.ceil(totalSec));
  if (s < 60) return `${s}s`;
  const h = Math.floor(s / 3_600);
  const m = Math.floor((s % 3_600) / 60);
  const r = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${r}` : `${m}:${r}`;
}
