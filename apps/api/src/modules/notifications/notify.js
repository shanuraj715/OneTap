import { isProd } from "../../env.js";
import { logger } from "../../logger.js";

                                            

                               
                                                                
                     
                                                                             
                   
 

/**
 * Notification provider registry — placeholder.
 *
 * No SMS/email provider is configured yet, so this logs the message and (outside
 * production) hands the code back to the caller. When a real provider lands it
 * becomes an adapter behind this same function.
 *
 * In production with no provider, OTP-gated ordering must stay switched off —
 * see the guard in customer.service.ts.
 */
export async function sendOtp(
  channel               ,
  destination        ,
  code        ,
)                        {
  logger.info(`[notify:${channel}] OTP for ${destination} → ${code} (no provider configured)`);
  return { delivered: false, devCode: isProd ? undefined : code };
}

export function hasProvider(_channel               )          {
  return false;
}
