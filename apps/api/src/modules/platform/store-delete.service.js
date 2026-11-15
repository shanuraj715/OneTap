import {
  BrandModel,
  CounterModel,
  CustomerModel,
  MenuItemModel,
  mongoose,
  OrderModel,
  OutletModel,
  SessionModel,
  TableModel,
  UserModel,
} from "@onetap/db";
import { logger } from "../../logger.js";
import { HttpError } from "../../middleware/error.js";
import { expireStore } from "../cache/cache.js";
import { invalidateStorePlan } from "./plan.service.js";

/**
 * Deleting a whole store: its outlets, menu, orders, customers, tables, coupons,
 * printers, settings, the people who only belonged to it — and the store itself.
 *
 * It cannot be undone, so the console asks for the store's name to be typed
 * (see `confirmName`) and shows what will go first (`deletionSummary`).
 *
 * Every collection that holds a store's data is found by what it IS rather
 * than by a list kept here: the models whose `brandId` is required (the
 * tenant-scope plugin makes it so). A collection added later is covered
 * without anyone remembering to add it. Platform-wide records (plans, the
 * website, the login log) are not store data and are left alone.
 *
 * Not touched: pictures already uploaded to your storage. They aren't tracked
 * per store; they all sit in a folder named after the store's id (see
 * `storagePrefix`), which can be deleted in the storage provider.
 */

const OBJECT_ID = /^[0-9a-f]{24}$/i;

async function loadBrand(id) {
  if (!OBJECT_ID.test(String(id))) throw new HttpError(404, "Store not found");
  const brand = await BrandModel.findById(id).lean();
  if (!brand) throw new HttpError(404, "Store not found");
  return brand;
}

/** The collections that hold a store's data. */
function storeCollections() {
  return mongoose
    .modelNames()
    .map((name) => mongoose.model(name))
    .filter((model) => model.schema.path("brandId")?.isRequired);
}

/** What deleting this store would remove — shown before the owner confirms. */
export async function deletionSummary(id) {
  const brand = await loadBrand(id);
  const brandId = String(brand._id);
  const [outlets, menuItems, orders, customers, tables, people] = await Promise.all([
    OutletModel.countDocuments({ brandId }),
    MenuItemModel.countDocuments({ brandId }),
    OrderModel.countDocuments({ brandId }),
    CustomerModel.countDocuments({ brandId }),
    TableModel.countDocuments({ brandId }),
    UserModel.countDocuments({ "memberships.brandId": brandId }),
  ]);
  return {
    store: { id: brandId, name: brand.name, slug: brand.slug },
    counts: { outlets, menuItems, orders, customers, tables, people },
    storagePrefix: `${brandId}/`,
  };
}

/**
 * Delete a store for good. `confirmName` must be the store's name, exactly.
 * Safe to run again if it was interrupted: whatever is left is removed.
 */
export async function deleteStore(id, { confirmName, by } = {}) {
  const brand = await loadBrand(id);
  const brandId = String(brand._id);
  if (String(confirmName ?? "").trim() !== brand.name) {
    throw new HttpError(400, `Type the store's name exactly (“${brand.name}”) to confirm.`);
  }

  const outletIds = (await OutletModel.find({ brandId }).select("_id").lean()).map((o) => String(o._id));
  const removed = {};

  // outlets first: the moment they are gone, the store's addresses stop opening
  const models = storeCollections();
  models.sort((a, b) => (a.modelName === "Outlet" ? -1 : b.modelName === "Outlet" ? 1 : 0));
  for (const Model of models) {
    const result = await Model.deleteMany({ brandId });
    removed[Model.modelName] = result.deletedCount ?? 0;
  }

  // daily order-number counters are keyed by outlet ("order:<outletId>:<day>")
  if (outletIds.length) {
    const result = await CounterModel.deleteMany({ _id: new RegExp(`(^|[:/])(${outletIds.join("|")})([:/]|$)`) });
    removed.Counter = result.deletedCount ?? 0;
  }

  // people: take this store off their access; an account that belonged only here goes with it
  let usersRemoved = 0;
  let usersKept = 0;
  for (const user of await UserModel.find({ "memberships.brandId": brandId })) {
    user.memberships = user.memberships.filter((m) => m.brandId !== brandId);
    if (user.memberships.length === 0 && !user.isSuperAdmin) {
      await SessionModel.deleteMany({ userId: String(user._id) });
      await UserModel.deleteOne({ _id: user._id });
      usersRemoved++;
    } else {
      await user.save();
      usersKept++;
    }
  }

  await BrandModel.deleteOne({ _id: brandId });

  // nothing about this store may stay cached, here or in another API process
  invalidateStorePlan(brandId);
  await expireStore(brandId);

  logger.warn({ brandId, name: brand.name, by, removed, usersRemoved, usersKept }, "store deleted");
  return {
    store: { id: brandId, name: brand.name },
    removed,
    users: { removed: usersRemoved, kept: usersKept },
    storagePrefix: `${brandId}/`,
  };
}
