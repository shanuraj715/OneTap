import mongoose, { type Model } from "mongoose";
import { defaultOutletConfig, type OutletConfig } from "@onetap/config-schema";
import { tenantScope } from "../tenant-scope";

const { Schema, model, models } = mongoose;

export interface OutletDoc {
  _id: string;
  brandId: string;
  outletId?: string;
  name: string;
  slug: string;
  /** every hostname this outlet answers on — subdomains and custom domains */
  hostnames: string[];
  /** the one hostname everything else 301-redirects to */
  canonicalHostname: string;
  config: OutletConfig;
  createdAt: Date;
  updatedAt: Date;
}

const outletSchema = new Schema<OutletDoc>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true, trim: true },
    hostnames: { type: [String], default: [] },
    canonicalHostname: { type: String, default: "" },
    config: { type: Schema.Types.Mixed, default: () => defaultOutletConfig() },
  },
  { timestamps: true },
);

outletSchema.plugin(tenantScope);
outletSchema.index({ brandId: 1, slug: 1 }, { unique: true });
outletSchema.index({ hostnames: 1 });

export const OutletModel: Model<OutletDoc> =
  (models.Outlet as Model<OutletDoc> | undefined) ?? model<OutletDoc>("Outlet", outletSchema);
