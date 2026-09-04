import { z } from "zod";
import type { Menu, MenuItem } from "./menu";
import type { TaxConfig } from "./tax";

/**
 * How the order is fulfilled. "Counter" isn't here — a walk-in a cashier bills
 * is still a takeaway (or dine-in, or delivery); who rang it in is a separate
 * fact, see {@link PlacedBy}.
 */
export const ORDER_CHANNELS = ["takeaway", "dine-in", "delivery"] as const;
export const orderChannelSchema = z.enum(ORDER_CHANNELS);
export type OrderChannel = (typeof ORDER_CHANNELS)[number];

/**
 * Who actually put the order into the system. A customer self-serving through
 * the storefront, or a staff member keying it in on their behalf (a walk-in
 * paying at the till, a phoned-in order, a table a waiter takes verbally) —
 * independent of {@link OrderChannel}, so any channel can be either.
 */
export const PLACED_BY_VALUES = ["customer", "staff"] as const;
export const placedBySchema = z.enum(PLACED_BY_VALUES);
export type PlacedBy = (typeof PLACED_BY_VALUES)[number];

export const PLACED_BY_LABELS: Record<PlacedBy, string> = {
  customer: "Customer",
  staff: "Staff",
};
/** Single-letter chip text — kept short on purpose for a narrow table column. */
export const PLACED_BY_INITIAL: Record<PlacedBy, string> = {
  customer: "C",
  staff: "S",
};

export const ORDER_STATUSES = [
  "placed",
  "accepted",
  "preparing",
  "ready",
  "completed",
  "cancelled",
] as const;
export const orderStatusSchema = z.enum(ORDER_STATUSES);
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  placed: "Placed",
  accepted: "Accepted",
  preparing: "Preparing",
  ready: "Ready",
  completed: "Completed",
  cancelled: "Cancelled",
};

/** Which statuses an order can move to next. */
export const NEXT_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  placed: ["accepted", "cancelled"],
  accepted: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["completed"],
  completed: [],
  cancelled: [],
};

/* ------------------------------------------------------------------- cart in */

export const cartLineSchema = z.object({
  itemId: z.string(),
  variantId: z.string().optional(),
  modifierOptionIds: z.array(z.string()).default([]),
  quantity: z.number().int().positive().max(99),
  note: z.string().max(200).optional(),
});
export type CartLine = z.infer<typeof cartLineSchema>;

export const cartSchema = z.object({
  lines: z.array(cartLineSchema).min(1),
  /** a coupon the diner entered — validated and applied server-side */
  couponCode: z.string().max(24).optional(),
  /** coins the diner asked to spend — validated against their real balance server-side */
  redeemCoins: z.number().int().min(0).max(1_000_000).optional(),
});
export type Cart = z.infer<typeof cartSchema>;

/* ----------------------------------------------------------------- priced out */

export interface PricedModifier {
  id: string;
  label: string;
  priceDelta: number;
}

export interface PricedLine {
  itemId: string;
  name: string;
  foodType: MenuItem["foodType"];
  variantId?: string;
  variantLabel?: string;
  modifiers: PricedModifier[];
  quantity: number;
  /** per unit, after modifiers, in paise */
  unitPrice: number;
  lineTotal: number;
  gstRatePct: number;
  note?: string;
}

export interface OrderTotals {
  subtotal: number;
  /** coupon discount in paise, always ≥ 0 */
  discount: number;
  /** delivery charge in paise, 0 for every non-delivery channel */
  deliveryFee: number;
  /** coins spent on this order */
  coinsRedeemed: number;
  /** paise value of coinsRedeemed — already netted into grandTotal */
  coinsDiscount: number;
  /** coins this order will earn — informational; the wallet service sets this
   *  after totalsFor (earn rate isn't a tax-config concern) */
  coinsEarned: number;
  taxable: number;
  cgst: number;
  sgst: number;
  taxAmount: number;
  serviceCharge: number;
  roundOff: number;
  grandTotal: number;
}

export interface AppliedCoupon {
  code: string;
  discount: number;
}

export interface PricedOrder {
  lines: PricedLine[];
  totals: OrderTotals;
  pricesIncludeTax: boolean;
  /** present only when a valid coupon was supplied and applied */
  coupon?: AppliedCoupon;
  /** set when the caller asked for a coupon that didn't apply */
  couponError?: string;
  /** set when the caller asked to redeem coins that couldn't be (any amount) applied */
  coinsError?: string;
}

/** Extras the pricing engine folds into the total beyond the line items. */
export interface PriceExtras {
  /** coupon discount in paise, already validated by the caller */
  discount?: number;
  /** the code, for the receipt and the order record */
  couponCode?: string;
  couponError?: string;
  /** delivery charge in paise */
  deliveryFee?: number;
  /** coins the caller has already validated against the wallet balance */
  coinsRedeemed?: number;
  /** paise value of coinsRedeemed, already validated by the caller */
  coinsDiscount?: number;
}

export class PricingError extends Error {}

/**
 * Re-price a cart from the live menu. The client never gets to say what
 * something costs — this is the single source of truth, used by both the quote
 * endpoint and order placement.
 *
 * `extras` carries the coupon discount and delivery fee. The caller (the API)
 * is responsible for validating the coupon before passing its value here; the
 * engine just folds a trusted number into the totals.
 */
export function priceCart(cart: Cart, menu: Menu, tax: TaxConfig, extras: PriceExtras = {}): PricedOrder {
  const itemsById = new Map(menu.items.map((i) => [i.id, i]));
  const groupsById = new Map(menu.modifierGroups.map((g) => [g.id, g]));

  const lines: PricedLine[] = cart.lines.map((line) => {
    const item = itemsById.get(line.itemId);
    if (!item) throw new PricingError("An item in your cart is no longer on the menu");
    if (!item.isAvailable) throw new PricingError(`${item.name} is sold out`);

    let unitPrice: number;
    let variantLabel: string | undefined;
    if (item.variants.length > 0) {
      const variant = item.variants.find((v) => v.id === line.variantId);
      if (!variant) throw new PricingError(`Choose a size for ${item.name}`);
      unitPrice = variant.price;
      variantLabel = variant.label;
    } else {
      unitPrice = item.basePrice;
    }

    // Only options from groups actually attached to this item count.
    const allowed = new Map<string, PricedModifier>();
    for (const groupId of item.modifierGroupIds) {
      for (const opt of groupsById.get(groupId)?.options ?? []) {
        allowed.set(opt.id, { id: opt.id, label: opt.label, priceDelta: opt.priceDelta });
      }
    }
    const modifiers: PricedModifier[] = [];
    for (const id of line.modifierOptionIds) {
      const opt = allowed.get(id);
      if (!opt) throw new PricingError(`An add-on for ${item.name} is no longer available`);
      modifiers.push(opt);
      unitPrice += opt.priceDelta;
    }

    return {
      itemId: item.id,
      name: item.name,
      foodType: item.foodType,
      variantId: line.variantId,
      variantLabel,
      modifiers,
      quantity: line.quantity,
      unitPrice,
      lineTotal: unitPrice * line.quantity,
      gstRatePct: item.gstRatePct || tax.defaultGstRatePct,
      note: line.note,
    };
  });

  const totals = totalsFor(lines, tax, extras);
  const out: PricedOrder = { lines, totals, pricesIncludeTax: tax.pricesIncludeTax };
  if (extras.discount && extras.couponCode) {
    out.coupon = { code: extras.couponCode, discount: totals.discount };
  }
  if (extras.couponError) out.couponError = extras.couponError;
  return out;
}

/**
 * All money is integer paise; the final total is rounded to the rupee.
 *
 * A coupon discount and any coins redeemed are both applied to the gross
 * subtotal, and the taxable value and GST are scaled down in the same
 * proportion — so a ₹100 order with ₹20 off (from either source, or both) is
 * taxed as an ₹80 order, which is how a discount is meant to work on a GST bill.
 */
export function totalsFor(lines: PricedLine[], tax: TaxConfig, extras: PriceExtras = {}): OrderTotals {
  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);

  const discount = Math.max(0, Math.min(extras.discount ?? 0, subtotal));
  const coinsDiscount = Math.max(0, Math.min(extras.coinsDiscount ?? 0, subtotal - discount));
  const coinsRedeemed = coinsDiscount > 0 ? Math.max(0, extras.coinsRedeemed ?? 0) : 0;
  const totalOff = discount + coinsDiscount;
  const deliveryFee = Math.max(0, extras.deliveryFee ?? 0);
  const netFactor = subtotal > 0 ? (subtotal - totalOff) / subtotal : 1;

  let taxable = 0;
  let taxAmount = 0;
  for (const line of lines) {
    const rate = line.gstRatePct / 100;
    // Each line's contribution, reduced by the coupon + coins proportion.
    const effective = line.lineTotal * netFactor;
    if (tax.pricesIncludeTax) {
      const net = Math.round(effective / (1 + rate));
      taxable += net;
      taxAmount += Math.round(effective) - net;
    } else {
      taxable += Math.round(effective);
      taxAmount += Math.round(effective * rate);
    }
  }

  const serviceCharge = Math.round((taxable * tax.serviceChargePct) / 100);
  const cgst = Math.round(taxAmount / 2);
  const sgst = taxAmount - cgst;

  const beforeRounding = tax.pricesIncludeTax
    ? subtotal - totalOff + serviceCharge + deliveryFee
    : subtotal - totalOff + taxAmount + serviceCharge + deliveryFee;
  const grandTotal = Math.round(beforeRounding / 100) * 100;

  return {
    subtotal,
    discount,
    deliveryFee,
    coinsRedeemed,
    coinsDiscount,
    coinsEarned: 0,
    taxable,
    cgst,
    sgst,
    taxAmount,
    serviceCharge,
    roundOff: grandTotal - beforeRounding,
    grandTotal,
  };
}
