import {
  MARKETING_CHANNEL_HELP,
  MARKETING_CHANNEL_LABELS,
  MARKETING_CHANNELS,
  MARKETING_VARIABLES,
  marketingCampaignSchema,
  parseContacts,
  renderMarketing,
} from "@onetap/config-schema";
import { BrandModel, MarketingCampaignModel, MarketingContactModel, MarketingListModel, MarketingMessageModel, WaAccountModel } from "@onetap/db";
import { HttpError } from "../../middleware/error.js";
import { credentialsFor } from "../notify/notify.service.js";
import { providerFor } from "../notify/providers/index.js";
import { storePlan } from "../platform/plan.service.js";
import { cancelBroadcast, createBroadcast, listBroadcasts } from "../whatsapp/whatsapp.service.js";
import { buildAudience, requireSomeone } from "./audience.js";

/* ---------------------------------------------------------------- channels */

/**
 * Which of the three ways to reach customers this store can use right now — and, for the ones it can't, why and
 * where to fix it. Reading the credentials only checks that they're filled in; nothing is sent.
 */
export async function channelStatus(ctx) {
  const plan = await storePlan(ctx.brandId);
  const has = (f) => plan.entitlements.features.includes(f);
  const linked = await WaAccountModel.countDocuments({ brandId: ctx.brandId, status: { $in: ["connected", "disconnected"] } });

  const credReady = async (channel) => {
    const creds = await credentialsFor(ctx, channel).catch(() => ({}));
    return providerFor(channel).requiredFields.every((k) => Boolean(creds[k]));
  };
  const [smsReady, apiReady] = await Promise.all([credReady("sms"), credReady("whatsapp")]);

  const status = {
    "wa-linked": !has("whatsappChat")
      ? { ok: false, reason: "WhatsApp chat isn't included in your plan.", fix: null }
      : !linked
        ? { ok: false, reason: "No WhatsApp number is linked yet.", fix: "/whatsapp/numbers" }
        : { ok: true },
    sms: !has("notifications")
      ? { ok: false, reason: "WhatsApp & SMS alerts aren't included in your plan.", fix: null }
      : !smsReady
        ? { ok: false, reason: "Your SMS gateway isn't set up yet.", fix: "/notifications" }
        : { ok: true },
    "wa-api": !has("notifications")
      ? { ok: false, reason: "WhatsApp & SMS alerts aren't included in your plan.", fix: null }
      : !apiReady
        ? { ok: false, reason: "Your WhatsApp Business API isn't set up yet.", fix: "/notifications" }
        : { ok: true },
  };
  return MARKETING_CHANNELS.map((id) => ({ id, label: MARKETING_CHANNEL_LABELS[id], help: MARKETING_CHANNEL_HELP[id], ...status[id] }));
}

/* ------------------------------------------------------------------- lists */

export async function listLists(ctx) {
  const lists = await MarketingListModel.find({ brandId: ctx.brandId }).sort({ createdAt: -1 }).lean();
  return lists.map((l) => ({ id: String(l._id), name: l.name, count: l.count, createdAt: l.createdAt }));
}

async function recount(ctx, listId) {
  const count = await MarketingContactModel.countDocuments({ brandId: ctx.brandId, listId });
  await MarketingListModel.updateOne({ _id: listId, brandId: ctx.brandId }, { $set: { count } });
  return count;
}

/** Add people to a list from pasted text; people already in it are left alone. Returns what happened. */
export async function addToList(ctx, listId, text) {
  const list = await MarketingListModel.findOne({ _id: listId, brandId: ctx.brandId }).lean();
  if (!list) throw new HttpError(404, "List not found");
  const parsed = parseContacts(text);
  let added = 0;
  if (parsed.valid.length) {
    const have = new Set((await MarketingContactModel.find({ brandId: ctx.brandId, listId: String(listId), phone: { $in: parsed.valid.map((c) => c.phone) } }).select("phone").lean()).map((c) => c.phone));
    const fresh = parsed.valid.filter((c) => !have.has(c.phone));
    if (fresh.length) await MarketingContactModel.insertMany(fresh.map((c) => ({ brandId: ctx.brandId, listId: String(listId), phone: c.phone, name: c.name })));
    added = fresh.length;
    parsed.duplicates += parsed.valid.length - fresh.length;
  }
  await recount(ctx, String(listId));
  return { added, duplicates: parsed.duplicates, invalid: parsed.invalid.slice(0, 20), invalidCount: parsed.invalid.length };
}

export async function createList(ctx, { name, text }, userId) {
  const clean = String(name ?? "").trim();
  if (!clean) throw new HttpError(400, "Give the list a name");
  if (await MarketingListModel.exists({ brandId: ctx.brandId, name: clean })) throw new HttpError(409, "You already have a list with that name.");
  const list = await MarketingListModel.create({ brandId: ctx.brandId, name: clean, createdBy: userId });
  const result = text?.trim() ? await addToList(ctx, String(list._id), text) : { added: 0, duplicates: 0, invalid: [], invalidCount: 0 };
  return { list: { id: String(list._id), name: list.name, count: result.added, createdAt: list.createdAt }, result };
}

export async function getList(ctx, id) {
  const list = await MarketingListModel.findOne({ _id: id, brandId: ctx.brandId }).lean();
  if (!list) throw new HttpError(404, "List not found");
  const contacts = await MarketingContactModel.find({ brandId: ctx.brandId, listId: String(id) }).sort({ createdAt: -1 }).limit(500).lean();
  return { id: String(list._id), name: list.name, count: list.count, contacts: contacts.map((c) => ({ id: String(c._id), phone: c.phone, name: c.name })) };
}

export async function deleteList(ctx, id) {
  const list = await MarketingListModel.findOne({ _id: id, brandId: ctx.brandId }).lean();
  if (!list) throw new HttpError(404, "List not found");
  await MarketingContactModel.deleteMany({ brandId: ctx.brandId, listId: String(id) });
  await MarketingListModel.deleteOne({ _id: id, brandId: ctx.brandId });
}

export async function removeContact(ctx, listId, contactId) {
  await MarketingContactModel.deleteOne({ _id: contactId, brandId: ctx.brandId, listId: String(listId) });
  await recount(ctx, String(listId));
}

/* --------------------------------------------------------------- campaigns */

const templateWords = (template, person, storeName) =>
  (template.params ?? []).map((p) => (p.startsWith("text:") ? p.slice(5) : p === "customerName" ? person.name || MARKETING_VARIABLES[0].fallback : p === "storeName" ? storeName : ""));

/**
 * Send (queue) a campaign. Linked WhatsApp goes through the existing careful broadcast; SMS and the WhatsApp
 * Business API get one queued message per person, which the marketing worker sends a few at a time.
 */
export async function createCampaign(ctx, rawInput, userId) {
  const input = marketingCampaignSchema.parse(rawInput);
  const channel = (await channelStatus(ctx)).find((c) => c.id === input.channel);
  if (!channel?.ok) throw new HttpError(409, channel?.reason ?? "That channel isn't available.", { code: "channel_unavailable", fix: channel?.fix ?? null });

  const { people, counts } = await buildAudience(ctx, input.audience);
  requireSomeone(people);
  const brand = await BrandModel.findById(ctx.brandId).select("name").lean();
  const storeName = brand?.name ?? "";
  const campaign = await MarketingCampaignModel.create({
    brandId: ctx.brandId,
    name: input.name,
    channel: input.channel,
    message: input.message,
    template: input.template,
    audience: input.audience,
    breakdown: counts,
    total: people.length,
    createdBy: userId,
  });
  const campaignId = String(campaign._id);

  try {
    if (input.channel === "wa-linked") {
      const wa = await createBroadcast(ctx, { text: input.message, media: null, recipients: people.map((p) => ({ phone: p.phone, name: p.name, customerId: p.customerId })), storeName }, userId);
      await MarketingCampaignModel.updateOne({ _id: campaign._id, brandId: ctx.brandId }, { $set: { waCampaignId: wa.id } });
    } else {
      const rows = people.map((p) => ({
        brandId: ctx.brandId,
        campaignId,
        channel: input.channel,
        phone: p.phone,
        name: p.name,
        ...(input.channel === "sms" ? { text: renderMarketing(input.message, { customerName: p.name || "there", storeName }) } : { params: templateWords(input.template, p, storeName) }),
        status: "queued",
      }));
      for (let i = 0; i < rows.length; i += 1000) await MarketingMessageModel.insertMany(rows.slice(i, i + 1000));
    }
  } catch (e) {
    // nothing was queued — don't leave an empty "sending" campaign behind
    await MarketingCampaignModel.deleteOne({ _id: campaign._id, brandId: ctx.brandId });
    await MarketingMessageModel.deleteMany({ brandId: ctx.brandId, campaignId });
    throw e;
  }
  return getCampaign(ctx, campaignId);
}

async function figures(ctx, campaigns) {
  const waIds = campaigns.map((c) => c.waCampaignId).filter(Boolean);
  const wa = waIds.length ? new Map((await listBroadcasts(ctx)).filter((b) => waIds.includes(b.id)).map((b) => [b.id, b])) : new Map();
  const ids = campaigns.filter((c) => !c.waCampaignId).map((c) => String(c._id));
  const rows = ids.length ? await MarketingMessageModel.aggregate([{ $match: { brandId: ctx.brandId, campaignId: { $in: ids } } }, { $group: { _id: { c: "$campaignId", s: "$status" }, n: { $sum: 1 } } }]) : [];
  const by = {};
  for (const r of rows) (by[r._id.c] ??= {})[r._id.s] = r.n;

  return campaigns.map((c) => {
    const id = String(c._id);
    let sent;
    let waiting;
    let failed;
    let read = 0;
    let skipped = c.skipped ?? 0;
    if (c.waCampaignId) {
      const w = wa.get(c.waCampaignId);
      sent = w?.sent ?? 0;
      waiting = w?.waiting ?? 0;
      failed = w?.failed ?? 0;
      read = w?.read ?? 0;
      skipped += w?.skipped ?? 0;
    } else {
      const s = by[id] ?? {};
      sent = s.sent ?? 0;
      waiting = (s.queued ?? 0) + (s.sending ?? 0);
      failed = s.failed ?? 0;
    }
    const status = c.status === "cancelled" ? "cancelled" : waiting ? "sending" : "done";
    return {
      id,
      name: c.name,
      channel: c.channel,
      channelLabel: MARKETING_CHANNEL_LABELS[c.channel],
      message: c.message,
      template: c.template ?? null,
      createdAt: c.createdAt,
      status,
      total: c.total,
      sent,
      read,
      waiting,
      failed,
      skipped,
      breakdown: c.breakdown ?? null,
    };
  });
}

export async function listCampaigns(ctx) {
  const campaigns = await MarketingCampaignModel.find({ brandId: ctx.brandId }).sort({ createdAt: -1 }).limit(50).lean();
  return figures(ctx, campaigns);
}

export async function getCampaign(ctx, id) {
  const c = await MarketingCampaignModel.findOne({ _id: id, brandId: ctx.brandId }).lean();
  if (!c) throw new HttpError(404, "Campaign not found");
  const [row] = await figures(ctx, [c]);
  const problems = c.waCampaignId ? [] : (await MarketingMessageModel.find({ brandId: ctx.brandId, campaignId: String(id), status: "failed" }).limit(20).lean()).map((m) => ({ phone: m.phone, name: m.name, error: m.error }));
  return { ...row, problems };
}

export async function cancelCampaign(ctx, id) {
  const c = await MarketingCampaignModel.findOne({ _id: id, brandId: ctx.brandId }).lean();
  if (!c) throw new HttpError(404, "Campaign not found");
  if (c.waCampaignId) await cancelBroadcast(ctx, c.waCampaignId);
  else await MarketingMessageModel.deleteMany({ brandId: ctx.brandId, campaignId: String(id), status: "queued" });
  await MarketingCampaignModel.updateOne({ _id: id, brandId: ctx.brandId }, { $set: { status: "cancelled" } });
}
