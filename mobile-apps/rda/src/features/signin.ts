import { ApiError } from "@/api/client";

export interface SignInProblems { phone?: string; pin?: string }

/** The last 10 digits of whatever was typed ("+91 98765 43210" → "9876543210"); "" when there are fewer than 10. */
export const phoneDigits = (text: string): string => {
  const d = text.replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-10) : "";
};

/** Checked before anything is sent (the server checks again): an obviously incomplete form never uses up a sign-in attempt. */
export function signInProblems(phone: string, pin: string): SignInProblems {
  const out: SignInProblems = {};
  if (!phone.trim()) out.phone = "Enter your mobile number.";
  else if (!phoneDigits(phone)) out.phone = "Enter your 10-digit mobile number.";
  if (!pin) out.pin = "Enter your PIN.";
  else if (!/^\d{4,6}$/.test(pin)) out.pin = "Your PIN is 4 to 6 digits.";
  return out;
}

export interface SignInFailure { message: string; /** seconds until trying again is allowed (too many attempts) */ waitSec?: number }

/** What to tell the rider after a failed sign-in. */
export function describeSignInError(error: unknown): SignInFailure {
  if (error instanceof ApiError) {
    if (error.isTooManyRequests) return { message: error.message, waitSec: error.retryAfterSec };
    if (error.isNetwork) return { message: error.message };
    // 404: the server is reachable but is an older version that has no rider sign-in (or the app points at the wrong server)
    if (error.status === 404) return { message: "This server doesn't have the rider sign-in yet. It needs to be updated, or the app is set to the wrong server." };
    const left = error.details?.attemptsLeft;
    if (error.status === 401 && typeof left === "number") return { message: `${error.message}. ${left === 1 ? "1 try" : `${left} tries`} left before this number is paused.` };
    return { message: error.message };
  }
  return { message: "Something went wrong. Please try again." };
}
