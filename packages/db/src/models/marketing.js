import mongoose from "mongoose";
import { MARKETING_CHANNELS } from "@onetap/config-schema";
import { tenantScope } from "../tenant-scope.js";

const { Schema, model, models } = mongoose;

/**
 * Marketing: messages the store sends to its customers. Everything belongs to the whole STORE (brand).
 *
 * A saved contact list is a name plus its numbers. A campaign is one send: the channel, the words, a snapshot of who
 * it went to. For SMS and the WhatsApp Business API every person is a `MarketingMessage` row that the marketing
 * worker (the ONE process with MARKETING_WORKER=on) sends one by one; for linked WhatsApp the campaign points at the
 * WhatsApp broadcast that does the (careful, slow) sending.
 */

/* ----------------------------------------------------------------- contacts */

const marketingListSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    count: { type: Number, default: 0 },
    createdBy: String,
  },
  { timestamps: true },
);
marketingListSchema.plugin(tenantScope);
export const MarketingListModel = models.MarketingList ?? model("MarketingList", marketingListSchema);

const marketingContactSchema = new Schema(
  {
    listId: { type: String, required: true, index: true },
    /** digits with country code (91…), the same form WhatsApp uses */
    phone: { type: String, required: true },
    name: { type: String, default: "", trim: true, maxlength: 80 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
marketingContactSchema.plugin(tenantScope);
marketingContactSchema.index({ brandId: 1, listId: 1, phone: 1 }, { unique: true });
export const MarketingContactModel = models.MarketingContact ?? model("MarketingContact", marketingContactSchema);

/* ---------------------------------------------------------------- campaigns */

const marketingCampaignSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    channel: { type: String, enum: MARKETING_CHANNELS, required: true },
    message: { type: String, default: "" },
    template: { type: Schema.Types.Mixed, default: null },
    /** what was asked for (filters, lists…) — kept so the report can say who it went to */
    audience: { type: Schema.Types.Mixed, default: null },
    /** how the audience was made up, e.g. { customers: 120, lists: 40, numbers: 12, duplicates: 8, optedOut: 3 } */
    breakdown: { type: Schema.Types.Mixed, default: null },
    total: { type: Number, default: 0 },
    /** people left out (no usable number, said STOP, nobody online to start the chat…) */
    skipped: { type: Number, default: 0 },
    /** linked WhatsApp only: the WaCampaign that does the sending */
    waCampaignId: { type: String, default: "" },
    status: { type: String, enum: ["sending", "done", "cancelled"], default: "sending", index: true },
    createdBy: String,
  },
  { timestamps: true },
);
marketingCampaignSchema.plugin(tenantScope);
export const MarketingCampaignModel = models.MarketingCampaign ?? model("MarketingCampaign", marketingCampaignSchema);

const marketingMessageSchema = new Schema(
  {
    campaignId: { type: String, required: true, index: true },
    channel: { type: String, enum: MARKETING_CHANNELS, required: true },
    phone: { type: String, required: true },
    name: { type: String, default: "" },
    /** the final words for this person (SMS) */
    text: { type: String, default: "" },
    /** the template parameters for this person (WhatsApp Business API) */
    params: { type: [String], default: undefined },
    status: { type: String, enum: ["queued", "sending", "sent", "failed"], default: "queued", index: true },
    error: { type: String, default: "" },
    providerMessageId: { type: String, default: "" },
    sentAt: Date,
  },
  { timestamps: true },
);
marketingMessageSchema.plugin(tenantScope);
marketingMessageSchema.index({ status: 1, createdAt: 1 });
export const MarketingMessageModel = models.MarketingMessage ?? model("MarketingMessage", marketingMessageSchema);
