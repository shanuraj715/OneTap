import makeWASocket, {
  Browsers,
  DisconnectReason,
  downloadMediaMessage,
  fetchLatestBaileysVersion,
  generateMessageIDV2,
  jidNormalizedUser,
  normalizeMessageContent,
} from "@whiskeysockets/baileys";
import {
  isOptInText,
  isOptOutText,
  WA_MAX_MEDIA_BYTES,
  WA_CODE_REDACTED,
  WA_PACING,
  waAfterQuietHours,
  waLocalClock,
  waNextLocalDay,
} from "@rasoipulse/config-schema";
import { WaAccountModel, WaChatModel, WaMessageModel } from "@rasoipulse/db";
import { env } from "../../env.js";
import { logger } from "../../logger.js";
import { putFile, readFile, removeObject } from "../storage/storage.service.js";
import { storePlan } from "../platform/plan.service.js";
import { clearAuthState, useMongoAuthState } from "./auth-state.js";
import { revokeStore, WA_SWITCHED_OFF } from "./whatsapp.service.js";

/**
 * The WhatsApp worker: holds the connection of every linked number, sends the queued messages at a safe pace,
 * records what comes in. Runs in exactly ONE API process (WHATSAPP_WORKER=on); everything else only reads and
 * writes the WaAccount / WaMessage documents, which is how linking, sending and status all cross processes.
 */

const TICK_MS = 2000;
const HEARTBEAT_MS = 20_000;
const all = { allowGlobalQuery: true };
const baileysLog = logger.child({ mod: "baileys" }, { level: "error" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const between = (a, b) => a + Math.random() * (b - a);

/** accountId → { sock, brandId, connected, busy } */
const sockets = new Map();
/** accountId → time before which we don't try to reconnect */
const retryAt = new Map();
let waVersion = null;
let ticking = false;

export function startWhatsAppWorker() {
  if (env.WHATSAPP_WORKER !== "on") {
    logger.info("WhatsApp worker is off in this process (WHATSAPP_WORKER) — messages are queued for the one that runs it");
    return;
  }
  logger.info("WhatsApp worker started");
  // a crash mid-send leaves messages "sending": put them back in the queue
  void WaMessageModel.updateMany({ status: "sending", updatedAt: { $lt: new Date(Date.now() - 120_000) } }, { $set: { status: "queued" } }, all).catch(() => {});
  setInterval(() => void tick(), TICK_MS).unref?.();
  setInterval(() => void heartbeat(), HEARTBEAT_MS).unref?.();
}

async function heartbeat() {
  const ids = [...sockets.entries()].filter(([, e]) => e.connected).map(([id]) => id);
  if (ids.length) await WaAccountModel.updateMany({ _id: { $in: ids } }, { $set: { seenAt: new Date() } }, all).catch(() => {});
}

async function tick() {
  if (ticking) return;
  ticking = true;
  try {
    const accounts = await WaAccountModel.find({ $or: [{ status: { $in: ["pending", "connected", "disconnected"] } }, { wantsLogout: true }] }, null, all).lean();
    const wanted = new Set();
    // a store whose plan (or per-store lock) no longer includes WhatsApp chat must hold no connection at all —
    // checked here too, so a number can never come back online after a restart, whatever changed the plan
    const entitled = new Map();
    const allowed = async (brandId) => {
      if (!entitled.has(brandId)) {
        const plan = await storePlan(brandId).catch(() => null);
        entitled.set(brandId, plan ? plan.entitlements.features.includes("whatsappChat") : true);
      }
      return entitled.get(brandId);
    };
    const revoked = new Set();
    for (const a of accounts) {
      const id = String(a._id);
      if (a.wantsLogout) {
        await logout(a);
        continue;
      }
      if (!(await allowed(a.brandId))) {
        if (!revoked.has(a.brandId)) {
          revoked.add(a.brandId);
          await revokeStore(a.brandId);
        }
        await logout({ ...a, lastError: WA_SWITCHED_OFF });
        continue;
      }
      wanted.add(id);
      if (!sockets.has(id) && Date.now() >= (retryAt.get(id) ?? 0)) await connect(a);
    }
    // removed, unlinked or expired in the meantime
    for (const [id, e] of sockets) if (!wanted.has(id)) end(id, e);
    for (const [id, e] of sockets) if (e.connected && !e.busy) void sendNext(id, e);
  } catch (err) {
    logger.error({ err }, "whatsapp worker tick failed");
  } finally {
    ticking = false;
  }
}

function end(id, e) {
  sockets.delete(id);
  try {
    e.sock.end(undefined);
  } catch {
    /* already closed */
  }
}

const setAccount = (id, set) => WaAccountModel.updateOne({ _id: id }, { $set: set }, all).catch((err) => logger.error({ err }, "whatsapp: account update failed"));

/* -------------------------------------------------------------- connection */

async function connect(account) {
  const id = String(account._id);
  const brandId = account.brandId;
  const { state, saveCreds } = await useMongoAuthState({ brandId, accountId: id });
  if (!waVersion) waVersion = (await fetchLatestBaileysVersion().catch(() => null))?.version ?? undefined;

  const sock = makeWASocket({
    version: waVersion,
    auth: state,
    logger: baileysLog,
    browser: Browsers.ubuntu("Chrome"),
    // leaves the phone getting its notifications as usual
    markOnlineOnConnect: false,
    syncFullHistory: false,
    generateHighQualityLinkPreview: false,
    getMessage: async () => undefined,
  });
  const entry = { sock, brandId, connected: false, busy: false };
  sockets.set(id, entry);

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
    if (qr) await setAccount(id, { qr, qrAt: new Date(), status: "pending" });
    if (connection === "open") {
      entry.connected = true;
      retryAt.delete(id);
      const phone = jidNormalizedUser(sock.user?.id ?? "").split("@")[0];
      const fresh = await WaAccountModel.findOne({ _id: id }, null, all).lean();
      await setAccount(id, { status: "connected", qr: "", phone, pushName: sock.user?.name ?? "", seenAt: new Date(), lastError: "", ...(fresh?.linkedAt ? {} : { linkedAt: new Date() }) });
      logger.info({ accountId: id, phone }, "whatsapp number connected");
    }
    if (connection === "close") {
      entry.connected = false;
      sockets.delete(id);
      const code = lastDisconnect?.error?.output?.statusCode;
      const current = await WaAccountModel.findOne({ _id: id }, null, all).lean();
      if (!current) return;
      if (code === DisconnectReason.loggedOut) {
        await clearAuthState({ brandId, accountId: id });
        await setAccount(id, { status: "logged_out", qr: "", lastError: "Unlinked from the phone (Linked devices)." });
      } else if (current.status === "pending" && code === DisconnectReason.timedOut) {
        // the QR codes ran out without a scan
        await clearAuthState({ brandId, accountId: id });
        await setAccount(id, { status: "expired", qr: "" });
      } else if (code === DisconnectReason.restartRequired) {
        retryAt.delete(id); // normal right after pairing: reconnect at once
      } else if (code === DisconnectReason.connectionReplaced) {
        retryAt.set(id, Date.now() + 60_000);
        await setAccount(id, { status: "disconnected", lastError: "WhatsApp was opened for this number somewhere else. Trying again in a minute." });
      } else {
        retryAt.set(id, Date.now() + (current.status === "pending" ? 3000 : 15_000));
        if (current.status === "connected") await setAccount(id, { status: "disconnected", lastError: lastDisconnect?.error?.message?.slice(0, 200) ?? "" });
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    for (const m of messages) {
      try {
        await record(id, entry, m, type);
      } catch (err) {
        logger.error({ err, accountId: id }, "whatsapp: couldn't record a message");
      }
    }
  });

  sock.ev.on("messages.update", async (updates) => {
    for (const u of updates) {
      const s = u.update?.status;
      const next = s === 3 ? "delivered" : s >= 4 ? "read" : null;
      if (!next || !u.key?.id) continue;
      const allowed = next === "read" ? ["sent", "delivered"] : ["sent"];
      await WaMessageModel.updateOne({ brandId, waId: u.key.id, status: { $in: allowed } }, { $set: { status: next } }).catch(() => {});
    }
  });
}

async function logout(account) {
  const id = String(account._id);
  const e = sockets.get(id);
  if (e) {
    sockets.delete(id);
    try {
      await e.sock.logout();
    } catch {
      /* not connected — the session is dropped below anyway */
    }
  }
  await clearAuthState({ brandId: account.brandId, accountId: id });
  // an owner unlinking a number leaves no message; a store that lost WhatsApp chat keeps the reason on the card
  await setAccount(id, { status: "logged_out", wantsLogout: false, qr: "", lastError: String(account.lastError ?? "").startsWith("WhatsApp chat") ? account.lastError : "" });
}

/* ------------------------------------------------------------------ incoming */

const userOf = (jid) => (jid && /@s\.whatsapp\.net$/.test(jid) ? jid.split("@")[0].split(":")[0] : null);

async function phoneOf(sock, key) {
  let p = userOf(key.remoteJid) ?? userOf(key.remoteJidAlt);
  if (!p && key.remoteJid?.endsWith("@lid")) {
    const pn = await sock.signalRepository?.lidMapping?.getPNForLID?.(key.remoteJid).catch(() => null);
    p = userOf(pn);
  }
  return p;
}

const MEDIA_KINDS = [
  ["imageMessage", "image"],
  ["videoMessage", "video"],
  ["audioMessage", "audio"],
  ["documentMessage", "document"],
  ["stickerMessage", "sticker"],
];

async function record(accountId, entry, m, type) {
  const jid = m.key?.remoteJid ?? "";
  if (!jid || /@(g\.us|broadcast|newsletter)$/.test(jid) || jid === "status@broadcast") return;
  const content = normalizeMessageContent(m.message);
  // someone deleted a message "for everyone": it shows as deleted here too
  if (content?.protocolMessage?.type === 0 && content.protocolMessage.key?.id) {
    await markDeleted(entry.brandId, { waId: content.protocolMessage.key.id });
    return;
  }
  if (!content || content.protocolMessage || content.reactionMessage) return;
  const ts = new Date(Number(m.messageTimestamp ?? Date.now() / 1000) * 1000);
  // history the phone hands over on linking is not replayed into the dashboard
  if (type !== "notify" && Date.now() - ts.getTime() > 120_000) return;

  const brandId = entry.brandId;
  if (m.key.id && (await WaMessageModel.exists({ brandId, waId: m.key.id }))) return; // ours, or already recorded
  const phone = await phoneOf(entry.sock, m.key);
  if (!phone) return;

  let text = content.conversation || content.extendedTextMessage?.text || "";
  let kind = "text";
  let media = null;
  for (const [field, k] of MEDIA_KINDS) {
    const part = content[field];
    if (!part) continue;
    kind = k;
    text = part.caption || text;
    const size = Number(part.fileLength ?? 0);
    if (size <= WA_MAX_MEDIA_BYTES) {
      try {
        const buf = await downloadMediaMessage(m, "buffer", {}, { logger: baileysLog, reuploadRequest: entry.sock.updateMediaMessage });
        const mime = part.mimetype?.split(";")[0] || "application/octet-stream";
        const ext = (part.fileName?.split(".").pop() || mime.split("/")[1] || "bin").replace(/[^a-z0-9]/gi, "").slice(0, 8);
        const stored = await putFile({ brandId }, { body: buf, contentType: mime, kind: "whatsapp", ext, maxBytes: WA_MAX_MEDIA_BYTES });
        media = { url: stored.url, key: stored.key, mime, fileName: part.fileName ?? "", size: buf.length };
      } catch (err) {
        logger.warn({ err: err.message, accountId }, "whatsapp: couldn't keep an attachment");
      }
    }
    break;
  }
  if (!text && !media && kind === "text") kind = "other";

  const fromMe = Boolean(m.key.fromMe);
  const chat = await WaChatModel.findOneAndUpdate(
    { brandId, phone },
    { $setOnInsert: { brandId, phone, accountId } },
    { upsert: true, new: true },
  ).lean();

  await WaMessageModel.create({
    brandId,
    chatId: String(chat._id),
    accountId,
    direction: fromMe ? "out" : "in",
    type: kind,
    text,
    media,
    status: fromMe ? "sent" : "received",
    source: fromMe ? "phone" : "chat",
    waId: m.key.id ?? "",
    at: ts,
  });

  const preview = (text || (media ? `📎 ${kind}` : "")).slice(0, 120);
  const set = { lastMessageAt: ts, lastPreview: preview, lastDirection: fromMe ? "out" : "in", hidden: false };
  const inc = {};
  if (fromMe) set.lastOutboundAt = ts;
  else {
    // replies go out from the number the customer last wrote to
    Object.assign(set, { lastInboundAt: ts, accountId, lastInboundAccountId: accountId });
    inc.unread = 1;
    if (!chat.name && m.pushName) set.name = m.pushName.slice(0, 80);
    if (isOptOutText(text)) set.optedOut = true;
    if (isOptInText(text)) set.optedOut = false;
  }
  await WaChatModel.updateOne({ _id: chat._id, brandId }, { $set: set, ...(inc.unread ? { $inc: inc } : {}) });
}

/* ------------------------------------------------------------------- sending */

// a verification code goes before everything else: someone is waiting on their phone for it
const RANK = { code: -1, warm: 0, order: 1, cold: 2 };

/** Show a message as deleted (its words and file are gone, like on WhatsApp). */
async function markDeleted(brandId, filter) {
  const m = await WaMessageModel.findOne({ brandId, ...filter }).lean();
  if (!m) return;
  await WaMessageModel.updateOne({ _id: m._id, brandId }, { $set: { deleted: true, text: "", media: null, revoke: m.revoke === "requested" ? "done" : m.revoke } });
  if (m.media?.key) void removeObject({ brandId }, m.media.key);
}

/** "Delete for everyone" the dashboard asked for: done before anything new is sent. Returns true when it did one. */
async function revokeNext(accountId, entry) {
  const brandId = entry.brandId;
  const m = await WaMessageModel.findOne({ brandId, accountId, revoke: "requested" }).lean();
  if (!m) return false;
  try {
    const chat = await WaChatModel.findOne({ _id: m.chatId, brandId }).lean();
    if (!chat || !m.waId) throw new Error("The message can't be found on WhatsApp.");
    const jid = `${chat.phone}@s.whatsapp.net`;
    await entry.sock.sendMessage(jid, { delete: { remoteJid: jid, fromMe: true, id: m.waId } });
    await markDeleted(brandId, { _id: m._id });
    await WaMessageModel.updateOne({ _id: m._id, brandId }, { $set: { revoke: "done", revokeError: "" } });
  } catch (err) {
    await WaMessageModel.updateOne({ _id: m._id, brandId }, { $set: { revoke: "failed", revokeError: String(err.message || err).slice(0, 200) } });
  }
  return true;
}

async function sendNext(accountId, entry) {
  entry.busy = true;
  try {
    if (await revokeNext(accountId, entry)) return;
    const brandId = entry.brandId;
    const now = new Date();
    // verification codes first, whatever is queued ahead of them: a store with a 500-person broadcast waiting must still sign people in
    const codes = await WaMessageModel.find({ brandId, accountId, status: "queued", pace: "code", sendAfter: { $lte: now } }).sort({ sendAfter: 1 }).limit(5).lean();
    const due = codes.length ? codes : await WaMessageModel.find({ brandId, accountId, status: "queued", sendAfter: { $lte: now } }).sort({ sendAfter: 1 }).limit(20).lean();
    if (!due.length) return;
    due.sort((a, b) => (RANK[a.pace] ?? 0) - (RANK[b.pace] ?? 0));
    let acc = await WaAccountModel.findOne({ _id: accountId, brandId }).lean();
    const { day } = waLocalClock(now);

    for (const msg of due) {
      if (acc.lastSendAt && now - new Date(acc.lastSendAt) < WA_PACING.warm.minGapMs) return;

      if (msg.pace === "cold" || msg.pace === "order") {
        const p = msg.pace === "cold" ? WA_PACING.cold : WA_PACING.order;
        const dayField = msg.pace === "cold" ? "coldDay" : "orderDay";
        const countField = msg.pace === "cold" ? "coldCount" : "orderCount";
        const nextField = msg.pace === "cold" ? "coldNextAt" : "orderNextAt";
        const used = acc[dayField] === day ? acc[countField] : 0;
        if (used >= p.perDay) {
          // today's budget is spent: everything of this kind waits for tomorrow
          await WaMessageModel.updateMany({ brandId, accountId, status: "queued", pace: msg.pace, sendAfter: { $lte: now } }, { $set: { sendAfter: waNextLocalDay(now) } });
          continue;
        }
        if (msg.pace === "cold") {
          const open = waAfterQuietHours(now);
          if (open > now) {
            await WaMessageModel.updateMany({ brandId, accountId, status: "queued", pace: "cold", sendAfter: { $lte: now } }, { $set: { sendAfter: open } });
            continue;
          }
        }
        if (acc[nextField] && new Date(acc[nextField]) > now) continue; // spacing between first-contact messages
      }

      const claimed = await WaMessageModel.findOneAndUpdate({ _id: msg._id, brandId, status: "queued" }, { $set: { status: "sending" } }, { new: true }).lean();
      if (!claimed) continue;
      await deliver(entry, acc, claimed);
      acc = await WaAccountModel.findOne({ _id: accountId, brandId }).lean();
      return; // one message per tick per number — pacing does the rest
    }
  } catch (err) {
    logger.error({ err, accountId }, "whatsapp: send loop failed");
  } finally {
    entry.busy = false;
  }
}

async function deliver(entry, acc, msg) {
  const brandId = entry.brandId;
  const accountId = String(acc._id);
  const isCode = msg.source === "code";
  // a verification code is never kept: once it has gone out (or failed) the stored message only says that a code was sent
  const fail = (error) =>
    WaMessageModel.updateOne({ _id: msg._id, brandId }, { $set: { status: "failed", error: String(error).slice(0, 300), ...(isCode ? { text: WA_CODE_REDACTED } : {}) } });
  try {
    const chat = await WaChatModel.findOne({ _id: msg.chatId, brandId }).lean();
    if (!chat) return fail("The chat was deleted.");
    const jid = `${chat.phone}@s.whatsapp.net`;

    if (msg.pace !== "warm") {
      // never message a number that isn't on WhatsApp — that is exactly what spam filters look for
      const [hit] = (await entry.sock.onWhatsApp(jid).catch(() => [])) ?? [];
      if (!hit?.exists) return fail("This number isn't on WhatsApp.");
    }

    let content;
    if (msg.media?.url) {
      const buf = await readFile({ brandId }, msg.media);
      const mimetype = msg.media.mime || "application/octet-stream";
      const caption = msg.text || undefined;
      content =
        msg.type === "image" ? { image: buf, caption, mimetype }
        : msg.type === "video" ? { video: buf, caption, mimetype }
        : msg.type === "audio" ? { audio: buf, mimetype }
        : { document: buf, mimetype, fileName: msg.media.fileName || "file", caption };
    } else {
      content = { text: msg.text };
    }

    // a human pause, with "typing…" showing
    await entry.sock.sendPresenceUpdate("composing", jid).catch(() => {});
    await sleep(isCode ? between(WA_PACING.code.typingMinMs, WA_PACING.code.typingMaxMs) : between(WA_PACING.warm.typingMinMs, WA_PACING.warm.typingMaxMs));
    await entry.sock.sendPresenceUpdate("paused", jid).catch(() => {});

    // the id is decided and saved first, so the echo of our own message isn't mistaken for one typed on the phone
    const waId = generateMessageIDV2(entry.sock.user?.id);
    await WaMessageModel.updateOne({ _id: msg._id, brandId }, { $set: { waId } });
    await entry.sock.sendMessage(jid, content, { messageId: waId });

    const now = new Date();
    await WaMessageModel.updateOne({ _id: msg._id, brandId }, { $set: { status: "sent", at: now, error: "", ...(isCode ? { text: WA_CODE_REDACTED } : {}) } });
    // a code isn't a conversation: it doesn't move the chat up the inbox, show in its preview, or loosen the pacing of later messages
    if (!isCode) {
      await WaChatModel.updateOne(
        { _id: chat._id, brandId },
        { $set: { lastOutboundAt: now, lastMessageAt: now, lastDirection: "out", hidden: false, lastPreview: (msg.text || `📎 ${msg.type}`).slice(0, 120) } },
      );
    }

    const { day } = waLocalClock(now);
    const set = { lastSendAt: now };
    if (msg.pace === "cold" || msg.pace === "order") {
      const p = msg.pace === "cold" ? WA_PACING.cold : WA_PACING.order;
      const [dayF, countF, nextF] = msg.pace === "cold" ? ["coldDay", "coldCount", "coldNextAt"] : ["orderDay", "orderCount", "orderNextAt"];
      set[dayF] = day;
      set[countF] = (acc[dayF] === day ? acc[countF] : 0) + 1;
      set[nextF] = new Date(now.getTime() + between(p.minGapSec, p.maxGapSec) * 1000);
    }
    await WaAccountModel.updateOne({ _id: accountId, brandId }, { $set: set });
  } catch (err) {
    logger.warn({ err: err.message, accountId }, "whatsapp: send failed");
    await fail(err.message || "Couldn't send");
  }
}

/** For tests only: drive the send loop and the inbound recorder with a stand-in connection. */
export const __test = { sockets, sendNext, record, revokeNext, tick };
