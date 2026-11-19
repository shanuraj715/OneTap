import { createHash, randomUUID } from "node:crypto";
import {
  AI_ASPECT_RATIO_IDS,
  AI_IMAGE_MODELS,
  AI_MAX_IMAGES_AT_ONCE,
  AI_MAX_PROMPT_LENGTH,
  angleFor,
  buildItemImagePrompt,
  categoryPathLabel,
  DEFAULT_AI_IMAGE_MODEL,
  IMAGE_RULES,
} from "@onetap/config-schema";
import { MenuCategoryModel, MenuItemModel, PlatformAiModel, tenantFilter } from "@onetap/db";
import { logger } from "../../logger.js";
import { HttpError } from "../../middleware/error.js";
import { decryptSecret, encryptSecret, maskSecret } from "../../lib/crypto.js";
import { updateItem } from "../menu/menu.service.js";
import { putImage } from "../storage/storage.service.js";
import { AiError, checkKey, generateImage } from "./gemini.js";

const PLATFORM = { key: "platform" };
const MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{2,79}$/;
const MAX_KEYS = 20;
/** how long a key rests after Google says its quota is used up / after Google refuses it */
const QUOTA_REST_MS = 10 * 60_000;
const REFUSED_REST_MS = 24 * 60 * 60_000;

const load = () => PlatformAiModel.findOne(PLATFORM).lean();
const fingerprint = (key) => createHash("sha256").update(key).digest("hex").slice(0, 16);

/** ready | cooling (resting after a limit) | off (paused by the super admin) */
function statusOf(k, now = Date.now()) {
  if (!k.enabled) return "off";
  if (k.cooldownUntil && new Date(k.cooldownUntil).getTime() > now) return "cooling";
  return "ready";
}

const publicKey = (k) => ({
  id: k.id,
  label: k.label || "",
  keyHint: k.keyHint,
  enabled: k.enabled !== false,
  status: statusOf(k),
  uses: k.uses ?? 0,
  lastUsedAt: k.lastUsedAt ?? null,
  lastError: k.lastError ?? "",
  cooldownUntil: statusOf(k) === "cooling" ? k.cooldownUntil : null,
  addedAt: k.addedAt ?? null,
});

/** What the console may see: the keys' hints and states — never a key itself. */
export async function getAiSettings() {
  const doc = await load();
  const keys = (doc?.keys ?? []).map(publicKey);
  return {
    provider: "gemini",
    configured: keys.length > 0,
    readyKeys: keys.filter((k) => k.status === "ready").length,
    model: doc?.model || DEFAULT_AI_IMAGE_MODEL,
    models: AI_IMAGE_MODELS,
    keys,
    maxKeys: MAX_KEYS,
  };
}

export async function saveAiModel(model, userId) {
  const id = String(model ?? "").trim();
  if (!MODEL_ID.test(id)) throw new HttpError(400, "That model name isn't valid (letters, numbers, dots, dashes).");
  await PlatformAiModel.findOneAndUpdate(PLATFORM, { $set: { model: id, updatedBy: userId }, $setOnInsert: PLATFORM }, { upsert: true });
  return getAiSettings();
}

export async function addAiKey({ label = "", apiKey }, userId) {
  const key = String(apiKey ?? "").trim();
  if (/\s/.test(key) || key.length < 20) throw new HttpError(400, "That doesn't look like a Gemini API key (they are one long word with no spaces).");
  const doc = await load();
  if ((doc?.keys ?? []).length >= MAX_KEYS) throw new HttpError(409, `You can keep up to ${MAX_KEYS} keys. Remove one first.`);
  const fp = fingerprint(key);
  if ((doc?.keys ?? []).some((k) => k.fingerprint === fp)) throw new HttpError(409, "That key is already in the list.");
  const entry = { id: randomUUID(), label: String(label ?? "").trim().slice(0, 60), encryptedKey: encryptSecret(key), keyHint: maskSecret(key), fingerprint: fp, enabled: true, uses: 0, lastError: "", addedAt: new Date() };
  await PlatformAiModel.findOneAndUpdate(PLATFORM, { $push: { keys: entry }, $set: { updatedBy: userId }, $setOnInsert: PLATFORM }, { upsert: true });
  return getAiSettings();
}

async function mustHaveKey(id) {
  const doc = await load();
  const k = (doc?.keys ?? []).find((x) => x.id === id);
  if (!k) throw new HttpError(404, "That key isn't in the list.");
  return { doc, k };
}

export async function updateAiKey(id, { label, enabled }, userId) {
  await mustHaveKey(id);
  const set = { updatedBy: userId };
  if (typeof label === "string") set["keys.$.label"] = label.trim().slice(0, 60);
  if (typeof enabled === "boolean") set["keys.$.enabled"] = enabled;
  await PlatformAiModel.updateOne({ ...PLATFORM, "keys.id": id }, { $set: set });
  return getAiSettings();
}

export async function removeAiKey(id, userId) {
  await mustHaveKey(id);
  await PlatformAiModel.updateOne(PLATFORM, { $pull: { keys: { id } }, $set: { updatedBy: userId } });
  return getAiSettings();
}

/** A free check of one key: asks Google for a model list (no picture is made, nothing is billed). A good result clears its rest. */
export async function testAiKey(id) {
  const { k } = await mustHaveKey(id);
  let plain;
  try {
    plain = decryptSecret(k.encryptedKey);
  } catch {
    throw new HttpError(409, "This key can't be read any more (the server's encryption key changed). Remove it and add it again.");
  }
  const started = Date.now();
  try {
    await checkKey(plain);
  } catch (err) {
    const message = err instanceof AiError ? err.message : "The test failed";
    await PlatformAiModel.updateOne({ ...PLATFORM, "keys.id": id }, { $set: { "keys.$.lastError": message } });
    throw new HttpError(err.status ?? 400, message);
  }
  await PlatformAiModel.updateOne({ ...PLATFORM, "keys.id": id }, { $set: { "keys.$.lastError": "" }, $unset: { "keys.$.cooldownUntil": "" } });
  return { ok: true, ms: Date.now() - started, settings: await getAiSettings() };
}

/* ---------------------------------------------------------------- making pictures */

const inFlight = new Map(); // key id -> pictures being made with it right now (this process)

/** The key to use next: not resting, not tried for this picture, the least busy, then the one used longest ago. */
function pickKey(keys, tried, now) {
  const usable = keys.filter((k) => !tried.has(k.id) && statusOf(k, now) === "ready");
  usable.sort((a, b) => (inFlight.get(a.id) ?? 0) - (inFlight.get(b.id) ?? 0) || new Date(a.lastUsedAt ?? 0) - new Date(b.lastUsedAt ?? 0) || (a.uses ?? 0) - (b.uses ?? 0));
  return usable[0] ?? null;
}

async function rest(key, reason, message) {
  const until = new Date(Date.now() + (reason === "quota" ? QUOTA_REST_MS : REFUSED_REST_MS));
  key.cooldownUntil = until; // this request's copy, so the next picture doesn't pick it again
  key.lastError = message;
  await PlatformAiModel.updateOne({ ...PLATFORM, "keys.id": key.id }, { $set: { "keys.$.cooldownUntil": until, "keys.$.lastError": message } });
}

/** One picture, on whichever key is free; a key that is used up or refused is rested and the NEXT key is tried. */
async function makeOne({ keys, model, prompt, aspectRatio }) {
  const tried = new Set();
  let last = null;
  for (;;) {
    const now = Date.now();
    const key = pickKey(keys, tried, now);
    if (!key) {
      if (last) throw last;
      const soonest = keys.filter((k) => k.enabled !== false && k.cooldownUntil).map((k) => new Date(k.cooldownUntil).getTime()).sort()[0];
      throw new AiError(
        soonest ? `Every Gemini key is resting after hitting its limit. The first is ready again in about ${Math.max(1, Math.ceil((soonest - now) / 60_000))} min — or add another key.` : "No Gemini key is switched on. Turn one on in the console (AI pictures).",
        { status: 429 },
      );
    }
    tried.add(key.id);
    inFlight.set(key.id, (inFlight.get(key.id) ?? 0) + 1);
    try {
      let plain;
      try {
        plain = decryptSecret(key.encryptedKey);
      } catch {
        await rest(key, "key", "This key can't be read any more — remove it and add it again.");
        last = new AiError("A saved key can't be read any more (the server's encryption key changed).", { reason: "key" });
        continue;
      }
      const made = await generateImage({ apiKey: plain, model, prompt, aspectRatio });
      key.uses = (key.uses ?? 0) + 1;
      key.lastUsedAt = new Date();
      await PlatformAiModel.updateOne({ ...PLATFORM, "keys.id": key.id }, { $inc: { "keys.$.uses": 1 }, $set: { "keys.$.lastUsedAt": key.lastUsedAt, "keys.$.lastError": "" } });
      return { ...made, keyLabel: key.label || key.keyHint };
    } catch (err) {
      if (err instanceof AiError && (err.reason === "quota" || err.reason === "key")) {
        await rest(key, err.reason, err.message);
        last = new AiError(`${err.message} (${key.label || key.keyHint})`, { status: err.status, reason: err.reason });
        continue; // another key may still have room
      }
      throw err;
    } finally {
      inFlight.set(key.id, Math.max(0, (inFlight.get(key.id) ?? 1) - 1));
    }
  }
}

/**
 * Make `count` pictures of one dish and add them to the dish.
 * Everything is checked BEFORE anything is spent. The pictures are made at the same time, each on a different key
 * where there are several, so one key's limit isn't what holds a batch up; each then goes through the normal upload
 * pipeline (resized, compressed, kept without a domain). Pictures that worked are kept even if another one fails.
 */
export async function generateItemImages(ctx, itemId, { aspectRatio, count, prompt }, userId) {
  if (!AI_ASPECT_RATIO_IDS.includes(aspectRatio)) throw new HttpError(400, "Choose one of the offered shapes.");
  if (!Number.isInteger(count) || count < 1 || count > AI_MAX_IMAGES_AT_ONCE) {
    throw new HttpError(400, `Make between 1 and ${AI_MAX_IMAGES_AT_ONCE} pictures at a time.`);
  }

  const item = await MenuItemModel.findOne(tenantFilter(ctx, { _id: itemId })).lean();
  if (!item) throw new HttpError(404, "Item not found");
  const room = IMAGE_RULES.maxPerItem - (item.images?.length ?? 0);
  if (room <= 0) throw new HttpError(409, `This dish already has ${IMAGE_RULES.maxPerItem} pictures. Remove one first.`);
  if (count > room) throw new HttpError(400, `Only ${room} more ${room === 1 ? "picture fits" : "pictures fit"} (a dish can have ${IMAGE_RULES.maxPerItem}).`);

  const doc = await load();
  const keys = (doc?.keys ?? []).map((k) => ({ ...k })); // this request's own copy; rests are noted on it as they happen
  if (keys.length === 0) throw new HttpError(409, "AI pictures aren't set up yet. Add a Gemini API key in the platform console → AI pictures.");
  const model = doc?.model || DEFAULT_AI_IMAGE_MODEL;

  let text = String(prompt ?? "").trim().slice(0, AI_MAX_PROMPT_LENGTH);
  if (!text) {
    const categories = await MenuCategoryModel.find(tenantFilter(ctx)).select("name parentId").lean();
    const tree = categories.map((c) => ({ id: String(c._id), name: c.name, parentId: c.parentId ?? null }));
    text = buildItemImagePrompt({ name: item.name, description: item.description, foodType: item.foodType, category: categoryPathLabel(tree, String(item.categoryId)) });
  }

  const results = await Promise.allSettled(
    Array.from({ length: count }, async (_, i) => {
      const angle = angleFor(i, count);
      const made = await makeOne({ keys, model, prompt: angle ? `${text} ${angle}` : text, aspectRatio });
      const stored = await putImage(ctx, { body: made.buffer, kind: "menu-items" });
      return { url: stored.url, key: stored.key, width: stored.width, height: stored.height, via: made.keyLabel };
    }),
  );

  const added = [];
  const failed = [];
  for (const r of results) {
    if (r.status === "fulfilled") added.push(r.value);
    else {
      const err = r.reason;
      const known = err instanceof AiError || err instanceof HttpError;
      if (!known) logger.error({ err: err?.message }, "ai picture failed");
      failed.push(known ? err.message : "Something went wrong while making this picture.");
    }
  }
  if (added.length === 0) {
    const first = results.find((r) => r.status === "rejected")?.reason;
    throw new HttpError(first instanceof AiError && (first.reason === "quota" || first.status === 429) ? 429 : 502, failed[0] ?? "No picture was made.");
  }

  const updated = await updateItem(ctx, itemId, { images: [...(item.images ?? []), ...added.map(({ via: _via, ...im }) => im)] });
  logger.info({ itemId, userId, model, made: added.length, failed: failed.length, aspectRatio, keysUsed: [...new Set(added.map((a) => a.via))].length }, "ai pictures added to a dish");
  return { item: updated, added: added.map(({ via: _via, ...im }) => im), usedKeys: [...new Set(added.map((a) => a.via))], failed, model };
}
