/**
 * Which TablePe API this website reads its pages from — the one place it's
 * set. The address ships with the app, so deploying the website needs no API
 * setting; override per deployment if you need to:
 *   NEXT_PUBLIC_API_URL  the API's public address (build time)
 *   API_INTERNAL_URL     what the website SERVER calls, e.g. http://127.0.0.1:3072
 *                        when the API runs on the same machine
 *
 * The browser never calls the API directly — the contact form posts to this
 * site's own /api/*, which next.config.mjs passes through.
 */
export const DEFAULT_API_URL = "https://api.food.shanuthewebdev.in";
export const DEV_API_URL = "http://localhost:3072";

const clean = (url) => url.trim().replace(/\/+$/, "");

export function apiPublicUrl() {
  const fromEnv = process.env.NEXT_PUBLIC_API_URL;
  if (fromEnv && fromEnv.trim()) return clean(fromEnv);
  return process.env.NODE_ENV === "production" ? DEFAULT_API_URL : DEV_API_URL;
}

export function apiServerUrl() {
  const internal = process.env.API_INTERNAL_URL;
  return internal && internal.trim() ? clean(internal) : apiPublicUrl();
}
