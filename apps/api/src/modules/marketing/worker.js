import { smsNumber } from "@onetap/config-schema";
import { MarketingCampaignModel, MarketingMessageModel } from "@onetap/db";
import { env } from "../../env.js";
import { logger } from "../../logger.js";
import { credentialsFor } from "../notify/notify.service.js";
import { providerFor } from "../notify/providers/index.js";
import { storePlan } from "../platform/plan.service.js";

/**
 * Sends the queued SMS and WhatsApp Business API marketing messages, a few at a time. Runs in exactly ONE API
 * process (MARKETING_WORKER=on) — the same rule as the WhatsApp worker: a development API pointed at a shared
 * database must never send real messages to real customers. Every other process, and the dashboard, only queue
 * messages and read how they went.
 *
 * Pace: about 6 messages a second at most (one every ~150 ms); gateways and Meta have their own limits, and a
 * campaign is not a race.
 */
const TICK_MS = 1500;
const PER_TICK = 8;
const GAP_MS = 150;
const STUCK_MS = 2 * 60_000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let busy = false;
let timer = null;

export function startMarketingWorker() {
  if (env.MARKETING_WORKER !== "on") {
    logger.info("Marketing worker is off in this process (MARKETING_WORKER) — campaigns are queued for the one that runs it");
    return;
  }
  if (timer) return;
  timer = setInterval(() => {
    if (busy) return;
    busy = true;
    tick()
      .catch((err) => logger.error({ err }, "marketing worker tick failed"))
      .finally(() => { busy = false; });
  }, TICK_MS);
  timer.unref();
  logger.info("Marketing worker started");
}

/** exposed for tests */
export async function tick() {
  // a crash between "claimed" and "done" must not strand a message forever
  await MarketingMessageModel.updateMany({ status: "sending", updatedAt: { $lt: new Date(Date.now() - STUCK_MS) } }, { $set: { status: "queued" } }, { allowGlobalQuery: true });

  const cache = { brand: new Map(), campaign: new Map() };
  for (let i = 0; i < PER_TICK; i++) {
    const m = await MarketingMessageModel.findOneAndUpdate({ status: "queued" }, { $set: { status: "sending" } }, { sort: { createdAt: 1 }, new: true, allowGlobalQuery: true }).lean();
    if (!m) return;
    const result = await sendOne(m, cache).catch((e) => ({ ok: false, reason: e?.message || "Unexpected error" }));
    await MarketingMessageModel.updateOne(
      { _id: m._id, brandId: m.brandId },
      result.ok ? { $set: { status: "sent", sentAt: new Date(), providerMessageId: result.providerMessageId ?? "", error: "" } } : { $set: { status: "failed", error: String(result.reason ?? "The provider rejected the message").slice(0, 300) } },
    );
    await sleep(GAP_MS);
  }
}

async function sendOne(m, cache) {
  const ctx = { brandId: m.brandId };
  if (!cache.brand.has(m.brandId)) {
    const plan = await storePlan(m.brandId);
    cache.brand.set(m.brandId, { ok: plan.entitlements.features.includes("notifications") && !plan.disabled, sms: null, whatsapp: null });
  }
  const brand = cache.brand.get(m.brandId);
  if (!brand.ok) return { ok: false, reason: "Not allowed: the store's plan doesn't include SMS / WhatsApp sending (or the store is switched off)." };

  const channelKey = m.channel === "sms" ? "sms" : "whatsapp";
  if (!brand[channelKey]) brand[channelKey] = await credentialsFor(ctx, channelKey);
  const creds = brand[channelKey];
  const provider = providerFor(channelKey);
  const missing = provider.requiredFields.filter((f) => !creds[f]);
  if (missing.length) return { ok: false, reason: `${channelKey === "sms" ? "SMS" : "WhatsApp Business API"} isn't fully set up (missing ${missing.join(", ")}).` };

  if (m.channel === "sms") return provider.send(creds, { to: smsNumber(m.phone), event: "marketing", values: {}, message: m.text });

  const key = `${m.brandId}:${m.campaignId}`;
  if (!cache.campaign.has(key)) cache.campaign.set(key, await MarketingCampaignModel.findOne({ _id: m.campaignId, brandId: m.brandId }).select("template").lean());
  const template = cache.campaign.get(key)?.template;
  if (!template?.name) return { ok: false, reason: "The campaign has no WhatsApp template." };
  return provider.send(creds, { to: m.phone, event: "marketing", values: {}, whatsapp: { templateName: template.name, languageCode: template.language || "en", params: m.params ?? [] } });
}
