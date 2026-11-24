import mongoose from "mongoose";
import { defaultOutletConfig } from "@rasoipulse/config-schema";
import { tenantScope } from "../tenant-scope.js";
import { writeEvents } from "../write-events.js";

const { Schema, model, models } = mongoose;

const outletSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true, trim: true },
    hostnames: { type: [String], default: [] },
    canonicalHostname: { type: String, default: "" },
    config: { type: Schema.Types.Mixed, default: () => defaultOutletConfig() },
    /** set by the platform when a store is over its outlet limit — closed to customers and staff, data kept */
    blocked: {
      type: new Schema({ at: { type: Date, required: true }, by: { type: String } }, { _id: false }),
      default: null,
    },
  },
  { timestamps: true },
);

outletSchema.plugin(tenantScope);
outletSchema.index({ brandId: 1, slug: 1 }, { unique: true });
outletSchema.index({ hostnames: 1 });
// the API copies outlets (their config, addresses, blocked state) — tell it when any change
outletSchema.plugin(writeEvents, { model: "Outlet", brandFrom: "brandId", outletFrom: "_id" });

export const OutletModel = models.Outlet ?? model("Outlet", outletSchema);
