                                                               
import { ZodError } from "zod";
import { logger } from "../logger.js";

export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
    this.name = "HttpError";
  }
}

/** "acceptMinutes" → "Accept minutes" — the name of the box in words. */
const boxName = (path) => {
  const key = [...path].reverse().find((p) => typeof p === "string");
  if (!key) return "";
  const words = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/**
 * What to tell a person whose request was refused for a bad value: WHICH box, and what is allowed ("Accept minutes can be
 * at most 240."), not just "Validation failed". A message a schema wrote for people is shown as it is.
 */
export function describeValidation(err) {
  const issue = err.issues?.[0];
  if (!issue) return "Validation failed";
  const box = boxName(issue.path ?? []);
  const who = box || "This value";
  const written = typeof issue.message === "string" ? issue.message : "";
  // Zod's own wording starts like this; anything else was written on purpose for the person and says it all
  const isDefault = /^(Required$|Expected |Invalid |Number must|String must|Array must|Too (big|small)|Unrecognized)/.test(written);
  if (issue.code === "custom" || (written && !isDefault)) return written;
  switch (issue.code) {
    case "too_big":
      if (issue.type === "string") return `${who} can be at most ${issue.maximum} characters.`;
      if (issue.type === "array") return `${who} can have at most ${issue.maximum} items.`;
      return `${who} can be at most ${issue.maximum}.`;
    case "too_small":
      if (issue.type === "string") return issue.minimum <= 1 ? `${who} can't be empty.` : `${who} must be at least ${issue.minimum} characters.`;
      if (issue.type === "array") return issue.minimum <= 1 ? `${who} needs at least one item.` : `${who} needs at least ${issue.minimum} items.`;
      return issue.exact ? `${who} must be ${issue.minimum}.` : issue.inclusive === false ? `${who} must be more than ${issue.minimum}.` : `${who} must be at least ${issue.minimum}.`;
    case "invalid_type":
      return issue.received === "undefined" ? `${who} is required.` : `${who} isn't the right kind of value (expected ${issue.expected}).`;
    case "invalid_enum_value":
      return `${who} must be one of: ${(issue.options ?? []).join(", ")}.`;
    case "invalid_string":
      return issue.validation === "email" ? `${who} isn't a valid email address.` : `${who} isn't in the right format.`;
    default:
      return box ? `${box}: ${written || "isn't valid"}` : written || "Validation failed";
  }
}

export function notFound(_req         , res          )       {
  res.status(404).json({ error: "Not found" });
}

// Express 5: async errors from handlers land here automatically.
export function errorHandler(
  err         ,
  _req         ,
  res          ,
  _next              ,
)       {
  if (err instanceof ZodError) {
    res.status(400).json({ error: describeValidation(err), details: err.flatten() });
    return;
  }
  if (err instanceof HttpError) {
    // "try again in N seconds" is also said the standard way, for anything that isn't our own screen
    if (err.status === 429 && Number.isFinite(err.details?.retryAfterSec)) res.set("Retry-After", String(Math.ceil(err.details.retryAfterSec)));
    res.status(err.status).json({ error: err.message, details: err.details });
    return;
  }
  // body-parser and friends throw errors that already carry a client-safe
  // status and set `expose` when the message is meant to be shown. Without
  // this, posting an over-sized body reports "Internal server error" and the
  // caller has no idea their upload was simply too big.
  const status = err?.status ?? err?.statusCode;
  if (err?.expose && typeof status === "number" && status >= 400 && status < 500) {
    res.status(status).json({ error: err.message });
    return;
  }
  logger.error({ err }, "Unhandled error");
  res.status(500).json({ error: "Internal server error" });
}
