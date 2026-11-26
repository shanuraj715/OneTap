import { ApiError } from "@/api/client";

export interface SignInProblems { email?: string; password?: string }

/** Checked before anything is sent (the server checks again): an obviously incomplete form never uses up a sign-in attempt. */
export function signInProblems(email: string, password: string): SignInProblems {
  const out: SignInProblems = {};
  const e = email.trim();
  if (!e) out.email = "Enter your email.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) out.email = "That doesn't look like an email address.";
  if (!password) out.password = "Enter your password.";
  return out;
}

export interface SignInFailure { message: string; /** seconds until trying again is allowed (too many attempts) */ waitSec?: number }

/** What to tell the person after a failed sign-in. */
export function describeSignInError(error: unknown): SignInFailure {
  if (error instanceof ApiError) {
    if (error.isTooManyRequests) return { message: error.message, waitSec: error.retryAfterSec };
    if (error.isNetwork) return { message: error.message };
    // 404: the server is reachable but is an older version that has no app sign-in (or the app points at the wrong server)
    if (error.status === 404) return { message: "This server doesn't have the app's sign-in yet. It needs to be updated, or the app is set to the wrong server." };
    const left = error.details?.attemptsLeft;
    if (error.status === 401 && typeof left === "number") return { message: `${error.message}. ${left === 1 ? "1 attempt" : `${left} attempts`} left before this phone is paused.` };
    return { message: error.message };
  }
  return { message: "Something went wrong. Please try again." };
}
