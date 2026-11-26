import mongoose from "mongoose";
import { tenantScope } from "../tenant-scope.js";
import { writeEvents } from "../write-events.js";

const { Schema, model, models } = mongoose;

/* ------------------------------------------------------------------ category */

const categorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    // the category this one sits inside (South Indian → Dosa); null = a top-level category
    parentId: { type: String, default: null, index: true },
    // an optional picture for the category (shown beside its heading and in the category lists)
    image: {
      type: new Schema({ url: { type: String, required: true }, key: { type: String, default: "" }, width: Number, height: Number }, { _id: false }),
      default: undefined,
    },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    // where everything in this category is made ("kitchen" | "bar"); null = same as its parent category, else the kitchen
    prepStation: { type: String, default: null },
    // the hours everything inside can be ordered ({ windows: [{ days, from, to }] }); null = same as its parent, else any time
    availability: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true },
);
categorySchema.plugin(tenantScope);
categorySchema.plugin(writeEvents, { model: "MenuCategory", brandFrom: "brandId", outletFrom: "outletId" });
categorySchema.index({ brandId: 1, outletId: 1, sortOrder: 1 });

export const MenuCategoryModel =
  models.MenuCategory ?? model("MenuCategory", categorySchema);

/* ------------------------------------------------------------ modifier group */

const modifierGroupSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    required: { type: Boolean, default: false },
    minSelect: { type: Number, default: 0 },
    maxSelect: { type: Number, default: 1 },
    options: {
      type: [
        new Schema(
          {
            id: { type: String, required: true },
            label: { type: String, required: true, trim: true },
            priceDelta: { type: Number, default: 0 },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
  },
  { timestamps: true },
);
modifierGroupSchema.plugin(tenantScope);
modifierGroupSchema.plugin(writeEvents, { model: "ModifierGroup", brandFrom: "brandId", outletFrom: "outletId" });
modifierGroupSchema.index({ brandId: 1, outletId: 1 });

export const ModifierGroupModel =
  models.ModifierGroup ?? model("ModifierGroup", modifierGroupSchema);

/* ---------------------------------------------------------------- menu item */

const itemSchema = new Schema(
  {
    categoryId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    foodType: { type: String, enum: ["veg", "non-veg", "egg"], default: "veg" },
    tags: { type: [String], default: [] },
    // where this dish is made ("kitchen" | "bar"); null = same as its category
    prepStation: { type: String, default: null },
    images: {
      type: [
        new Schema(
          {
            url: { type: String, required: true },
            key: { type: String, default: "" },
            width: Number,
            height: Number,
            // which card shape this picture is for ("1:1" | "4:3" | "16:9" | "3:4"); older pictures have none and count as square
            ratio: { type: String, default: "1:1" },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    basePrice: { type: Number, default: 0, min: 0 },
    variants: {
      type: [
        new Schema(
          {
            id: { type: String, required: true },
            label: { type: String, required: true, trim: true },
            price: { type: Number, required: true, min: 0 },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    modifierGroupIds: { type: [String], default: [] },
    gstRatePct: { type: Number, default: 5 },
    isAvailable: { type: Boolean, default: true },
    // WHY a dish is switched off when the kitchen did it: "sold-out" (finished for now) or "unavailable" (can't be made). Only read while isAvailable is false;
    // the dashboard's own switch clears it. Customers see "Sold out" either way — the switch itself is what every screen obeys.
    offReason: { type: String, enum: ["", "sold-out", "unavailable"], default: "" },
    offAt: { type: Date, default: null },
    offBy: { type: String, default: "" },
    sortOrder: { type: Number, default: 0 },
    // counted stock; null = not counted. `resetDay` is the India-time day `left` was last refilled to `daily`.
    stock: {
      type: new Schema(
        {
          tracked: { type: Boolean, default: true },
          left: { type: Number, default: 0, min: 0 },
          daily: { type: Number, default: null },
          lowAt: { type: Number, default: 5 },
          resetDay: { type: String, default: "" },
        },
        { _id: false },
      ),
      default: null,
    },
    // the hours it can be ordered ({ windows: [{ days, from, to }] }); null = its category's
    availability: { type: Schema.Types.Mixed, default: null },
    // a combo: the dishes it is made of ({ items: [{ itemId, variantId, quantity }] }); null = a plain dish
    combo: { type: Schema.Types.Mixed, default: null },
    // "goes well with" — dishes suggested alongside this one
    pairsWith: { type: [String], default: [] },
  },
  { timestamps: true },
);
itemSchema.plugin(tenantScope);
itemSchema.plugin(writeEvents, { model: "MenuItem", brandFrom: "brandId", outletFrom: "outletId" });
itemSchema.index({ brandId: 1, outletId: 1, categoryId: 1, sortOrder: 1 });

export const MenuItemModel = models.MenuItem ?? model("MenuItem", itemSchema);
