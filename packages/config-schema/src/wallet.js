import { z } from "zod";

/**
 * The coin / loyalty wallet. A customer earns coins on what they actually pay,
 * and can spend them against a later order's bill — the classic "cashback
 * points" restaurants run, kept entirely in-house (no third-party loyalty
 * platform, no fee per redemption).
 */
export const walletSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  /** paise spent per coin earned — 1000 = "1 coin per ₹10 spent" */
  earnRatePaise: z.number().int().min(100).max(1_000_000).default(1000),
  /** paise a coin is worth when spent — 100 = "1 coin = ₹1" */
  redeemValuePaise: z.number().int().min(1).max(1_000_000).default(100),
  /** an order must reach this before it earns anything; 0 = always earns */
  minOrderToEarn: z.number().int().min(0).default(0),
  /** coins can cover at most this share of an order's item total */
  maxRedeemPercent: z.number().int().min(1).max(100).default(50),
  /** coins from a cancelled order are always reversed regardless of this —
   *  this only controls whether a *redeemed but never spent* balance can go
   *  stale; 0 = coins never expire */
  expiryDays: z.number().int().min(0).max(3650).default(0),
});
                                                                  

/** Coins earned on an amount actually paid, per the outlet's rate. */
export function coinsEarnedFor(paidPaise        , settings                )         {
  if (!settings.enabled || paidPaise < settings.minOrderToEarn) return 0;
  return Math.floor(paidPaise / settings.earnRatePaise);
}

/** What a coin balance is worth, in paise, before any redemption cap. */
export function coinsValuePaise(coins        , settings                )         {
  return Math.max(0, coins) * settings.redeemValuePaise;
}

;                             
              
                                                                                
                       
                                    
                        
                  
 

/**
 * How many of the coins a customer asked to spend can actually be applied to
 * this cart, and what that's worth. Never trusts the caller's coin balance —
 * `walletBalance` must come from the database at the moment of the check.
 */
export function checkRedeem(
  requestedCoins        ,
  walletBalance        ,
  subtotalPaise        ,
  settings                ,
)              {
  const deny = (reason        )              => ({ ok: false, coinsApplied: 0, discountPaise: 0, reason });

  if (!settings.enabled) return deny("The coin wallet isn't switched on for this outlet.");
  if (requestedCoins <= 0) return deny("Choose at least 1 coin to redeem.");
  if (requestedCoins > walletBalance) {
    return deny(`You only have ${walletBalance} coin${walletBalance === 1 ? "" : "s"}.`);
  }

  const capPaise = Math.floor((subtotalPaise * settings.maxRedeemPercent) / 100);
  const requestedPaise = coinsValuePaise(requestedCoins, settings);

  if (requestedPaise <= capPaise) {
    return { ok: true, coinsApplied: requestedCoins, discountPaise: requestedPaise };
  }

  // Trim to the cap rather than rejecting outright — a customer offering more
  // coins than the cap allows just gets the cap's worth applied.
  const cappedCoins = Math.floor(capPaise / settings.redeemValuePaise);
  if (cappedCoins <= 0) {
    return deny(`Coins can only cover up to ${settings.maxRedeemPercent}% of this order.`);
  }
  return { ok: true, coinsApplied: cappedCoins, discountPaise: coinsValuePaise(cappedCoins, settings) };
}
