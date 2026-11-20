import mongoose from "mongoose";

import { writeEvents } from "../write-events.js";

const { Schema, model, models } = mongoose;

/**
 * A brand is the tenant root — it is NOT tenant-scoped itself. Everything below it
 * (outlets, menu, orders, ...) carries this brand's id and goes through tenant-scope.
 */
const brandSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    ownerEmail: { type: String, required: true, lowercase: true, trim: true },
    /** the platform plan this store is on — null means a legacy store: unlimited, everything unlocked */
    planId: { type: String, default: null },
    /** per-store changes on top of the plan (see planOverridesSchema in config-schema) */
    overrides: { type: Schema.Types.Mixed, default: () => ({}) },
    /**
     * The look shared by every outlet: theme, typography, effect, layout
     * (component styles). Null until migrated — outlets then fall back to
     * their own stored values, exactly as before.
     */
    appearance: { type: Schema.Types.Mixed, default: null },
    /** WhatsApp chat settings for the whole store: { access: { manager: "none"|"read"|"send", … } } */
    whatsapp: { type: Schema.Types.Mixed, default: null },
    /** which way each kind of message is sent (see messagingSchema): { codes: { method, linkedMessage, whatsappTemplate } }. Null = never set. */
    messaging: { type: Schema.Types.Mixed, default: null },
    /** abandoned-cart reminders for the whole store (see cartRemindersSchema). Null = never set (off). */
    cartReminders: { type: Schema.Types.Mixed, default: null },
    /** when usage first went over a plan limit; cleared once back within it */
    overLimitSince: { type: Date, default: null },
    /**
     * Set by the platform when it switches the WHOLE store off — a late or missing payment, say. Customers see
     * "temporarily unavailable" and can't order; the store's team can't use the dashboard and sees `message`
     * instead. Nothing is deleted, and clearing this (null) turns everything back on exactly as it was.
     */
    disabled: {
      type: new Schema(
        {
          at: { type: Date, required: true },
          /** the platform user who did it */
          by: { type: String },
          /** what the store's team is told (optional, plain text) */
          message: { type: String, default: "", maxlength: 500 },
        },
        { _id: false },
      ),
      default: null,
    },
  },
  { timestamps: true },
);

// the API copies a store's name, look and plan — tell it when any of that changes (the over-limit stamp is bookkeeping, not a change)
brandSchema.plugin(writeEvents, { model: "Brand", brandFrom: "_id", ignore: ["overLimitSince"] });

export const BrandModel = models.Brand ?? model("Brand", brandSchema);
