import { APP_REFRESH_HEADER } from "@rasoipulse/config-schema";
import { isKnownApp } from "../modules/app-releases/app-registry.js";
import { refreshSecondsOf } from "../modules/app-releases/app-releases.service.js";

/**
 * Tells a mobile app how often to ask for new data. Every app sends `x-app-id` with each request (see mobile-apps/<app>/src/runtime.tsx); the
 * answer — success, error or "too many requests" alike — carries `x-refresh-seconds`, the number the platform admin set for THAT app in the
 * console. The app uses it for its next refresh, so a change reaches every phone within one request. Requests with no (or an unknown) app id
 * — the dashboard, the storefront, old builds — get nothing added. Reading the number is a memory lookup; it never fails a request.
 */
export async function appRefreshHeader(req, res, next) {
  const id = String(req.header("x-app-id") ?? "");
  if (id && (await isKnownApp(id))) res.set(APP_REFRESH_HEADER, String(await refreshSecondsOf(id)));
  next();
}
