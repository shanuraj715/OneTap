import { env } from "../../env.js";

/**
 * A small client for Google's Gemini picture models ("Nano Banana"). No SDK: one HTTPS call per picture.
 *
 * Google's current guide documents the Interactions API (POST /v1beta/interactions); the older generateContent API
 * (POST /v1beta/models/<model>:generateContent) is still served, so it is the fallback when the first answers
 * "not found". Either answer is read by looking for the picture wherever it sits (see {@link findPicture}).
 *
 * The API key goes only in a request header — never in a URL, a log line or an error message.
 */

const TIMEOUT_MS = 120_000;

/**
 * An error whose message is safe to show the super admin. `reason` says whose fault it was, which decides what happens
 * next: "quota" (this key is used up for now) and "key" (this key is refused) mean try another key; anything else
 * (a safety refusal, Google being busy) would fail on any key, so it is just reported.
 */
export class AiError extends Error {
  constructor(message, { status = 502, reason = "" } = {}) {
    super(message);
    this.name = "AiError";
    this.status = status;
    this.reason = reason;
  }
}

const base = () => env.GEMINI_API_BASE_URL.replace(/\/$/, "");

/** Google's error JSON → a plain sentence, and whose fault it is (see AiError). */
function explain(httpStatus, body, fallback) {
  const err = body?.error ?? {};
  const said = String(err.message ?? "").trim();
  const code = String(err.status ?? "");
  if (httpStatus === 400 && /api key|API_KEY/i.test(said + code)) return { message: "Google rejected this API key.", reason: "key" };
  if (httpStatus === 401 || httpStatus === 403) {
    return { message: `Google refused this key${said ? `: ${said}` : ""}. It may be wrong, restricted, or its project may need billing turned on.`, reason: "key" };
  }
  if (httpStatus === 429) return { message: "Google says this key's quota or rate limit is used up.", reason: "quota" };
  if (httpStatus >= 500) return { message: "Google's picture service is busy or down right now. Try again in a moment.", reason: "" };
  return { message: `${fallback}${said ? `: ${said}` : ` (HTTP ${httpStatus})`}`, reason: "" };
}

async function post(path, apiKey, body) {
  let res;
  try {
    res = await fetch(`${base()}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    const timedOut = err?.name === "TimeoutError" || err?.name === "AbortError";
    throw new AiError(timedOut ? "Google took too long to make the picture. Try again." : "Couldn't reach Google. Check the server's internet connection.", { status: 504 });
  }
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  return { res, json, text };
}

const IMAGE_MIME = /^image\/(png|jpe?g|webp|gif|avif|heic|heif)$/i;

/**
 * Find the picture in an answer, whichever API made it: an object carrying base64 `data` that is marked as an image
 * (`type: "image"`, or a `mime_type`/`mimeType` of image/…), including generateContent's `inlineData`/`inline_data`.
 * The last one wins — the guide says the last block is the finished picture.
 */
export function findPicture(root) {
  let found = null;
  const walk = (node, depth) => {
    if (!node || typeof node !== "object" || depth > 12) return;
    if (Array.isArray(node)) return node.forEach((n) => walk(n, depth + 1));
    const inline = node.inlineData ?? node.inline_data;
    if (inline && typeof inline.data === "string" && inline.data.length > 100) {
      found = { data: inline.data, mimeType: inline.mimeType ?? inline.mime_type ?? "image/png" };
    }
    const mime = node.mime_type ?? node.mimeType;
    if (typeof node.data === "string" && node.data.length > 100 && (node.type === "image" || (typeof mime === "string" && IMAGE_MIME.test(mime)))) {
      found = { data: node.data, mimeType: typeof mime === "string" ? mime : "image/png" };
    }
    for (const v of Object.values(node)) if (v && typeof v === "object") walk(v, depth + 1);
  };
  walk(root, 0);
  return found;
}

/** Why there was no picture: a safety refusal, or Google answering with words instead. */
function whyNoPicture(json) {
  const blocked = json?.promptFeedback?.blockReason ?? json?.prompt_feedback?.block_reason;
  const finish = [...(json?.candidates ?? [])].map((c) => c.finishReason ?? c.finish_reason).find((f) => f && f !== "STOP");
  if (blocked || /SAFETY|PROHIBITED|BLOCKLIST|RECITATION|IMAGE_OTHER/.test(String(finish ?? ""))) {
    return "Google's safety filter would not make this picture. Change the description and try again.";
  }
  const words = [];
  const collect = (node, depth) => {
    if (!node || typeof node !== "object" || depth > 12) return;
    if (Array.isArray(node)) return node.forEach((n) => collect(n, depth + 1));
    if (typeof node.text === "string" && node.text.trim()) words.push(node.text.trim());
    for (const v of Object.values(node)) if (v && typeof v === "object") collect(v, depth + 1);
  };
  collect(json, 0);
  return words.length
    ? `Google answered with words instead of a picture: “${words.join(" ").slice(0, 160)}”`
    : "Google's answer had no picture in it. Try again, or choose a different model in the console.";
}

/**
 * Make one picture. Returns `{ buffer, mimeType }`.
 * @param {{ apiKey: string, model: string, prompt: string, aspectRatio: string }} input
 */
export async function generateImage({ apiKey, model, prompt, aspectRatio }) {
  const safeModel = encodeURIComponent(model);

  // 1. the Interactions API (what Google's guide documents now)
  let { res, json, text } = await post("/v1beta/interactions", apiKey, {
    model,
    input: [{ type: "text", text: prompt }],
    response_format: { type: "image", aspect_ratio: aspectRatio, image_size: "1K" },
  });

  // 2. not served here / not for this model → the older generateContent
  if (res.status === 404 || res.status === 405) {
    ({ res, json, text } = await post(`/v1beta/models/${safeModel}:generateContent`, apiKey, {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ["TEXT", "IMAGE"], imageConfig: { aspectRatio } },
    }));
    if (res.status === 404) {
      throw new AiError(`Google doesn't know the model “${model}”. Pick another one in the console (AI pictures).`, { status: 400 });
    }
  }

  if (!res.ok) {
    const e = explain(res.status, json, "Google couldn't make the picture");
    throw new AiError(e.message, { reason: e.reason });
  }

  const pic = findPicture(json);
  if (!pic) throw new AiError(whyNoPicture(json));
  const buffer = Buffer.from(pic.data, "base64");
  if (buffer.length < 100) throw new AiError("Google's answer had an empty picture. Try again.");
  return { buffer, mimeType: pic.mimeType };
}

/** Check the key is valid, for free: asks Google for the list of models (no picture is made, nothing is billed). */
export async function checkKey(apiKey) {
  let res;
  try {
    res = await fetch(`${base()}/v1beta/models?pageSize=1`, { headers: { "x-goog-api-key": apiKey }, signal: AbortSignal.timeout(20_000) });
  } catch {
    throw new AiError("Couldn't reach Google. Check the server's internet connection.", { status: 504 });
  }
  if (res.ok) return true;
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* ignore */
  }
  const e = explain(res.status, json, "Google didn't accept the key");
  throw new AiError(e.message, { status: 400, reason: e.reason });
}
