import mongoose from "mongoose";
import { defaultQrCardSpec } from "@onetap/config-schema";
import { tenantScope } from "../tenant-scope.js";

const { Schema, model, models } = mongoose;

/**
 * The printable table-card design — ONE document per outlet.
 *
 * There is no library of saved designs and no `isDefault` flag: the 36 starting
 * points live in config-schema as code, and applying one copies its spec into
 * this document. That removes a whole tier the printing module needs (seeding
 * defaults, delete guards, in-use checks, a fallback chain) for a feature where
 * nobody wants to manage a collection — they want one card that looks right.
 *
 * `spec` is Mixed and validated by `qrCardSpecSchema` on the way in and out,
 * matching `outlet.config` and `StorageConfigModel.publicFields`. Parsing on
 * read means a new styling knob needs no migration: every stored design is
 * upgraded as it is loaded.
 *
 * Nothing table-specific is stored here. The design is shared by every table;
 * the table's number and its own signed QR URL are supplied at render time.
 */
const qrCardDesignSchema = new Schema(
  {
    name: { type: String, default: "Table card", trim: true },
    spec: { type: Schema.Types.Mixed, default: () => defaultQrCardSpec() },
    updatedBy: { type: String, default: null },
  },
  { timestamps: true },
);

qrCardDesignSchema.plugin(tenantScope);
qrCardDesignSchema.index({ brandId: 1, outletId: 1 }, { unique: true });

export const QrCardDesignModel = models.QrCardDesign ?? model("QrCardDesign", qrCardDesignSchema);
