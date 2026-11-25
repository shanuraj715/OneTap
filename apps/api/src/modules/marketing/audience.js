import { currentAge, dateAgo, formatWaPhone, marketingAudienceSchema, MARKETING_MAX_RECIPIENTS, normalizeWaPhone, parseContacts } from "@rasoipulse/config-schema";
import { CustomerModel, MarketingContactModel, MenuItemModel, OrderModel, OutletModel, WaChatModel } from "@rasoipulse/db";
import { HttpError } from "../../middleware/error.js";

/**
 * Who a marketing message goes to. Four sources can be mixed: the store's customers (narrowed by filters), people
 * who messaged the store on WhatsApp, saved contact lists, and numbers typed or pasted in. The same person coming
 * from two places is one person; anyone who said STOP on WhatsApp is never included.
 */

const lower = (s) => String(s ?? "").trim().toLowerCase();

/** straight-line distance in km */
function km(a, b) {
  const R = 6371;
  const rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/* ------------------------------------------------------------- order figures */

/** Orders that count as a visit: anything that wasn't cancelled. */
const baseMatch = (brandId, outletIds) => ({
  brandId,
  status: { $ne: "cancelled" },
  "customer.customerId": { $type: "string" },
  ...(outletIds.length ? { outletId: { $in: outletIds } } : {}),
});

/** customerId → { last: Date } over the chosen outlets, all time */
async function lastOrders(brandId, outletIds) {
  const rows = await OrderModel.aggregate([{ $match: baseMatch(brandId, outletIds) }, { $group: { _id: "$customer.customerId", last: { $max: "$createdAt" } } }]);
  return new Map(rows.map((r) => [r._id, r.last]));
}

/** customerId → number of orders of one type (within the window) */
async function ordersOfType(brandId, outletIds, channel, since) {
  const match = { ...baseMatch(brandId, outletIds), channel, ...(since ? { createdAt: { $gte: since } } : {}) };
  const rows = await OrderModel.aggregate([{ $match: match }, { $group: { _id: "$customer.customerId", n: { $sum: 1 } } }]);
  return new Map(rows.map((r) => [r._id, r.n]));
}

/** customerId → Map(lower-case item name → quantity ordered) for the wanted items */
async function itemQuantities(brandId, outletIds, names, since) {
  const match = { ...baseMatch(brandId, outletIds), ...(since ? { createdAt: { $gte: since } } : {}) };
  const rows = await OrderModel.aggregate([
    { $match: match },
    { $unwind: "$lines" },
    { $addFields: { itemName: { $toLower: { $trim: { input: { $ifNull: ["$lines.name", ""] } } } } } },
    { $match: { itemName: { $in: names } } },
    { $group: { _id: { c: "$customer.customerId", n: "$itemName" }, qty: { $sum: { $ifNull: ["$lines.quantity", 1] } } } },
  ]);
  const by = new Map();
  for (const r of rows) {
    if (!by.has(r._id.c)) by.set(r._id.c, new Map());
    by.get(r._id.c).set(r._id.n, r.qty);
  }
  return by;
}

/** customerId → delivery addresses they ordered to */
async function deliveryAddresses(brandId, outletIds) {
  const rows = await OrderModel.aggregate([
    { $match: { ...baseMatch(brandId, outletIds), "deliveryAddress.text": { $type: "string" } } },
    { $group: { _id: "$customer.customerId", addresses: { $addToSet: { text: "$deliveryAddress.text", lat: "$deliveryAddress.lat", lng: "$deliveryAddress.lng" } } } },
  ]);
  return new Map(rows.map((r) => [r._id, r.addresses.slice(0, 30)]));
}

/* ------------------------------------------------------------ the customers */

async function customersMatching(brandId, f, now) {
  const customers = await CustomerModel.find({ brandId }).select("phone name gender age ageYear createdAt lastOrderAt orderCount").lean();
  const outletIds = f.outletIds ?? [];
  const since = f.window ? dateAgo(f.window, now) : null;

  const [last, ofType, items, addresses] = await Promise.all([
    f.lastOrder ? lastOrders(brandId, outletIds) : null,
    f.orderType ? ordersOfType(brandId, outletIds, f.orderType.channel, since) : null,
    f.items ? itemQuantities(brandId, outletIds, f.items.names.map(lower), since) : null,
    f.area ? deliveryAddresses(brandId, outletIds) : null,
  ]);
  const cutoff = f.lastOrder ? dateAgo(f.lastOrder.olderThan, now) : null;
  const wantedItems = f.items ? f.items.names.map(lower) : [];
  const areaText = f.area?.text ? lower(f.area.text) : "";

  const out = [];
  for (const c of customers) {
    const id = String(c._id);
    if (f.gender?.length && !f.gender.includes(c.gender)) continue;

    if (f.age) {
      const age = currentAge(c, now);
      if (age == null) continue;
      if (f.age.exact != null) {
        if (age !== f.age.exact) continue;
      } else {
        if (f.age.min != null && age < f.age.min) continue;
        if (f.age.max != null && age > f.age.max) continue;
      }
    }

    if (f.lastOrder) {
      const at = last.get(id);
      if (!at) {
        if (!f.lastOrder.includeNeverOrdered) continue;
      } else if (new Date(at) >= cutoff) continue;
    }

    if (f.orderType && (ofType.get(id) ?? 0) < f.orderType.minOrders) continue;

    if (f.items) {
      const bought = items.get(id);
      if (!bought) continue;
      if (f.items.match === "all") {
        if (!wantedItems.every((n) => (bought.get(n) ?? 0) >= f.items.minQuantity)) continue;
      } else {
        const total = wantedItems.reduce((sum, n) => sum + (bought.get(n) ?? 0), 0);
        if (total < f.items.minQuantity) continue;
      }
    }

    if (f.area) {
      const list = addresses.get(id) ?? [];
      const hit = list.some((a) => {
        if (areaText && !lower(a.text).includes(areaText)) return false;
        if (f.area.near) {
          if (typeof a.lat !== "number" || typeof a.lng !== "number") return false;
          if (km({ lat: a.lat, lng: a.lng }, f.area.near) > f.area.near.km) return false;
        }
        return true;
      });
      if (!hit) continue;
    }
    out.push(c);
  }
  return out;
}

/* ---------------------------------------------------------------- the audience */

/** Does this set of filters narrow anything? (for the "everyone" warning in the dashboard) */
export function filtersInUse(f) {
  return Boolean(f.lastOrder || f.items || f.age || f.gender?.length || f.orderType || f.area);
}

/**
 * Build the audience. Returns the people (one per phone number), how they were made up, and the lines that
 * couldn't be used. `people[i]` = { phone, name, customerId?, sources, info }.
 */
export async function buildAudience(ctx, rawSpec, { now = new Date() } = {}) {
  const spec = marketingAudienceSchema.parse(rawSpec ?? {});
  const brandId = ctx.brandId;
  const people = new Map();
  const counts = { customers: 0, waChats: 0, lists: 0, numbers: 0, noPhone: 0, duplicates: 0, optedOut: 0, invalid: 0 };
  const invalid = [];

  const add = (phone, name, source, extra = {}) => {
    const existing = people.get(phone);
    if (existing) {
      counts.duplicates++;
      if (!existing.name && name) existing.name = name;
      existing.sources.add(source);
      Object.assign(existing, { customerId: existing.customerId ?? extra.customerId });
      existing.info = { ...extra.info, ...existing.info };
      return;
    }
    people.set(phone, { phone, name: name || "", sources: new Set([source]), customerId: extra.customerId, info: extra.info ?? {} });
  };

  if (spec.customers.enabled) {
    for (const c of await customersMatching(brandId, spec.customers.filters, now)) {
      const phone = normalizeWaPhone(c.phone);
      if (!phone) { counts.noPhone++; continue; }
      counts.customers++;
      add(phone, c.name, "customers", {
        customerId: String(c._id),
        info: { orders: c.orderCount ?? 0, lastOrderAt: c.lastOrderAt ?? null, age: currentAge(c, now), gender: c.gender ?? null },
      });
    }
  }
  if (spec.waChats) {
    for (const ch of await WaChatModel.find({ brandId }).select("phone name").lean()) {
      counts.waChats++;
      add(ch.phone, ch.name, "whatsapp");
    }
  }
  if (spec.listIds.length) {
    for (const c of await MarketingContactModel.find({ brandId, listId: { $in: spec.listIds } }).select("phone name").lean()) {
      counts.lists++;
      add(c.phone, c.name, "lists");
    }
  }
  if (spec.numbers.trim()) {
    const parsed = parseContacts(spec.numbers);
    counts.invalid = parsed.invalid.length;
    counts.duplicates += parsed.duplicates; // the same number typed twice
    invalid.push(...parsed.invalid.slice(0, 20));
    for (const c of parsed.valid) {
      counts.numbers++;
      add(c.phone, c.name, "numbers");
    }
  }

  // anyone who said STOP is never messaged, on any channel
  const stopped = await WaChatModel.find({ brandId, optedOut: true }).select("phone").lean();
  for (const s of stopped) if (people.delete(s.phone)) counts.optedOut++;

  const list = [...people.values()].sort((a, b) => (a.name || "~").localeCompare(b.name || "~") || a.phone.localeCompare(b.phone));
  return { people: list, counts, invalid };
}

/** The dashboard's live "who would get this?" — the number, the make-up, and a few examples. */
export async function previewAudience(ctx, spec) {
  const { people, counts, invalid } = await buildAudience(ctx, spec);
  return {
    total: people.length,
    tooMany: people.length > MARKETING_MAX_RECIPIENTS,
    max: MARKETING_MAX_RECIPIENTS,
    counts,
    invalid,
    sample: people.slice(0, 12).map((p) => ({ name: p.name, phone: formatWaPhone(p.phone), sources: [...p.sources], ...p.info })),
  };
}

/* ------------------------------------------------------- what the filters offer */

/** Outlets and menu item names the filter form can pick from. */
export async function filterOptions(ctx, outletIds = []) {
  const outlets = await OutletModel.find({ brandId: ctx.brandId }).sort({ createdAt: 1 }).lean();
  const items = await MenuItemModel.find({ brandId: ctx.brandId, ...(outletIds.length ? { outletId: { $in: outletIds } } : {}) }).select("name").lean();
  const names = [...new Map(items.map((i) => [lower(i.name), i.name])).values()].sort((a, b) => a.localeCompare(b));
  return {
    outlets: outlets.map((o) => ({
      id: String(o._id),
      name: o.name,
      title: o.config?.identity?.name || o.name,
      location: o.config?.identity?.location?.point ?? null,
    })),
    items: names,
  };
}

export const requireSomeone = (people) => {
  if (!people.length) throw new HttpError(400, "Nobody matches yet — widen the filters or add some numbers.");
  if (people.length > MARKETING_MAX_RECIPIENTS) throw new HttpError(400, `That's ${people.length.toLocaleString("en-IN")} people — more than one campaign may go to (${MARKETING_MAX_RECIPIENTS.toLocaleString("en-IN")}). Narrow it down or send in parts.`);
};
