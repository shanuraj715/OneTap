import type { Gateway } from "@onetap/config-schema";

export interface GatewayCredentials {
  /** decrypted, in memory only */
  [field: string]: string;
}

export interface CreateIntentInput {
  /** integer paise */
  amount: number;
  currency: string;
  /** our order number — shown on the gateway's dashboard */
  receipt: string;
  notes?: Record<string, string>;
}

export interface PaymentIntent {
  /** the gateway's order/intent id */
  gatewayOrderId: string;
  /** everything the storefront needs to open the gateway's checkout */
  clientParams: Record<string, unknown>;
}

export interface VerifyInput {
  gatewayOrderId: string;
  /** whatever the gateway's client SDK handed back */
  payload: Record<string, string>;
}

export interface VerifyResult {
  ok: boolean;
  gatewayPaymentId?: string;
  reason?: string;
}

export interface WebhookInput {
  rawBody: string;
  headers: Record<string, string | undefined>;
}

export interface WebhookResult {
  /** false means the signature didn't check out — reject with 400 */
  verified: boolean;
  /** the gateway's event id, for replay protection */
  eventId: string;
  eventType: string;
  gatewayOrderId?: string;
  gatewayPaymentId?: string;
  status?: "paid" | "failed" | "refunded";
}

/**
 * Every gateway implements this. Adding one is a new file plus a registry entry —
 * the same adapter pattern used for storage, notifications and printing.
 */
export interface PaymentProvider {
  id: Gateway;
  /** true when the diner is redirected to / shown a gateway checkout */
  isOnline: boolean;
  /** which credential fields must be present before it can be enabled */
  requiredFields: string[];

  createIntent(creds: GatewayCredentials, input: CreateIntentInput): Promise<PaymentIntent>;
  verify(creds: GatewayCredentials, input: VerifyInput): Promise<VerifyResult>;
  parseWebhook?(creds: GatewayCredentials, input: WebhookInput): Promise<WebhookResult>;
}
