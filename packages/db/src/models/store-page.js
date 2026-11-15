import mongoose from "mongoose";
import { PAGE_STATUSES } from "@onetap/config-schema";
import { tenantScope } from "../tenant-scope.js";
import { writeEvents } from "../write-events.js";

const { Schema, model, models } = mongoose;

/**
 * One page of a store's storefront — About us, Contact, a policy… — belonging to ONE outlet, so every outlet
 * writes its own. The page is a list of simple blocks (see config-schema/store-pages.js, which also validates
 * everything on the way in); `blocks` is stored as written so a new kind of block needs no migration.
 */
const storePageSchema = new Schema(
  {
    slug: { type: String, required: true, lowercase: true, trim: true },
    title: { type: String, required: true, trim: true },
    status: { type: String, enum: PAGE_STATUSES, default: "draft", index: true },
    description: { type: String, default: "" },
    showInHeader: { type: Boolean, default: false },
    showInFooter: { type: Boolean, default: true },
    blocks: { type: Schema.Types.Mixed, default: () => [] },
    /** where it sits in the header and footer links (smaller first) */
    sortOrder: { type: Number, default: 0 },
    updatedBy: String,
  },
  { timestamps: true },
);
storePageSchema.plugin(tenantScope);
storePageSchema.index({ brandId: 1, outletId: 1, slug: 1 }, { unique: true });
// the storefront keeps copies of an outlet's published pages — tell it when any change
storePageSchema.plugin(writeEvents, { model: "StorePage", brandFrom: "brandId", outletFrom: "outletId" });

export const StorePageModel = models.StorePage ?? model("StorePage", storePageSchema);
