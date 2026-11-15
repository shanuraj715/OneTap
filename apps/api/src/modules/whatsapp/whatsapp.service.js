import {
  formatINR,
  normalizeWaPhone,
  ORDER_STATUS_LABELS,
  renderTemplate,
  WA_DELEGABLE_ROLES,
  WA_FOLLOW_UP_HOURS,
  WA_OPT_OUT_FOOTER,
  WA_ORDER_DEFAULT_BODY,
  WA_PACING,
  waAccessSchema,
  waLocalClock,
  waLevelAtLeast,
  waMediaTypeOf,
  planWaDistribution,
  renderMarketing,
  WA_NUMBER_COLORS,
  WA_REVOKE_HOURS,
} from "@onetap/config-schema";
import { BrandModel, CustomerModel, WaAccountModel, WaCampaignModel, WaChatModel, WaMessageModel } from "@onetap/db";
import { logger } from "../../logger.js";
import { HttpError } from "../../middleware/error.js";
import { requireOutletContext } from "../../middleware/auth.js";
import { storePlan } from "../platform/plan.service.js";
import { removeObject } from "../storage/storage.service.js";

/** A number counts as online while the worker has touched it recently. */
const ONLINE_MS = 90_000;
export const isOnline = (a) => a?.status === "connected" && a.seenAt && Date.now() - new Date(a.seenAt).getTime() < ONLINE_MS;

/* ------------------------------------------------------------------ access */

/**
 * Who may do what with the store's chats. The owner: everything. The platform super admin: read. Other roles:
 * whatever the owner gave them (nothing by default). The plan must include "WhatsApp chat".
 */
export async function waContext(req, needed) {
  const ctx = await requireOutletContext(req);
  const plan = await storePlan(ctx.brandId);
  if (!plan.entitlements.features.includes("whatsappChat")) throw new HttpError(403, "WhatsApp chat isn't included in your plan.", { code: "not_in_plan" });
  const level = await levelFor(req.user, ctx.brandId);
  if (!waLevelAtLeast(level, needed)) {
    throw new HttpError(403, needed === "manage" ? "Only the store owner can do this." : "Your role can't use WhatsApp chat — the owner can give access in WhatsApp → Access.");
  }
  return { ctx: { brandId: ctx.brandId, outletId: ctx.outletId }, level, userId: String(req.user._id ?? req.user.id) };
}

export async function levelFor(user, brandId) {
  if (user.isSuperAdmin) return "read";
  const m = user.memberships.find((x) => x.brandId === brandId);
  if (!m) return "none";
  if (m.role === "owner") return "manage";
  const brand = await BrandModel.findById(brandId).select("whatsapp").lean();
  return brand?.whatsapp?.access?.[m.role] ?? "none";
}

export async function getAccess(ctx) {
  const brand = await BrandModel.findById(ctx.brandId).select("whatsapp").lean();
  return waAccessSchema.parse(brand?.whatsapp?.access ?? {});
}

export async function setAccess(ctx, access) {
  const clean = waAccessSchema.parse(access);
  // `whatsapp` starts out null on every store, and MongoDB can't set a field inside null — write the whole object
  const brand = await BrandModel.findById(ctx.brandId).select("whatsapp").lean();
  await BrandModel.updateOne({ _id: ctx.brandId }, { $set: { whatsapp: { ...(brand?.whatsapp ?? {}), access: clean } } });
  return clean;
}

/* ---------------------------------------------------------------- accounts */

const shapeAccount = (a, { withQr = false, index = 0 } = {}) => {
  const { day } = waLocalClock();
  return {
    id: String(a._id),
    label: a.label,
    // numbers linked before colours existed get a steady one from the palette
    color: a.color || WA_NUMBER_COLORS[index % WA_NUMBER_COLORS.length],
    phone: a.phone,
    pushName: a.pushName,
    status: a.status === "connected" && !isOnline(a) ? "disconnected" : a.status,
    online: isOnline(a),
    seenAt: a.seenAt ?? null,
    linkedAt: a.linkedAt ?? null,
    lastError: a.lastError || "",
    qr: withQr && a.status === "pending" ? a.qr : "",
    qrAt: withQr ? (a.qrAt ?? null) : null,
    newToday: a.coldDay === day ? a.coldCount : 0,
    newPerDay: WA_PACING.cold.perDay,
    ordersToday: a.orderDay === day ? a.orderCount : 0,
    ordersPerDay: WA_PACING.order.perDay,
  };
};

export async function listAccounts(ctx, { withQr = false } = {}) {
  const docs = await WaAccountModel.find({ brandId: ctx.brandId }).sort({ createdAt: 1 }).lean();
  return docs.map((a, index) => shapeAccount(a, { withQr, index }));
}

async function accountOf(ctx, id) {
  if (!/^[0-9a-f]{24}$/i.test(String(id))) throw new HttpError(404, "That number isn't linked to this store.");
  const a = await WaAccountModel.findOne({ _id: id, brandId: ctx.brandId }).lean();
  if (!a) throw new HttpError(404, "That number isn't linked to this store.");
  return a;
}

export async function createAccount(ctx, { label, color: chosen }, userId) {
  const count = await WaAccountModel.countDocuments({ brandId: ctx.brandId });
  if (count >= 10) throw new HttpError(400, "A store can link up to 10 numbers.");
  const used = new Set((await listAccounts(ctx)).map((x) => x.color.toUpperCase()));
  const color = chosen?.toUpperCase() || (WA_NUMBER_COLORS.find((c) => !used.has(c.toUpperCase())) ?? WA_NUMBER_COLORS[count % WA_NUMBER_COLORS.length]);
  const a = await WaAccountModel.create({ brandId: ctx.brandId, label: label.trim(), color, status: "pending", createdBy: userId });
  return shapeAccount(a.toObject(), { withQr: true });
}

export async function getAccount(ctx, id) {
  const all = await listAccounts(ctx, { withQr: true });
  const a = all.find((x) => x.id === String(id));
  if (!a) throw new HttpError(404, "That number isn't linked to this store.");
  return a;
}

export async function updateAccount(ctx, id, { label, color }) {
  await accountOf(ctx, id);
  const set = {};
  if (label !== undefined) set.label = label.trim();
  if (color !== undefined) set.color = color.toUpperCase();
  await WaAccountModel.updateOne({ _id: id, brandId: ctx.brandId }, { $set: set });
  return getAccount(ctx, id);
}

/** A fresh QR for a number that was unlinked or never scanned. */
export async function relinkAccount(ctx, id) {
  const a = await accountOf(ctx, id);
  if (!["logged_out", "expired"].includes(a.status)) throw new HttpError(409, "This number is still linked.");
  await WaAccountModel.updateOne({ _id: id, brandId: ctx.brandId }, { $set: { status: "pending", qr: "", qrAt: null, lastError: "" } });
  return getAccount(ctx, id);
}

export async function unlinkAccount(ctx, id) {
  await accountOf(ctx, id);
  await WaAccountModel.updateOne({ _id: id, brandId: ctx.brandId }, { $set: { wantsLogout: true } });
  return getAccount(ctx, id);
}

/** What a number says after the store lost WhatsApp chat (shown on its card). Starts with "WhatsApp chat" — the worker keeps it. */
export const WA_SWITCHED_OFF = "WhatsApp chat isn't in this store's plan any more, so the number was unlinked. Link it again once chat is back.";

/**
 * The store no longer has WhatsApp chat: unlink EVERY one of its numbers at once and fail whatever was waiting to go
 * out. The dashboard shows them as "Unlinked" straight away; the worker (which holds the live connection to WhatsApp,
 * maybe in another process) sees `wantsLogout`, closes the connection, and logs the number out on the phone too.
 * The chats and messages already stored are kept — nothing is deleted.
 */
export async function revokeStore(brandId) {
  const live = ["pending", "connected", "disconnected"];
  const numbers = await WaAccountModel.updateMany(
    { brandId: String(brandId), $or: [{ status: { $in: live } }, { wantsLogout: true }] },
    { $set: { status: "logged_out", wantsLogout: true, qr: "", lastError: WA_SWITCHED_OFF } },
  );
  const messages = await WaMessageModel.updateMany(
    { brandId: String(brandId), status: { $in: ["queued", "sending"] } },
    { $set: { status: "failed", error: "WhatsApp chat was switched off for this store." } },
  );
  return { numbers: numbers.modifiedCount, messages: messages.modifiedCount };
}

/** Call whenever a store's plan or unlocks change: if it no longer has WhatsApp chat, its numbers are unlinked right now. */
export async function enforceWhatsAppPlan(brandId) {
  const plan = await storePlan(String(brandId));
  if (plan.entitlements.features.includes("whatsappChat")) return false;
  const r = await revokeStore(brandId);
  return r.numbers + r.messages > 0;
}

export async function removeAccount(ctx, id) {
  const a = await accountOf(ctx, id);
  if (["connected", "disconnected"].includes(a.status) && !a.wantsLogout) throw new HttpError(409, "Unlink the number first.");
  await WaAccountModel.deleteOne({ _id: id, brandId: ctx.brandId });
  // anything still waiting to go out from it waits for whichever number the chat gets next
  await WaMessageModel.updateMany({ brandId: ctx.brandId, accountId: id, status: "queued" }, { $set: { status: "failed", error: "The number it was going out from was removed." } });
  await WaChatModel.updateMany({ brandId: ctx.brandId, accountId: id }, { $set: { accountId: null } });
}

/** The online number with the most first-contact room left today (spreads new contacts across numbers). */
async function pickOnlineAccount(ctx) {
  const { day } = waLocalClock();
  const online = (await WaAccountModel.find({ brandId: ctx.brandId, status: "connected" }).lean()).filter(isOnline);
  online.sort((a, b) => (a.coldDay === day ? a.coldCount : 0) - (b.coldDay === day ? b.coldCount : 0));
  return online[0] ?? null;
}

/* ------------------------------------------------------------------- chats */

const shapeChat = (c, labels) => ({
  id: String(c._id),
  phone: c.phone,
  name: c.name,
  accountId: c.accountId,
  accountLabel: c.accountId ? (labels.get(c.accountId)?.label ?? "Removed number") : null,
  accountColor: c.accountId ? (labels.get(c.accountId)?.color ?? null) : null,
  lastMessageAt: c.lastMessageAt ?? c.createdAt,
  lastPreview: c.lastPreview,
  lastDirection: c.lastDirection,
  unread: c.unread ?? 0,
  optedOut: Boolean(c.optedOut),
  hasReplied: Boolean(c.lastInboundAt),
});

async function labelsOf(brandId) {
  const accounts = await listAccounts({ brandId });
  return new Map(accounts.map((a) => [a.id, { label: a.label, color: a.color }]));
}

/**
 * view:      all | unread | needs-reply (the customer wrote last) | new (they never wrote to us) | opted-out
 * accountId: only chats that go out from this linked number ("none" = no number yet)
 */
export async function listChats(ctx, { q = "", unread = false, view = "all", accountId = "", limit = 200 } = {}) {
  const filter = { brandId: ctx.brandId };
  const term = q.trim();
  if (term) {
    const digits = term.replace(/\D/g, "");
    const rx = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ name: rx }, ...(digits.length >= 3 ? [{ phone: new RegExp(digits) }] : [])];
  }
  if (unread || view === "unread") filter.unread = { $gt: 0 };
  if (view === "needs-reply") filter.lastDirection = "in";
  if (view === "new") filter.lastInboundAt = null;
  if (view === "opted-out") filter.optedOut = true;
  if (accountId === "none") filter.accountId = null;
  else if (/^[0-9a-f]{24}$/i.test(accountId)) filter.accountId = accountId;
  const [chats, labels] = await Promise.all([WaChatModel.find(filter).sort({ lastMessageAt: -1, createdAt: -1 }).limit(Math.min(500, limit)).lean(), labelsOf(ctx.brandId)]);
  return chats.map((c) => shapeChat(c, labels));
}

async function chatOf(ctx, id) {
  if (!/^[0-9a-f]{24}$/i.test(String(id))) throw new HttpError(404, "Chat not found");
  const c = await WaChatModel.findOne({ _id: id, brandId: ctx.brandId }).lean();
  if (!c) throw new HttpError(404, "Chat not found");
  return c;
}

export async function getChat(ctx, id) {
  return shapeChat(await chatOf(ctx, id), await labelsOf(ctx.brandId));
}

const shapeMessage = (m) => ({
  id: String(m._id),
  direction: m.direction,
  type: m.type,
  text: m.text,
  media: m.media ?? null,
  status: m.status,
  source: m.source,
  pace: m.pace,
  sendAfter: m.status === "queued" ? m.sendAfter : null,
  error: m.error || "",
  accountId: m.accountId,
  at: m.at,
  deleted: Boolean(m.deleted),
  revoke: m.revoke || "",
  revokeError: m.revokeError || "",
  // ours, delivered by WhatsApp, recent enough to be deleted for everyone
  canRevoke: canRevoke(m),
});

const canRevoke = (m) =>
  m.direction === "out" && !m.deleted && Boolean(m.waId) && ["sent", "delivered", "read"].includes(m.status) && (!m.revoke || m.revoke === "failed") && Date.now() - new Date(m.at).getTime() < WA_REVOKE_HOURS * 3600_000;

export async function listMessages(ctx, chatId, { before, limit = 80 } = {}) {
  await chatOf(ctx, chatId);
  const filter = { brandId: ctx.brandId, chatId: String(chatId) };
  if (before) filter.at = { $lt: new Date(before) };
  const docs = await WaMessageModel.find(filter).sort({ at: -1 }).limit(Math.min(200, limit)).lean();
  return docs.reverse().map(shapeMessage);
}

export const unreadChatCount = (ctx) => WaChatModel.countDocuments({ brandId: ctx.brandId, unread: { $gt: 0 } });

export async function markRead(ctx, chatId) {
  await WaChatModel.updateOne({ _id: chatId, brandId: ctx.brandId }, { $set: { unread: 0 } });
}

export async function startChat(ctx, { phone, name }) {
  const p = normalizeWaPhone(phone);
  if (!p) throw new HttpError(400, "Enter a mobile number with its country code, or a 10-digit Indian number.");
  const customer = await CustomerModel.findOne({ brandId: ctx.brandId, phone: { $in: [p, p.slice(2), `+${p}`] } }).lean();
  const chat = await WaChatModel.findOneAndUpdate(
    { brandId: ctx.brandId, phone: p },
    { $setOnInsert: { brandId: ctx.brandId, phone: p, name: (name || customer?.name || "").trim().slice(0, 80), customerId: customer ? String(customer._id) : null } },
    { upsert: true, new: true },
  ).lean();
  return getChat(ctx, chat._id);
}

/** When a chat leaves its number, remember which number the customer was talking to (older chats don't record it). */
const movedFrom = (chat) => (chat.lastInboundAt && !chat.lastInboundAccountId && chat.accountId ? { lastInboundAccountId: String(chat.accountId) } : {});

export async function updateChat(ctx, chatId, { name, accountId }) {
  const current = await chatOf(ctx, chatId);
  const set = {};
  if (typeof name === "string") set.name = name.trim().slice(0, 80);
  if (accountId !== undefined) {
    if (accountId !== null) await accountOf(ctx, accountId);
    set.accountId = accountId;
    Object.assign(set, movedFrom(current));
    // still-waiting messages follow the chat to its new number
    await WaMessageModel.updateMany({ brandId: ctx.brandId, chatId: String(chatId), status: "queued" }, { $set: { accountId } });
  }
  await WaChatModel.updateOne({ _id: chatId, brandId: ctx.brandId }, { $set: set });
  return getChat(ctx, chatId);
}

async function dropMessages(ctx, filter) {
  const withMedia = await WaMessageModel.find({ ...filter, "media.key": { $nin: [null, ""] } }).select("media").lean();
  await WaMessageModel.deleteMany(filter);
  for (const m of withMedia) void removeObject(ctx, m.media.key);
}

export async function clearChat(ctx, chatId) {
  await chatOf(ctx, chatId);
  await dropMessages(ctx, { brandId: ctx.brandId, chatId: String(chatId) });
  await WaChatModel.updateOne({ _id: chatId, brandId: ctx.brandId }, { $set: { lastPreview: "", unread: 0 } });
}

export async function deleteChat(ctx, chatId) {
  await chatOf(ctx, chatId);
  await dropMessages(ctx, { brandId: ctx.brandId, chatId: String(chatId) });
  await WaChatModel.deleteOne({ _id: chatId, brandId: ctx.brandId });
}

/**
 * everyone=false: remove it from the dashboard only (a message still waiting is simply cancelled).
 * everyone=true:  ask the worker to delete it on WhatsApp for both sides (ours, sent, within WA_REVOKE_HOURS).
 */
export async function deleteMessage(ctx, chatId, messageId, { everyone = false } = {}) {
  await chatOf(ctx, chatId);
  if (!/^[0-9a-f]{24}$/i.test(String(messageId))) throw new HttpError(404, "Message not found");
  const m = await WaMessageModel.findOne({ _id: messageId, brandId: ctx.brandId, chatId: String(chatId) }).lean();
  if (!m) throw new HttpError(404, "Message not found");
  if (!everyone) {
    await dropMessages(ctx, { brandId: ctx.brandId, chatId: String(chatId), _id: messageId });
    return { deleted: "dashboard" };
  }
  if (!canRevoke(m)) {
    throw new HttpError(409, m.direction !== "out" ? "Only your own messages can be deleted for everyone." : `Only a sent message from the last ${WA_REVOKE_HOURS} hours can be deleted for everyone.`);
  }
  await WaMessageModel.updateOne({ _id: messageId, brandId: ctx.brandId }, { $set: { revoke: "requested", revokeError: "" } });
  return { deleted: "everyone-requested" };
}

export async function retryMessage(ctx, chatId, messageId) {
  const r = await WaMessageModel.updateOne({ _id: messageId, brandId: ctx.brandId, chatId: String(chatId), status: "failed" }, { $set: { status: "queued", error: "", sendAfter: new Date() } });
  if (!r.matchedCount) throw new HttpError(404, "Only a failed message can be sent again.");
}

/* ----------------------------------------------------------------- sending */

/**
 * How hard to pace a message to this chat from `accountId`: a conversation the customer is part of goes at human
 * speed — but only from the number they wrote to. Moved to another number, it's a first contact for that number.
 */
const talkedTo = (chat, accountId) => Boolean(chat.lastInboundAt) && (!chat.lastInboundAccountId || String(chat.lastInboundAccountId) === String(accountId));
function paceFor(chat, source, accountId) {
  if (source === "order") return talkedTo(chat, accountId) ? "warm" : "order";
  if (talkedTo(chat, accountId)) return "warm";
  if (source === "chat" && String(chat.accountId) === String(accountId) && chat.lastOutboundAt && Date.now() - new Date(chat.lastOutboundAt) < WA_FOLLOW_UP_HOURS * 3600_000) return "warm";
  return "cold";
}

/**
 * Queue a message in a chat. It goes out from the chat's own number. If that number is offline the caller gets a
 * 409 listing the numbers that ARE online, and can send again naming one (which then becomes the chat's number).
 */
export async function sendMessage(ctx, chatId, { text, media, accountId }, userId) {
  const chat = await chatOf(ctx, chatId);
  let account = null;
  if (accountId) {
    account = await accountOf(ctx, accountId);
    if (!isOnline(account)) throw await offline(ctx, account);
  } else if (chat.accountId) {
    account = await WaAccountModel.findOne({ _id: chat.accountId, brandId: ctx.brandId }).lean();
    if (!isOnline(account)) throw await offline(ctx, account);
  } else {
    account = await pickOnlineAccount(ctx);
    if (!account) throw new HttpError(409, "No WhatsApp number is connected. Link one in WhatsApp → Numbers.", { code: "no_number" });
  }
  const id = String(account._id);
  const pace = paceFor(chat, "chat", id);
  if (chat.accountId !== id) await WaChatModel.updateOne({ _id: chat._id, brandId: ctx.brandId }, { $set: { accountId: id, ...movedFrom(chat) } });
  const msg = await WaMessageModel.create({
    brandId: ctx.brandId,
    chatId: String(chat._id),
    accountId: id,
    direction: "out",
    type: media ? waMediaTypeOf(media.mime) : "text",
    text: text.trim(),
    media,
    status: "queued",
    source: "chat",
    pace,
    sentBy: userId,
  });
  await WaChatModel.updateOne(
    { _id: chat._id, brandId: ctx.brandId },
    { $set: { lastMessageAt: new Date(), lastDirection: "out", lastPreview: (text.trim() || "📎 attachment").slice(0, 120) } },
  );
  return shapeMessage(msg.toObject());
}

async function offline(ctx, account) {
  const others = (await WaAccountModel.find({ brandId: ctx.brandId, status: "connected" }).lean()).filter(isOnline).filter((a) => String(a._id) !== String(account?._id));
  return new HttpError(
    409,
    account ? `${account.label} isn't connected right now.` : "The number this chat used was removed.",
    { code: "number_offline", account: account ? { id: String(account._id), label: account.label } : null, others: others.map((a) => ({ id: String(a._id), label: a.label, phone: a.phone })) },
  );
}

/* --------------------------------------------------------------- broadcasts */

async function audience(ctx) {
  const customers = await CustomerModel.find({ brandId: ctx.brandId, phone: { $nin: [null, ""] } }).select("phone name").lean();
  const seen = new Map();
  for (const c of customers) {
    const p = normalizeWaPhone(c.phone);
    if (p && !seen.has(p)) seen.set(p, c);
  }
  const optedOut = new Set((await WaChatModel.find({ brandId: ctx.brandId, optedOut: true }).select("phone").lean()).map((c) => c.phone));
  const list = [...seen.entries()].filter(([p]) => !optedOut.has(p));
  return { list, optedOut: [...seen.keys()].filter((p) => optedOut.has(p)).length };
}

export async function broadcastPreview(ctx) {
  const { list, optedOut } = await audience(ctx);
  const chats = await WaChatModel.find({ brandId: ctx.brandId, phone: { $in: list.map(([p]) => p) } }).select("phone lastInboundAt").lean();
  const replied = new Set(chats.filter((c) => c.lastInboundAt).map((c) => c.phone));
  const online = (await WaAccountModel.find({ brandId: ctx.brandId, status: "connected" }).lean()).filter(isOnline);
  const cold = list.filter(([p]) => !replied.has(p)).length;
  const perDay = Math.max(1, online.length) * WA_PACING.cold.perDay;
  return {
    recipients: list.length,
    optedOut,
    running: list.length - cold,
    firstContact: cold,
    numbersOnline: online.map((a) => ({ id: String(a._id), label: a.label })),
    estimatedDays: online.length ? Math.max(1, Math.ceil(cold / perDay)) : null,
  };
}

/**
 * Queue an offer / announcement to every customer with a phone number who hasn't said STOP. Someone with a chat
 * gets it from that chat's number (it waits for that number if it's offline); everyone else is spread across the
 * numbers that are online. First contacts are paced (WA_PACING.cold), so a big list takes days.
 */
export async function createBroadcast(ctx, { text, media, recipients, storeName = "" }, userId) {
  // Marketing hands over the exact people (already narrowed by its filters, opted-out numbers already left out);
  // without them this is the original "everyone who has ordered" broadcast.
  const { list, optedOut } = recipients
    ? { list: recipients.map((r) => [r.phone, { _id: r.customerId, name: r.name }]), optedOut: 0 }
    : await audience(ctx);
  if (!list.length) throw new HttpError(400, "There's nobody to send it to yet — customers appear here once they've ordered with a phone number.");
  const online = (await WaAccountModel.find({ brandId: ctx.brandId, status: "connected" }).lean()).filter(isOnline);
  const anyAccount = await WaAccountModel.exists({ brandId: ctx.brandId, status: { $in: ["connected", "disconnected"] } });
  if (!online.length && !anyAccount) throw new HttpError(409, "No WhatsApp number is linked. Link one in WhatsApp → Numbers.", { code: "no_number" });

  const body = `${text.trim()}\n\n${WA_OPT_OUT_FOOTER}`;
  // {{customerName}} / {{storeName}} become each person's own words (only when the sender asked for it)
  const bodyFor = (customer) => (recipients ? `${renderMarketing(text.trim(), { customerName: customer.name || "there", storeName })}\n\n${WA_OPT_OUT_FOOTER}` : body);
  const campaign = await WaCampaignModel.create({ brandId: ctx.brandId, text: body, media, total: list.length, skipped: optedOut, createdBy: userId });
  const campaignId = String(campaign._id);
  let rr = 0;
  const docs = [];
  for (const [phone, customer] of list) {
    const chat = await WaChatModel.findOneAndUpdate(
      { brandId: ctx.brandId, phone },
      { $setOnInsert: { brandId: ctx.brandId, phone, name: (customer.name ?? "").slice(0, 80), ...(customer._id ? { customerId: String(customer._id) } : {}) } },
      { upsert: true, new: true },
    ).lean();
    let accountId = chat.accountId;
    if (!accountId) {
      if (!online.length) continue; // nobody online to start a new conversation from — counted as not sent
      accountId = String(online[rr++ % online.length]._id);
      await WaChatModel.updateOne({ _id: chat._id, brandId: ctx.brandId }, { $set: { accountId } });
    }
    docs.push({
      brandId: ctx.brandId,
      chatId: String(chat._id),
      accountId,
      direction: "out",
      type: media ? waMediaTypeOf(media.mime) : "text",
      text: bodyFor(customer),
      media,
      status: "queued",
      source: "broadcast",
      pace: talkedTo(chat, accountId) ? "warm" : "cold",
      campaignId,
      sentBy: userId,
    });
  }
  if (docs.length) await WaMessageModel.insertMany(docs);
  if (docs.length < list.length) await WaCampaignModel.updateOne({ _id: campaign._id, brandId: ctx.brandId }, { $inc: { skipped: list.length - docs.length } });
  return (await listBroadcasts(ctx)).find((c) => c.id === campaignId);
}

export async function listBroadcasts(ctx) {
  const campaigns = await WaCampaignModel.find({ brandId: ctx.brandId }).sort({ createdAt: -1 }).limit(30).lean();
  const ids = campaigns.map((c) => String(c._id));
  const counts = await WaMessageModel.aggregate([{ $match: { brandId: ctx.brandId, campaignId: { $in: ids } } }, { $group: { _id: { c: "$campaignId", s: "$status" }, n: { $sum: 1 } } }]);
  const by = {};
  for (const r of counts) (by[r._id.c] ??= {})[r._id.s] = r.n;
  return campaigns.map((c) => {
    const s = by[String(c._id)] ?? {};
    const waiting = (s.queued ?? 0) + (s.sending ?? 0);
    const sent = (s.sent ?? 0) + (s.delivered ?? 0) + (s.read ?? 0);
    return {
      id: String(c._id),
      text: c.text,
      media: c.media ?? null,
      createdAt: c.createdAt,
      status: c.status === "cancelled" ? "cancelled" : waiting ? "sending" : "done",
      total: c.total,
      skipped: c.skipped,
      waiting,
      sent,
      read: s.read ?? 0,
      failed: s.failed ?? 0,
    };
  });
}

export async function cancelBroadcast(ctx, id) {
  const c = await WaCampaignModel.findOne({ _id: id, brandId: ctx.brandId }).lean();
  if (!c) throw new HttpError(404, "Broadcast not found");
  await WaMessageModel.deleteMany({ brandId: ctx.brandId, campaignId: String(id), status: "queued" });
  await WaCampaignModel.updateOne({ _id: id, brandId: ctx.brandId }, { $set: { status: "cancelled" } });
}

/* ------------------------------------------------------------ order updates */

/**
 * "Your order is ready" from the store's linked number, when the outlet switched it on for this status. Never
 * throws — an order must go through whatever happens here.
 */
export async function queueOrderUpdate(ctx, order, status, config) {
  try {
    const settings = config.orderNotify?.linked;
    if (!settings?.enabled || !settings.events.includes(status)) return;
    if (!(await storePlan(ctx.brandId)).entitlements.features.includes("whatsappChat")) return;
    const phone = normalizeWaPhone(order.customer?.phone);
    if (!phone) return;
    if (!(await WaAccountModel.exists({ brandId: ctx.brandId, status: { $in: ["connected", "disconnected"] } }))) return;

    const chat = await WaChatModel.findOneAndUpdate(
      { brandId: ctx.brandId, phone },
      { $setOnInsert: { brandId: ctx.brandId, phone, name: (order.customer?.name ?? "").slice(0, 80) } },
      { upsert: true, new: true },
    ).lean();
    let accountId = chat.accountId;
    if (!accountId) {
      const a = await pickOnlineAccount(ctx);
      if (!a) return;
      accountId = String(a._id);
      await WaChatModel.updateOne({ _id: chat._id, brandId: ctx.brandId }, { $set: { accountId } });
    }
    const body = settings.templates?.[status]?.body?.trim() || WA_ORDER_DEFAULT_BODY;
    const text = renderTemplate(body, {
      customerName: order.customer?.name || "there",
      orderNumber: order.orderNumber,
      statusLabel: ORDER_STATUS_LABELS[status],
      amount: formatINR(order.totals?.grandTotal ?? 0),
      outletName: config.identity?.name ?? "",
    });
    await WaMessageModel.create({
      brandId: ctx.brandId,
      chatId: String(chat._id),
      accountId,
      direction: "out",
      type: "text",
      text,
      status: "queued",
      source: "order",
      pace: paceFor({ ...chat, accountId }, "order", accountId),
      orderId: String(order._id),
    });
  } catch (err) {
    logger.error({ err, orderId: String(order?._id) }, "whatsapp: couldn't queue an order update");
  }
}

export const DELEGABLE_ROLES = WA_DELEGABLE_ROLES;

/* -------------------------------------------------------------- statistics */

/** Per linked number: its chats, how many of those customers wrote to it, unread, and 7 days of messages. */
export async function numberStats(ctx) {
  const since = new Date(Date.now() - 7 * 86400_000);
  const [accounts, chatAgg, msgAgg] = await Promise.all([
    listAccounts(ctx),
    WaChatModel.aggregate([
      { $match: { brandId: ctx.brandId } },
      {
        $group: {
          _id: "$accountId",
          chats: { $sum: 1 },
          replied: { $sum: { $cond: [{ $ifNull: ["$lastInboundAt", false] }, 1, 0] } },
          unread: { $sum: { $cond: [{ $gt: ["$unread", 0] }, 1, 0] } },
          optedOut: { $sum: { $cond: ["$optedOut", 1, 0] } },
        },
      },
    ]),
    WaMessageModel.aggregate([
      { $match: { brandId: ctx.brandId, at: { $gte: since } } },
      { $group: { _id: { a: "$accountId", d: "$direction", s: "$status" }, n: { $sum: 1 } } },
    ]),
  ]);
  const chatsBy = new Map(chatAgg.map((r) => [r._id ? String(r._id) : "none", r]));
  const week = {};
  for (const r of msgAgg) {
    const k = r._id.a ? String(r._id.a) : "none";
    const w = (week[k] ??= { sent: 0, received: 0, waiting: 0, failed: 0 });
    if (r._id.d === "in") w.received += r.n;
    else if (["sent", "delivered", "read"].includes(r._id.s)) w.sent += r.n;
    else if (["queued", "sending"].includes(r._id.s)) w.waiting += r.n;
    else if (r._id.s === "failed") w.failed += r.n;
  }
  const row = (k) => {
    const c = chatsBy.get(k) ?? {};
    return { chats: c.chats ?? 0, replied: c.replied ?? 0, unread: c.unread ?? 0, optedOut: c.optedOut ?? 0, week: week[k] ?? { sent: 0, received: 0, waiting: 0, failed: 0 } };
  };
  const numbers = accounts.map((a) => ({ id: a.id, label: a.label, color: a.color, status: a.status, online: a.online, ...row(a.id) }));
  const knownIds = new Set(accounts.map((a) => a.id));
  // chats whose number was removed count with "no number"
  const orphan = [...chatsBy.entries()].filter(([k]) => k !== "none" && !knownIds.has(k)).reduce((n, [, r]) => n + r.chats, 0);
  const none = row("none");
  return { numbers, unassigned: none.chats + orphan, total: numbers.reduce((n, x) => n + x.chats, 0) + none.chats + orphan };
}

/* ------------------------------------------------------------- distribution */

const LINKED = ["connected", "disconnected"];

async function distributionPlan(ctx, { share, giveAway = [] }) {
  const accounts = await WaAccountModel.find({ brandId: ctx.brandId }).lean();
  const byId = new Map(accounts.map((a) => [String(a._id), a]));
  for (const id of share) if (!byId.has(String(id)) || !LINKED.includes(byId.get(String(id)).status)) throw new HttpError(400, "Only linked numbers can take chats.");
  for (const id of giveAway) if (!byId.has(String(id))) throw new HttpError(400, "That number isn't linked to this store.");
  // chats on a removed number count as having none
  const chats = (await WaChatModel.find({ brandId: ctx.brandId }).select("accountId lastInboundAt lastInboundAccountId lastMessageAt").lean()).map((c) => ({
    id: String(c._id),
    accountId: c.accountId && byId.has(String(c.accountId)) ? String(c.accountId) : null,
    lastInboundAt: c.lastInboundAt,
    lastInboundAccountId: c.lastInboundAccountId,
    lastMessageAt: c.lastMessageAt,
  }));
  const moves = planWaDistribution(chats, share, giveAway);
  const count = (list) => {
    const m = new Map(accounts.map((a) => [String(a._id), 0]));
    for (const c of list) if (c.accountId) m.set(c.accountId, (m.get(c.accountId) ?? 0) + 1);
    return m;
  };
  const before = count(chats);
  const movedTo = new Map(moves.map((m) => [m.chatId, m.to]));
  const after = count(chats.map((c) => (movedTo.has(c.id) ? { ...c, accountId: movedTo.get(c.id) } : c)));
  // a customer who wrote to the old number hears from the new one for the first time: slow, like any first contact
  const firstContacts = moves.filter((m) => {
    const c = chats.find((x) => x.id === m.chatId);
    return c.lastInboundAt;
  }).length;
  return {
    moves,
    chats,
    preview: {
      moving: moves.length,
      firstContacts,
      numbers: accounts.map((a) => ({ id: String(a._id), label: a.label, before: before.get(String(a._id)) ?? 0, after: after.get(String(a._id)) ?? 0 })),
    },
  };
}

export async function previewDistribution(ctx, body) {
  return (await distributionPlan(ctx, body)).preview;
}

export async function applyDistribution(ctx, body) {
  const { moves, chats, preview } = await distributionPlan(ctx, body);
  if (!moves.length) return preview;
  const byId = new Map(chats.map((c) => [c.id, c]));
  await WaChatModel.bulkWrite(
    moves.map((m) => {
      const c = byId.get(m.chatId);
      return {
        updateOne: {
          filter: { _id: m.chatId, brandId: ctx.brandId },
          update: { $set: { accountId: m.to, ...(c.lastInboundAt && !c.lastInboundAccountId && m.from ? { lastInboundAccountId: m.from } : {}) } },
        },
      };
    }),
  );
  // messages still waiting go with their chat
  await WaMessageModel.bulkWrite(
    moves.map((m) => ({ updateMany: { filter: { brandId: ctx.brandId, chatId: m.chatId, status: "queued" }, update: { $set: { accountId: m.to } } } })),
  );
  return preview;
}

/* ------------------------------------------------------------------ cleanup */

/**
 * Old history: scope "messages" removes messages older than `before` (chats stay, messages still waiting to go are
 * kept); scope "chats" removes whole chats with nothing since `before`. Optionally only one number's chats.
 */
async function cleanupFilters(ctx, { before, scope, accountId }) {
  const cutoff = new Date(before);
  if (Number.isNaN(cutoff.getTime())) throw new HttpError(400, "Pick a date.");
  if (cutoff > new Date()) throw new HttpError(400, "The date must be in the past.");
  const chatFilter = { brandId: ctx.brandId };
  if (accountId) chatFilter.accountId = accountId === "none" ? null : String(accountId);
  if (scope === "chats") {
    chatFilter.$or = [{ lastMessageAt: { $lt: cutoff } }, { lastMessageAt: null, createdAt: { $lt: cutoff } }];
    const ids = (await WaChatModel.find(chatFilter).select("_id").lean()).map((c) => String(c._id));
    return { scope, chatIds: ids, msgFilter: { brandId: ctx.brandId, chatId: { $in: ids } } };
  }
  const msgFilter = { brandId: ctx.brandId, at: { $lt: cutoff }, status: { $nin: ["queued", "sending"] } };
  if (accountId) msgFilter.chatId = { $in: (await WaChatModel.find(chatFilter).select("_id").lean()).map((c) => String(c._id)) };
  return { scope: "messages", chatIds: null, msgFilter };
}

export async function previewCleanup(ctx, body) {
  const f = await cleanupFilters(ctx, body);
  const messages = await WaMessageModel.countDocuments(f.msgFilter);
  const chats = f.chatIds ? f.chatIds.length : (await WaMessageModel.distinct("chatId", f.msgFilter)).length;
  return { scope: f.scope, messages, chats };
}

export async function runCleanup(ctx, body) {
  const f = await cleanupFilters(ctx, body);
  const result = await previewCleanup(ctx, body);
  await dropMessages(ctx, f.msgFilter);
  if (f.chatIds) await WaChatModel.deleteMany({ brandId: ctx.brandId, _id: { $in: f.chatIds } });
  return result;
}
