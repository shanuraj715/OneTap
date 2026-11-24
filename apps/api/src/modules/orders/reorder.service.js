import { menuForNow } from "@rasoipulse/config-schema";
import { brandFilter, OrderModel, OutletModel } from "@rasoipulse/db";
import { HttpError } from "../../middleware/error.js";
import { getMenu } from "../menu/menu.service.js";

/**
 * "Order again": the dishes of one of a customer's past orders, as cart lines for the outlet's menu as it is NOW.
 *
 *  - a dish that's gone, sold out or outside its hours is left out — and listed in `skipped` with why;
 *  - a size that no longer exists is matched by name, else the dish is left out;
 *  - add-ons that are no longer offered with the dish are dropped (said in `notes`);
 *  - quantities and kitchen notes are kept.
 *
 * Nothing is priced here — the storefront puts the lines in the cart and the order page prices them as usual.
 */
export async function reorderLines({ brandId, customerId, orderId }) {
  if (!/^[a-f\d]{24}$/i.test(String(orderId))) throw new HttpError(404, "Order not found");
  const order = await OrderModel.findOne(brandFilter({ brandId }, { _id: orderId, "customer.customerId": String(customerId) })).lean();
  if (!order) throw new HttpError(404, "Order not found");
  const outlet = await OutletModel.findOne({ _id: order.outletId, brandId }).select("slug name blocked config.identity.name").lean();
  if (!outlet || outlet.blocked) throw new HttpError(409, "That outlet isn't taking orders right now.");

  const menu = menuForNow(await getMenu({ brandId, outletId: order.outletId }));
  const byId = new Map(menu.items.map((i) => [i.id, i]));
  const groups = new Map(menu.modifierGroups.map((g) => [g.id, g]));

  const lines = [];
  const skipped = [];
  const notes = [];
  for (const line of order.lines ?? []) {
    const item = byId.get(String(line.itemId));
    if (!item) {
      skipped.push({ name: line.name, reason: "no longer on the menu" });
      continue;
    }
    if (!item.isAvailable) {
      const label = item.unavailableLabel ?? "Sold out";
      skipped.push({ name: item.name, reason: label === "Sold out" ? "sold out right now" : label.replace(/^Available/, "only available") });
      continue;
    }
    let variantId;
    if (item.variants.length) {
      const v = item.variants.find((x) => x.id === line.variantId) ?? item.variants.find((x) => line.variantLabel && x.label.toLowerCase() === String(line.variantLabel).toLowerCase());
      if (!v) {
        skipped.push({ name: item.name, reason: `the ${line.variantLabel ?? "size"} size isn't offered any more` });
        continue;
      }
      variantId = v.id;
    }
    const allowed = new Set(item.modifierGroupIds.flatMap((gid) => (groups.get(gid)?.options ?? []).map((o) => o.id)));
    const wanted = (line.modifiers ?? []).map((m) => m.id).filter(Boolean);
    const kept = wanted.filter((id) => allowed.has(id));
    if (kept.length < wanted.length) notes.push(`${item.name}: an add-on you had isn't offered any more.`);
    lines.push({ itemId: item.id, ...(variantId ? { variantId } : {}), modifierOptionIds: kept, quantity: line.quantity, ...(line.note ? { note: String(line.note).slice(0, 200) } : {}) });
  }
  return { outletId: String(order.outletId), outletSlug: outlet.slug, outletName: outlet.config?.identity?.name || outlet.name, lines, skipped, notes };
}
