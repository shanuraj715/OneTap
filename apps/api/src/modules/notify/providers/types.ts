import type { NotifyOrderChannel, NotifyVariable, OrderStatus } from "@onetap/config-schema";

export interface NotifyCredentials {
  /** decrypted, in memory only */
  [field: string]: string;
}

export interface SendInput {
  /** phone number in whatever form the customer gave, digits and a leading + */
  to: string;
  event: OrderStatus;
  values: Record<NotifyVariable, string>;
  /** WhatsApp only: the pre-approved template to fire */
  whatsapp?: { templateName: string; languageCode: string };
  /** SMS only: the fully rendered message text */
  message?: string;
}

export interface SendResult {
  ok: boolean;
  providerMessageId?: string;
  reason?: string;
}

/**
 * Every notification channel implements this — the same adapter pattern as
 * payment gateways and printers. Adding a channel is a new file plus a
 * registry entry.
 */
export interface NotifyProvider {
  id: NotifyOrderChannel;
  requiredFields: string[];
  send(creds: NotifyCredentials, input: SendInput): Promise<SendResult>;
}
