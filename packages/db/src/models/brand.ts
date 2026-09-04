import mongoose, { type Model } from "mongoose";

const { Schema, model, models } = mongoose;

export interface BrandDoc {
  _id: string;
  name: string;
  slug: string;
  ownerEmail: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * A brand is the tenant root — it is NOT tenant-scoped itself. Everything below it
 * (outlets, menu, orders, ...) carries this brand's id and goes through tenant-scope.
 */
const brandSchema = new Schema<BrandDoc>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    ownerEmail: { type: String, required: true, lowercase: true, trim: true },
  },
  { timestamps: true },
);

export const BrandModel: Model<BrandDoc> =
  (models.Brand as Model<BrandDoc> | undefined) ?? model<BrandDoc>("Brand", brandSchema);
