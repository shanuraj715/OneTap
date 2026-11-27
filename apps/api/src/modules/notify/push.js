import crypto from "node:crypto";
import fs from "node:fs";
import { env } from "../../env.js";
import { logger } from "../../logger.js";

/**
 * Push notifications to phones through Firebase Cloud Messaging (FCM HTTP v1) — no Firebase library: the Firebase project's service-account
 * key signs a short-lived request (RS256), Google answers with an access token (kept until a minute before it ends), and each message is one POST.
 *
 *   configured()                         → is a service account set up? (no key = push is simply off: nothing here ever throws)
 *   sendPush(tokens, { title, body, data, channelId })
 *                                        → { sent, failed, invalid: [tokens Google says are gone] }  (the caller removes the invalid ones)
 */

let account; // undefined = not read yet; null = not configured
function readAccount() {
  if (account !== undefined) return account;
  account = null;
  try {
    const text = env.FCM_SERVICE_ACCOUNT_JSON.trim() || (env.FCM_SERVICE_ACCOUNT_FILE.trim() ? fs.readFileSync(env.FCM_SERVICE_ACCOUNT_FILE.trim(), "utf8") : "");
    if (!text) return account;
    const json = JSON.parse(text);
    if (!json.client_email || !json.private_key || !json.project_id) throw new Error("the service account JSON needs client_email, private_key and project_id");
    account = { email: json.client_email, key: json.private_key, project: json.project_id, tokenUri: env.FCM_OAUTH_URL };
  } catch (err) {
    logger.error({ err: String(err?.message ?? err) }, "push notifications: the FCM service account can't be read — push is OFF");
  }
  return account;
}

/** Forget what was read and the access token (tests change the settings between runs). */
export function resetPush() { account = undefined; cached = null; }
export const configured = () => Boolean(readAccount());
export const projectId = () => readAccount()?.project ?? null;

const b64 = (v) => Buffer.from(typeof v === "string" ? v : JSON.stringify(v)).toString("base64url");
let cached = null; // { token, exp }

async function accessToken(force = false) {
  const a = readAccount();
  if (!a) return null;
  if (!force && cached && cached.exp - 60_000 > Date.now()) return cached.token;
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({ iss: a.email, scope: "https://www.googleapis.com/auth/firebase.messaging", aud: a.tokenUri, iat: now, exp: now + 3600 })}`;
  const assertion = `${unsigned}.${crypto.sign("RSA-SHA256", Buffer.from(unsigned), a.key).toString("base64url")}`;
  const res = await fetch(a.tokenUri, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }), signal: AbortSignal.timeout(8000) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) throw new Error(`Google refused the service account (${res.status}${json.error ? ` ${json.error}` : ""})`);
  cached = { token: json.access_token, exp: Date.now() + (Number(json.expires_in) || 3600) * 1000 };
  return cached.token;
}

/** FCM data values must be strings. */
const stringsOnly = (data = {}) => Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => [k, String(v)]));

async function sendOne(a, token, { title, body, data, channelId }, retried = false) {
  const res = await fetch(`${env.FCM_API_URL}/v1/projects/${a.project}/messages:send`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${await accessToken(retried)}` },
    body: JSON.stringify({
      message: {
        token,
        notification: { title, body },
        data: stringsOnly(data),
        // high priority wakes a sleeping phone; the notification itself is drawn by Android even when the app is closed
        android: { priority: "HIGH", ttl: "1800s", notification: { channel_id: channelId ?? "default", sound: "default" } },
      },
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (res.ok) return "sent";
  const err = await res.json().catch(() => ({}));
  const code = err?.error?.details?.find?.((d) => d.errorCode)?.errorCode ?? err?.error?.status ?? "";
  if (res.status === 401 && !retried) return sendOne(a, token, { title, body, data, channelId }, true); // the access token ran out early: one fresh try
  if (res.status === 404 || code === "UNREGISTERED" || (res.status === 400 && code === "INVALID_ARGUMENT")) return "invalid";
  logger.warn({ status: res.status, code, message: err?.error?.message }, "push notification not sent");
  return "failed";
}

export async function sendPush(tokens, message) {
  const out = { sent: 0, failed: 0, invalid: [] };
  const a = readAccount();
  if (!a || !tokens?.length) return out;
  for (const token of tokens) {
    try {
      const r = await sendOne(a, token, message);
      if (r === "sent") out.sent += 1; else if (r === "invalid") out.invalid.push(token); else out.failed += 1;
    } catch (err) {
      out.failed += 1;
      logger.warn({ err: String(err?.message ?? err) }, "push notification not sent");
    }
  }
  return out;
}
