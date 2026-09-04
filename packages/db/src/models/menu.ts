import mongoose, { type Model } from "mongoose";
import type { FoodType } from "@onetap/config-schema";
import { tenantScope } from "../tenant-scope";

const { Schema, model, models } = mongoose;

/* ------------------------------------------------------------------ category */

export interface MenuCategoryDoc {
  _id: string;
  brandId: string;
  outletId: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const categorySchema = new Schema<MenuCategoryDoc>(
  {
    name: { type: String, required: true, trim: true },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);
categorySchema.plugin(tenantScope);
categorySchema.index({ brandId: 1, outletId: 1, sortOrder: 1 });

export const MenuCategoryModel: Model<MenuCategoryDoc> =
  (models.MenuCategory as Model<MenuCategoryDoc> | undefined) ??
  model<MenuCategoryDoc>("MenuCategory", categorySchema);

/* ------------------------------------------------------------ modifier group */

export interface ModifierGroupDoc {
  _id: string;
  brandId: string;
  outletId: string;
  name: string;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  options: { id: string; label: string; priceDelta: number }[];
  createdAt: Date;
  updatedAt: Date;
}

const modifierGroupSchema = new Schema<ModifierGroupDoc>(
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
modifierGroupSchema.index({ brandId: 1, outletId: 1 });

export const ModifierGroupModel: Model<ModifierGroupDoc> =
  (models.ModifierGroup as Model<ModifierGroupDoc> | undefined) ??
  model<ModifierGroupDoc>("ModifierGroup", modifierGroupSchema);

/* ---------------------------------------------------------------- menu item */

export interface MenuItemDoc {
  _id: string;
  brandId: string;
  outletId: string;
  categoryId: string;
  name: string;
  description: string;
  foodType: FoodType;
  tags: string[];
  /** paise; used when there are no variants */
  basePrice: number;
  variants: { id: string; label: string; price: number }[];
  modifierGroupIds: string[];
  gstRatePct: number;
  isAvailable: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const itemSchema = new Schema<MenuItemDoc>(
  {
    categoryId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    foodType: { type: String, enum: ["veg", "non-veg", "egg"], default: "veg" },
    tags: { type: [String], default: [] },
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
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);
itemSchema.plugin(tenantScope);
itemSchema.index({ brandId: 1, outletId: 1, categoryId: 1, sortOrder: 1 });

export const MenuItemModel: Model<MenuItemDoc> =
  (models.MenuItem as Model<MenuItemDoc> | undefined) ??
  model<MenuItemDoc>("MenuItem", itemSchema);
