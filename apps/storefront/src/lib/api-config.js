/**
 * Which TablePe API this storefront talks to — the one place it's set.
 *
 * Every store's website, whatever domain it's served on (dominos.com,
 * wowmomos.com…), talks to the same platform API, so the address ships with
 * the app: deploying a store's domain needs no API setting at all.
 *
 * To point a deployment somewhere else, either change DEFAULT_API_URL below
 * (the default for every deploy), or override it per deployment:
 *   NEXT_PUBLIC_API_URL  the API's public address, e.g. https://api.myfood.com
 *                        (read at build time — rebuild after changing it)
 *   API_INTERNAL_URL     optional: the address the storefront SERVER uses, e.g.
 *                        http://127.0.0.1:3072 when the API runs on the same
 *                        machine, so those calls never leave it
 *
 * In the browser the storefront never calls the API directly — it goes
 * through its own domain's /api/* (see next.config.mjs and clientApi.js).
 */

/** The platform API every deployed storefront uses unless told otherwise. */
export const DEFAULT_API_URL = "https://api.food.shanuthewebdev.in";

/** The API when running locally (`pnpm dev`). */
export const DEV_API_URL = "http://localhost:3072";

const clean = (url) => url.trim().replace(/\/+$/, "");

/** The API's public address — what a browser could reach (e.g. the live-preview socket). */
export function apiPublicUrl() {
  const fromEnv = process.env.NEXT_PUBLIC_API_URL;
  if (fromEnv && fromEnv.trim()) return clean(fromEnv);
  return process.env.NODE_ENV === "production" ? DEFAULT_API_URL : DEV_API_URL;
}

/** What the storefront server calls: the internal address when one is set, else the public one. */
export function apiServerUrl() {
  const internal = process.env.API_INTERNAL_URL;
  return internal && internal.trim() ? clean(internal) : apiPublicUrl();
}
