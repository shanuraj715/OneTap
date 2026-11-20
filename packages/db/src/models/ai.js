import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

/** One Gemini API key. The key itself is encrypted and never sent back to a browser — only `keyHint` is. */
const aiKeySchema = new Schema(
  {
    id: { type: String, required: true },
    label: { type: String, default: "" },
    /** AES-256-GCM envelope (apps/api/src/lib/crypto.js) */
    encryptedKey: { type: String, required: true },
    /** what the console shows instead of the key ("AIza••••x9Qk") */
    keyHint: { type: String, default: "" },
    /** first part of a hash of the key — only to notice the same key being added twice */
    fingerprint: { type: String, required: true },
    enabled: { type: Boolean, default: true },
    /** pictures made with it */
    uses: { type: Number, default: 0 },
    lastUsedAt: Date,
    lastError: { type: String, default: "" },
    /** set while Google says its quota is used up (or it was refused): the key is skipped until then */
    cooldownUntil: Date,
    addedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

/**
 * The platform's ONE setting for AI picture generation: the Gemini API keys (several, because each key has its own
 * usage limit — pictures are spread over them) and which model makes the pictures. Only the super admin can see or
 * change it, and only the super admin can use it. Not tenant-scoped: it belongs to no store. A single document,
 * found by `key`.
 */
const platformAiSchema = new Schema(
  {
    key: { type: String, default: "platform", unique: true },
    provider: { type: String, default: "gemini" },
    model: { type: String, default: "gemini-nano-banana-2.1" },
    keys: { type: [aiKeySchema], default: [] },
    updatedBy: String,
  },
  { timestamps: true },
);

export const PlatformAiModel = models.PlatformAi ?? model("PlatformAi", platformAiSchema);
