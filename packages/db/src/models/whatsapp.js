import mongoose from "mongoose";
import { WA_MESSAGE_SOURCES, WA_MESSAGE_STATUSES, WA_MESSAGE_TYPES } from "@onetap/config-schema";
import { tenantScope } from "../tenant-scope.js";

const { Schema, model, models } = mongoose;

/**
 * WhatsApp chat over the store's own linked numbers. Everything here belongs to the whole STORE (brand), not one
 * outlet: a customer is one conversation whichever outlet they ordered from.
 *
 * The connection itself lives in ONE API process (the WhatsApp worker — see apps/api/src/modules/whatsapp/worker.js);
 * every other process, and the dashboard, talks to it only through these documents: a message to send is a
 * "queued" WaMessage, a number to link is a "pending" WaAccount whose QR the worker writes back.
 */

/** One linked WhatsApp number. */
const waAccountSchema = new Schema(
  {
    /** what the owner calls it — "Counter phone", "Number 2" */
    label: { type: String, required: true, trim: true },
    /** its colour in the dashboard (the chip on every chat it sends from) */
    color: { type: String, default: "" },
    /** digits with country code, known once linked */
    phone: { type: String, default: "" },
    /** the name on the WhatsApp profile */
    pushName: { type: String, default: "" },
    /**
     * pending       waiting for the QR to be scanned (qr holds the current code)
     * connected     linked and online
     * disconnected  linked, but the connection dropped (the worker keeps reconnecting)
     * logged_out    unlinked from the phone, or by the owner — needs a fresh scan
     * expired       the QR was never scanned in time
     */
    status: { type: String, enum: ["pending", "connected", "disconnected", "logged_out", "expired"], default: "pending", index: true },
    qr: { type: String, default: "" },
    qrAt: Date,
    /** set by the dashboard; the worker logs the number out and clears it */
    wantsLogout: { type: Boolean, default: false },
    /** the worker touches this while it holds the connection — the dashboard trusts "connected" only if it's fresh */
    seenAt: Date,
    linkedAt: Date,
    lastError: { type: String, default: "" },
    createdBy: String,
    /** pacing counters (local day, see WA_PACING) */
    coldDay: { type: String, default: "" },
    coldCount: { type: Number, default: 0 },
    coldNextAt: Date,
    orderDay: { type: String, default: "" },
    orderCount: { type: Number, default: 0 },
    orderNextAt: Date,
    lastSendAt: Date,
  },
  { timestamps: true },
);
waAccountSchema.plugin(tenantScope);
export const WaAccountModel = models.WaAccount ?? model("WaAccount", waAccountSchema);

/** The linked session's keys (Signal protocol state), encrypted. Whoever holds these IS that WhatsApp number. */
const waAuthKeySchema = new Schema({
  accountId: { type: String, required: true },
  key: { type: String, required: true },
  value: { type: String, required: true },
});
waAuthKeySchema.plugin(tenantScope);
waAuthKeySchema.index({ accountId: 1, key: 1 }, { unique: true });
export const WaAuthKeyModel = models.WaAuthKey ?? model("WaAuthKey", waAuthKeySchema);

/** One conversation with one customer phone number. */
const waChatSchema = new Schema(
  {
    phone: { type: String, required: true },
    name: { type: String, default: "" },
    /** the linked number this conversation goes out from (the one the customer last wrote to) */
    accountId: { type: String, default: null },
    lastMessageAt: Date,
    lastPreview: { type: String, default: "" },
    lastDirection: { type: String, default: "" },
    /** set when the customer has written to us — from then on it's a running conversation, not a cold contact */
    lastInboundAt: Date,
    /** the number the customer last wrote TO — a chat moved to another number is a first contact for that number */
    lastInboundAccountId: { type: String, default: null },
    lastOutboundAt: Date,
    unread: { type: Number, default: 0 },
    /** replied STOP to offers: broadcasts skip them (chat and order updates still go) */
    optedOut: { type: Boolean, default: false },
    customerId: { type: String, default: null },
    /**
     * Made only to deliver a verification code to someone who has never talked to the store. Kept out of the inbox
     * until a real conversation happens (they write, or the store messages them).
     */
    hidden: { type: Boolean, default: false },
  },
  { timestamps: true },
);
waChatSchema.plugin(tenantScope);
waChatSchema.index({ brandId: 1, phone: 1 }, { unique: true });
waChatSchema.index({ brandId: 1, lastMessageAt: -1 });
export const WaChatModel = models.WaChat ?? model("WaChat", waChatSchema);

const mediaSchema = new Schema({ url: String, key: String, mime: String, fileName: String, size: Number }, { _id: false });

/** One message, either way. Outgoing ones start "queued" and the worker sends them. */
const waMessageSchema = new Schema(
  {
    chatId: { type: String, required: true },
    accountId: { type: String, default: null },
    direction: { type: String, enum: ["in", "out"], required: true },
    type: { type: String, enum: WA_MESSAGE_TYPES, default: "text" },
    text: { type: String, default: "" },
    media: { type: mediaSchema, default: null },
    status: { type: String, enum: WA_MESSAGE_STATUSES, default: "queued", index: true },
    source: { type: String, enum: WA_MESSAGE_SOURCES, default: "chat" },
    /** warm | cold | order | code — how hard to pace it (see WA_PACING) */
    pace: { type: String, default: "warm" },
    /** the earliest it may go out (pacing, quiet hours) */
    sendAfter: { type: Date, default: () => new Date() },
    waId: { type: String, default: "" },
    error: { type: String, default: "" },
    sentBy: { type: String, default: null },
    campaignId: { type: String, default: null },
    orderId: { type: String, default: null },
    at: { type: Date, default: () => new Date() },
    /** deleted for everyone (by us, or by the customer) — kept as "This message was deleted", like WhatsApp does */
    deleted: { type: Boolean, default: false },
    /** "" | requested (the worker will delete it for everyone) | done | failed */
    revoke: { type: String, default: "" },
    revokeError: { type: String, default: "" },
  },
  { timestamps: true },
);
waMessageSchema.plugin(tenantScope);
waMessageSchema.index({ brandId: 1, chatId: 1, at: -1 });
waMessageSchema.index({ status: 1, accountId: 1, sendAfter: 1 });
waMessageSchema.index({ waId: 1 });
waMessageSchema.index({ revoke: 1, accountId: 1 });
export const WaMessageModel = models.WaMessage ?? model("WaMessage", waMessageSchema);

/** A broadcast (offer, announcement) to the store's customers. Its messages are ordinary queued WaMessages. */
const waCampaignSchema = new Schema(
  {
    text: { type: String, required: true },
    media: { type: mediaSchema, default: null },
    total: { type: Number, default: 0 },
    skipped: { type: Number, default: 0 },
    status: { type: String, enum: ["sending", "done", "cancelled"], default: "sending" },
    createdBy: String,
  },
  { timestamps: true },
);
waCampaignSchema.plugin(tenantScope);
export const WaCampaignModel = models.WaCampaign ?? model("WaCampaign", waCampaignSchema);
