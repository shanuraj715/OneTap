import { MAX_SUGGESTIONS, menuForNow } from "@rasoipulse/config-schema";
import { OrderModel, tenantFilter } from "@rasoipulse/db";
import { cache } from "../cache/cache.js";
import { effectiveOutletConfig } from "../outlets/config.service.js";
import { publicOutletById } from "../outlets/outlet-cache.js";
import { getMenu } from "./menu.service.js";

/**
 * "Goes well with your order": what to suggest to someone with `itemIds` in their cart.
 *
 *  1. the dishes the owner picked for those dishes ("Goes well with" in the dish editor), in the order picked;
 *  2. then, when the outlet allows it, what other customers most often ordered together with them (worked out from the
 *     last 90 days of completed orders, kept for 6 hours).
 *
 * Only dishes that can be ordered right now and need no choices beyond a size (a dish with a required add-on can't be
 * added with one tap) — and nothing already in the cart.
 */
export async function suggestionsFor(ctx, itemIds) {
  const config = (await publicOutletById(ctx.outletId))?.config ?? (await effectiveOutletConfig(ctx));
  const settings = config.upsell ?? { enabled: true, auto: true, title: "Goes well with your order" };
  if (!settings.enabled || !itemIds.length) return { title: settings.title, items: [] };

  const menu = menuForNow(await getMenu(ctx));
  const byId = new Map(menu.items.map((i) => [i.id, i]));
  const groups = new Map(menu.modifierGroups.map((g) => [g.id, g]));
  const inCart = new Set(itemIds);
  const oneTap = (item) =>
    item.isAvailable && !item.modifierGroupIds.some((gid) => {
      const g = groups.get(gid);
      return g && (g.required || g.minSelect > 0);
    });

  const picked = [];
  const take = (id) => {
    if (picked.length >= MAX_SUGGESTIONS || inCart.has(id) || picked.includes(id)) return;
    const item = byId.get(id);
    if (item && oneTap(item)) picked.push(id);
  };
  for (const id of itemIds) for (const p of byId.get(id)?.pairsWith ?? []) take(p);
  if (settings.auto && picked.length < MAX_SUGGESTIONS) {
    const together = await orderedTogether(ctx);
    // the strongest pairings across everything in the cart first
    const score = new Map();
    for (const id of itemIds) for (const [other, n] of together[id] ?? []) score.set(other, (score.get(other) ?? 0) + n);
    for (const [other] of [...score].sort((a, b) => b[1] - a[1])) take(other);
  }

  return {
    title: settings.title,
    items: picked.map((id) => {
      const item = byId.get(id);
      return { itemId: id, variantId: item.variants[0]?.id ?? null };
    }),
  };
}

/** For each dish, the dishes most often in the same completed order: { itemId: [[otherId, timesTogether], …] } (top 8). */
function orderedTogether(ctx) {
  return cache.wrap(
    `pairs:${ctx.outletId}`,
    async () => {
      const since = new Date(Date.now() - 90 * 86_400_000);
      const orders = await OrderModel.find(tenantFilter(ctx, { status: "completed", createdAt: { $gte: since } }))
        .sort({ createdAt: -1 })
        .limit(3000)
        .select("lines.itemId")
        .lean();
      const counts = new Map();
      for (const o of orders) {
        const ids = [...new Set((o.lines ?? []).map((l) => String(l.itemId)).filter(Boolean))];
        for (const a of ids) {
          if (!counts.has(a)) counts.set(a, new Map());
          for (const b of ids) if (a !== b) counts.get(a).set(b, (counts.get(a).get(b) ?? 0) + 1);
        }
      }
      const out = {};
      for (const [a, m] of counts) out[a] = [...m].filter(([, n]) => n >= 2).sort((x, y) => y[1] - x[1]).slice(0, 8);
      return out;
    },
    { maxAgeMs: 6 * 3_600_000, tags: [`brand:${ctx.brandId}`, "ns:pairs"] },
  );
}
