import { env } from "../../env.js";
import { logger } from "../../logger.js";

/**
 * Ask the marketing website to drop its cached pages, so a change saved in
 * the console shows within seconds instead of at the next scheduled refresh.
 * Fire-and-forget: the website being down (or not deployed yet) must never
 * fail a save — it refreshes on its own schedule anyway.
 */
export function notifyWebsite() {
  // tests don't ping a website unless one was explicitly pointed at
  if (env.NODE_ENV === "test" && !process.env.WEBSITE_URL) return;
  const url = `${env.WEBSITE_URL.replace(/\/$/, "")}/api/revalidate`;
  void fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-revalidate-secret": env.WEBSITE_REVALIDATE_SECRET },
    body: "{}",
    signal: AbortSignal.timeout(4000),
  })
    .then((r) => {
      if (!r.ok) logger.warn({ status: r.status }, "website refresh request was refused");
    })
    .catch((err) => logger.debug({ err: err.message }, "website not reachable for a refresh — it will refresh on its own"));
}
