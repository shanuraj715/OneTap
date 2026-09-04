import { isProd } from "../../env";
import { logger } from "../../logger";

export type NotifyChannel = "sms" | "email";

export interface NotifyResult {
  /** true once a real provider actually accepted the message */
  delivered: boolean;
  /** dev only: the code, so you can sign in without a provider configured */
  devCode?: string;
}

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
  channel: NotifyChannel,
  destination: string,
  code: string,
): Promise<NotifyResult> {
  logger.info(`[notify:${channel}] OTP for ${destination} → ${code} (no provider configured)`);
  return { delivered: false, devCode: isProd ? undefined : code };
}

export function hasProvider(_channel: NotifyChannel): boolean {
  return false;
}
