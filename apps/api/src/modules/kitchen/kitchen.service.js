import { MenuCategoryModel, MenuItemModel, OrderModel, TableModel, tenantFilter } from "@rasoipulse/db";
import { istDayKey, slowestStage } from "@rasoipulse/config-schema";
import { HttpError } from "../../middleware/error.js";
import { broadcast } from "../../realtime/hub.js";
import { effectiveOutletConfig } from "../outlets/config.service.js";
import { expandCombos, stationsForItems } from "../printing/kot.js";
import { setStatusManual, updateStatus, wire } from "../orders/orders.service.js";

/**
 * The Kitchen Display System. An order is on the kitchen's screen from the moment the team accepts it until it has been
 * ready for a while. Each dish belongs to a prep station (kitchen or bar — the same rule the kitchen tickets use), and a
 * station has its own stage with the order: new → preparing → ready. The order's own status follows the stations:
 * the first Start makes it "preparing", and it is "ready" only when EVERY station it needs is ready.
 */

const ON_SCREEN = ["accepted", "preparing", "ready"];
/** A ready order stays on the screen this long, so the waiter can see it and the cook can recall a mis-tap. */
const READY_VISIBLE_MS = 30 * 60 * 1000;

/** Where a station is with an order, falling back to the order's own status for orders moved without the kitchen screen. */
function stageOf(order, station) {
  const own = order.kds?.[station]?.stage;
  if (own) return own;
  if (order.status === "preparing") return "preparing";
  if (["ready", "out_for_delivery", "completed"].includes(order.status)) return "ready";
  return "new";
}

/** Every dish of an order (a combo as its parts), each with the station that makes it. */
async function stationLines(ctx, orders) {
  const lines = orders.map((o) => expandCombos(o.lines));
  const stations = await stationsForItems(ctx, lines.flat().map((l) => l.itemId));
  return lines.map((ls) => ls.map((l) => ({ ...l, station: stations.get(String(l.itemId)) ?? "kitchen" })));
}

const acceptedAt = (o) => (o.statusHistory ?? []).find((h) => h.status === "accepted")?.at ?? o.createdAt;

export async function listKitchenOrders(ctx, screen = "all") {
  const cfg = (await effectiveOutletConfig(ctx)).kitchenDisplay;
  const orders = await OrderModel.find(
    tenantFilter(ctx, {
      status: { $in: ON_SCREEN },
      // an online order that hasn't been paid yet isn't the kitchen's business
      $or: [{ "payment.gateway": "cod" }, { "payment.status": { $ne: "pending" } }],
    }),
  )
    .sort({ createdAt: 1 })
    .limit(150)
    .lean();

  const fresh = orders.filter((o) => o.status !== "ready" || Date.now() - new Date(o.updatedAt ?? o.createdAt).getTime() < READY_VISIBLE_MS);
  const [lineSets, tables] = await Promise.all([
    stationLines(ctx, fresh),
    TableModel.find(tenantFilter(ctx, { _id: { $in: fresh.map((o) => o.tableId).filter(Boolean) } })).select("number").lean(),
  ]);
  const tableNo = new Map(tables.map((t) => [String(t._id), t.number]));

  const cards = [];
  fresh.forEach((o, i) => {
    const all = lineSets[i];
    const involved = [...new Set(all.map((l) => l.station))];
    const shown = screen === "all" ? all : all.filter((l) => l.station === screen);
    if (!shown.length) return;
    const stages = involved.map((s) => ({ station: s, stage: stageOf(o, s) }));
    cards.push({
      id: String(o._id),
      orderNumber: o.orderNumber,
      channel: o.channel,
      tableNumber: o.tableId ? tableNo.get(String(o.tableId)) ?? null : null,
      customerName: o.customer?.name ?? null,
      note: o.note ?? null,
      createdAt: o.createdAt,
      acceptedAt: acceptedAt(o),
      scheduledFor: o.scheduledFor ?? null,
      // this screen's stage: one station's, or the slowest of all of them on the "all" screen
      stage: screen === "all" ? slowestStage(stages.map((s) => s.stage)) : stageOf(o, screen),
      stations: stages,
      lines: shown.map((l) => ({
        name: l.name,
        variantLabel: l.variantLabel ?? "",
        modifiers: (l.modifiers ?? []).map((m) => m.label ?? m.name ?? "").filter(Boolean),
        quantity: l.quantity,
        note: l.note ?? "",
        station: l.station,
      })),
    });
  });

  return {
    screen,
    now: Date.now(),
    settings: { warnAfterMinutes: cfg.warnAfterMinutes, lateAfterMinutes: cfg.lateAfterMinutes, notifyWaiter: cfg.notifyWaiter },
    orders: cards,
  };
}

/**
 * Move a station (or, on the "all" screen, every station an order needs) to a stage, and let the order's status follow.
 * Stations are written one field each, so the kitchen and the bar tapping at the same moment never overwrite each other.
 */
export async function setKitchenStage(ctx, user, orderId, screen, stage) {
  const order = await OrderModel.findOne(tenantFilter(ctx, { _id: orderId })).lean();
  if (!order) throw new HttpError(404, "Order not found");
  if (!ON_SCREEN.includes(order.status)) throw new HttpError(409, `This order is ${order.status} — it is no longer on the kitchen screen.`);

  const [lines] = await stationLines(ctx, [order]);
  const involved = [...new Set(lines.map((l) => l.station))];
  const touch = screen === "all" ? involved : [screen];
  if (touch.some((s) => !involved.includes(s))) throw new HttpError(409, "This order has nothing to make at that station.");

  const before = Object.fromEntries(involved.map((s) => [s, stageOf(order, s)]));
  const changed = touch.filter((s) => before[s] !== stage);
  if (changed.length) {
    const at = new Date();
    const set = {};
    // an order that was moved on without this screen has no records yet: write every station so none falls back to "new"
    for (const s of involved) {
      if (changed.includes(s)) set[`kds.${s}`] = { stage, at, by: String(user._id) };
      else if (!order.kds?.[s]) set[`kds.${s}`] = { stage: before[s], at, by: String(user._id) };
    }
    await OrderModel.updateOne(tenantFilter(ctx, { _id: orderId }), { $set: set });
  }

  // the order's own status follows the stations
  const fresh = await OrderModel.findOne(tenantFilter(ctx, { _id: orderId })).lean();
  const stages = involved.map((s) => stageOf(fresh, s));
  const target = stages.every((s) => s === "ready") ? "ready" : stages.some((s) => s !== "new") ? "preparing" : null;
  let status = fresh.status;
  const uid = String(user._id);
  if (target === "ready") {
    if (status === "accepted") status = (await updateStatus(ctx, orderId, "preparing", uid)).status;
    if (status === "preparing") await updateStatus(ctx, orderId, "ready", uid);
  } else if (target === "preparing") {
    if (status === "accepted") await updateStatus(ctx, orderId, "preparing", uid);
    else if (status === "ready") await setStatusManual(ctx, orderId, "preparing", uid, "Kitchen display: moved back to preparing");
  }

  const done = await OrderModel.findOne(tenantFilter(ctx, { _id: orderId })).lean();
  broadcast(ctx.outletId, { type: "order.updated", order: wire(done) });

  // the waiter's bell — only when the store switched it on (it is off unless the owner turns it on in Settings)
  const newlyReady = stage === "ready" ? changed : [];
  if (newlyReady.length) {
    const cfg = (await effectiveOutletConfig(ctx)).kitchenDisplay;
    if (cfg?.notifyWaiter) {
      const table = done.tableId ? await TableModel.findOne(tenantFilter(ctx, { _id: done.tableId })).select("number").lean() : null;
      broadcast(ctx.outletId, {
        type: "kds.ready",
        orderId: String(done._id),
        orderNumber: done.orderNumber,
        channel: done.channel,
        tableNumber: table?.number ?? null,
        stations: newlyReady,
        orderReady: done.status === "ready",
      });
    }
  }
  return wire(done);
}

/* ------------------------------------------------------------------ dishes: sold out / unavailable / available */

export const ITEM_STATES = ["available", "sold-out", "unavailable"];

/** What the kitchen sees of a dish: the state (the dish's own switch, or a counted stock that has run out), and its count if it has one. */
function itemView(d, categoryName) {
  const counted = d.stock?.tracked ? { left: Math.max(0, d.stock.left ?? 0), daily: d.stock.daily ?? null, lowAt: d.stock.lowAt ?? 5 } : null;
  const countedOut = counted !== null && counted.left <= 0;
  const state = !d.isAvailable ? (d.offReason === "sold-out" ? "sold-out" : "unavailable") : countedOut ? "sold-out" : "available";
  return {
    id: String(d._id),
    name: d.name,
    categoryId: d.categoryId ?? null,
    categoryName,
    foodType: d.foodType ?? "veg",
    image: d.images?.[0]?.url ?? null,
    state,
    switchedOff: !d.isAvailable,
    stock: counted,
    low: counted !== null && counted.left > 0 && counted.left <= counted.lowAt,
    changedAt: !d.isAvailable ? (d.offAt ?? null) : null,
  };
}

/** Every dish of the outlet with its state — for the kitchen's "Dishes" screen. */
export async function listKitchenItems(ctx) {
  const [items, categories] = await Promise.all([
    MenuItemModel.find(tenantFilter(ctx)).sort({ sortOrder: 1, name: 1 }).lean(),
    MenuCategoryModel.find(tenantFilter(ctx)).sort({ sortOrder: 1, name: 1 }).select("name").lean(),
  ]);
  const names = new Map(categories.map((c) => [String(c._id), c.name]));
  return { items: items.map((d) => itemView(d, names.get(String(d.categoryId)) ?? "")), categories: categories.map((c) => ({ id: String(c._id), name: c.name })) };
}

/**
 * Switch one dish available / sold out / unavailable. This is the dish's own switch, so every screen (the storefront, the staff app, the order check)
 * obeys it at once. A counted dish that has none left stays sold out when put back unless a number is given (`left`).
 */
export async function setItemState(ctx, user, id, state, left) {
  if (left !== undefined) {
    const cur = await MenuItemModel.findOne(tenantFilter(ctx, { _id: id })).select("stock").lean();
    if (!cur) throw new HttpError(404, "Dish not found");
    if (!cur.stock?.tracked) throw new HttpError(400, "This dish isn't counted, so there is no number to set.");
  }
  const now = new Date();
  const set =
    state === "available"
      ? { isAvailable: true, offReason: "", offAt: null, offBy: "" }
      : { isAvailable: false, offReason: state, offAt: now, offBy: String(user._id) };
  if (left !== undefined) set["stock.left"] = left;
  const doc = await MenuItemModel.findOneAndUpdate(tenantFilter(ctx, { _id: id }), { $set: set }, { new: true }).lean();
  if (!doc) throw new HttpError(404, "Dish not found");
  const category = doc.categoryId ? await MenuCategoryModel.findOne(tenantFilter(ctx, { _id: doc.categoryId })).select("name").lean() : null;
  const view = itemView(doc, category?.name ?? "");
  return { ...view, stillSoldOut: state === "available" && view.state === "sold-out" };
}

/* ------------------------------------------------------------------ the kitchen manager's summary */

/** Today (India time): what is on the screen now, how many orders were made ready, how long they took, and what was cooked most. */
export async function kitchenSummary(ctx) {
  const cfg = (await effectiveOutletConfig(ctx)).kitchenDisplay;
  const board = await listKitchenOrders(ctx, "all");
  const now = { new: 0, preparing: 0, ready: 0 };
  for (const o of board.orders) now[o.stage] = (now[o.stage] ?? 0) + 1;
  const dayStart = new Date(`${istDayKey()}T00:00:00+05:30`);
  const done = await OrderModel.find(tenantFilter(ctx, { statusHistory: { $elemMatch: { status: "ready", at: { $gte: dayStart } } } }))
    .select("orderNumber statusHistory createdAt lines")
    .limit(800)
    .lean();
  let total = 0, slowest = null, late = 0;
  const made = new Map();
  for (const o of done) {
    const readyAt = new Date((o.statusHistory ?? []).find((h) => h.status === "ready")?.at ?? 0).getTime();
    const minutes = Math.max(0, Math.round((readyAt - new Date(acceptedAt(o)).getTime()) / 60000));
    total += minutes;
    if (minutes > cfg.lateAfterMinutes) late += 1;
    if (!slowest || minutes > slowest.minutes) slowest = { orderNumber: o.orderNumber, minutes };
    for (const l of expandCombos(o.lines ?? [])) made.set(l.name, (made.get(l.name) ?? 0) + (l.quantity ?? 1));
  }
  return {
    now,
    today: {
      ready: done.length,
      averageMinutes: done.length ? Math.round(total / done.length) : null,
      lateCount: late,
      slowest,
      topDishes: [...made.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, quantity]) => ({ name, quantity })),
    },
    settings: { warnAfterMinutes: cfg.warnAfterMinutes, lateAfterMinutes: cfg.lateAfterMinutes },
  };
}
