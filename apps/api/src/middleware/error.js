                                                               
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
    res.status(400).json({ error: "Validation failed", details: err.flatten() });
    return;
  }
  if (err instanceof HttpError) {
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
