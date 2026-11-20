import { z } from "zod";
import { comboDetails, describeWindows, stockLeft, stockNeeds, unavailability, windowsForItem } from "./menu.js";

/**
 * How the order is fulfilled. "Counter" isn't here — a walk-in a cashier bills
 * is still a takeaway (or dine-in, or delivery); who rang it in is a separate
 * fact, see {@link PlacedBy}.
 */
export const ORDER_CHANNELS = ["takeaway", "dine-in", "delivery"]         ;
export const orderChannelSchema = z.enum(ORDER_CHANNELS);
                                                           

/**
 * Who actually put the order into the system. A customer self-serving through
 * the storefront, or a staff member keying it in on their behalf (a walk-in
 * paying at the till, a phoned-in order, a table a waiter takes verbally) —
 * independent of {@link OrderChannel}, so any channel can be either.
 */
export const PLACED_BY_VALUES = ["customer", "staff"]         ;
export const placedBySchema = z.enum(PLACED_BY_VALUES);
                                                         

export const PLACED_BY_LABELS                           = {
  customer: "Customer",
  staff: "Staff",
};
/** Single-letter chip text — kept short on purpose for a narrow table column. */
export const PLACED_BY_INITIAL                           = {
  customer: "C",
  staff: "S",
};

export const ORDER_STATUSES = [
  "placed",
  "accepted",
  "preparing",
  "ready",
  // delivery orders only: the rider has left with it
  "out_for_delivery",
  "completed",
  "cancelled",
]         ;
export const orderStatusSchema = z.enum(ORDER_STATUSES);


export const ORDER_STATUS_LABELS                              = {
  placed: "Placed",
  accepted: "Accepted",
  preparing: "Preparing",
  ready: "Ready",
  out_for_delivery: "Out for delivery",
  completed: "Completed",
  cancelled: "Cancelled",
};

/** Which statuses an order can move to next. "Out for delivery" is for delivery orders only — see nextStatusesFor. */
export const NEXT_STATUSES                                     = {
  placed: ["accepted", "cancelled"],
  accepted: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["out_for_delivery", "completed"],
  out_for_delivery: ["completed"],
  completed: [],
  cancelled: [],
};

/** The statuses an order of this channel can move to next — a takeaway or dine-in order never goes "out for delivery". */
export function nextStatusesFor(status, channel) {
  const next = NEXT_STATUSES[status] ?? [];
  return channel === "delivery" ? next : next.filter((s) => s !== "out_for_delivery");
}

/** A status as the people of this order say it: a completed delivery is "Delivered". */
export function statusLabelFor(status, channel) {
  if (status === "completed" && channel === "delivery") return "Delivered";
  return ORDER_STATUS_LABELS[status] ?? status;
}

/** Still being worked on (not finished, not cancelled). */
export const OPEN_ORDER_STATUSES = ["placed", "accepted", "preparing", "ready", "out_for_delivery"];

/* ------------------------------------------------------------------- cart in */

export const cartLineSchema = z.object({
  itemId: z.string(),
  variantId: z.string().optional(),
  modifierOptionIds: z.array(z.string()).default([]),
  quantity: z.number().int().positive().max(99),
  note: z.string().max(200).optional(),
});
                                                      

export const cartSchema = z.object({
  lines: z.array(cartLineSchema).min(1),
  /** a coupon the diner entered — validated and applied server-side */
  couponCode: z.string().max(24).optional(),
  /** coins the diner asked to spend — validated against their real balance server-side */
  redeemCoins: z.number().int().min(0).max(1_000_000).optional(),
});
                                              

/* ----------------------------------------------------------------- priced out */

                                 
             
                
                     
 

                             
                 
               
                                 
                     
                        
                              
                   
                                            
                    
                    
                     
                
 

                              
                   
                                             
                   
                                                                   
                      
                                  
                        
                                                                      
                        
                                                                              
                                                               
                      
                  
               
               
                    
                        
                   
                     
 

                                
               
                   
 

                              
                      
                      
                            
                                                                  
                         
                                                                 
                       
                                                                                        
                      
 

/** Extras the pricing engine folds into the total beyond the line items. */
                              
                                                                  
                    
                                                       
                      
                       
                                 
                       
                                                                          
                         
                                                                      
                         
 

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
export function priceCart(cart      , menu      , tax           , extras              = {}, opts = {})              {
  const itemsById = new Map(menu.items.map((i) => [i.id, i]));
  const groupsById = new Map(menu.modifierGroups.map((g) => [g.id, g]));
  const categoriesById = new Map((menu.categories ?? []).map((c) => [c.id, c]));
  // the moment the food is wanted (a pre-order's pickup time) — what the breakfast-only hours are checked against
  const at = opts.at ?? Date.now();

  // Counted stock: the whole cart at once (two lines of the same dish, or a dish inside a combo, add up). Stock this
  // same order already holds (an edit) is counted as still there.
  for (const [itemId, wanted] of stockNeeds(cart.lines, menu)) {
    const item = itemsById.get(itemId);
    const left = (stockLeft(item) ?? 0) + (opts.stockCredit?.get(itemId) ?? 0);
    if (wanted > left) throw new PricingError(left <= 0 ? `${item.name} is sold out` : `Only ${left} ${item.name} left — reduce the quantity`);
  }

  const lines               = cart.lines.map((line) => {
    const item = itemsById.get(line.itemId);
    if (!item) throw new PricingError("An item in your cart is no longer on the menu");
    const why = unavailability(item, { itemsById, categoriesById, at, ignoreTimes: opts.ignoreTimes });
    if (why?.reason === "time") throw new PricingError(`${item.name} is only available ${describeWindows(windowsForItem(item, categoriesById))}`);
    if (why?.reason === "combo") throw new PricingError(`${item.name} isn't available right now — part of it is ${why.label === "Sold out" ? "sold out" : "not being served now"}`);
    if (why) throw new PricingError(`${item.name} is sold out`);

    let unitPrice        ;
    let variantLabel                    ;
    if (item.variants.length > 0) {
      const variant = item.variants.find((v) => v.id === line.variantId);
      if (!variant) throw new PricingError(`Choose a size for ${item.name}`);
      unitPrice = variant.price;
      variantLabel = variant.label;
    } else {
      unitPrice = item.basePrice;
    }

    // Only options from groups actually attached to this item count.
    const allowed = new Map                        ();
    for (const groupId of item.modifierGroupIds) {
      for (const opt of groupsById.get(groupId)?.options ?? []) {
        allowed.set(opt.id, { id: opt.id, label: opt.label, priceDelta: opt.priceDelta });
      }
    }
    const modifiers                   = [];
    for (const id of line.modifierOptionIds) {
      const opt = allowed.get(id);
      if (!opt) throw new PricingError(`An add-on for ${item.name} is no longer available`);
      modifiers.push(opt);
      unitPrice += opt.priceDelta;
    }

    const priced = {
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
    // a combo carries what it is made of, so the kitchen ticket can say what to cook (and send each part to its printer)
    const combo = comboDetails(item, itemsById);
    if (combo) priced.includes = combo.parts.map((p) => ({ itemId: p.itemId, name: p.name, variantLabel: p.variantLabel, quantity: p.quantity }));
    return priced;
  });

  const totals = totalsFor(lines, tax, extras);
  const out              = { lines, totals, pricesIncludeTax: tax.pricesIncludeTax };
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
export function totalsFor(lines              , tax           , extras              = {})              {
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
