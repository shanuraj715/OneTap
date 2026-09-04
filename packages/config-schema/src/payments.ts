import { z } from "zod";

export const GATEWAYS = ["cod", "razorpay", "mock"] as const;
export const gatewaySchema = z.enum(GATEWAYS);
export type Gateway = (typeof GATEWAYS)[number];

export const GATEWAY_LABELS: Record<Gateway, string> = {
  cod: "Cash / pay at counter",
  razorpay: "Razorpay",
  mock: "Test gateway (dev only)",
};

export const GATEWAY_DESCRIPTIONS: Record<Gateway, string> = {
  cod: "No credentials needed. The diner pays when they collect.",
  razorpay: "UPI, cards, wallets and netbanking. Uses this outlet's own Razorpay account — money settles directly to them.",
  mock: "Simulates a successful online payment so you can exercise the flow before real keys exist. Never enabled in production.",
};

/** Which credential fields each gateway needs. `secret: true` fields are encrypted and never returned. */
export const GATEWAY_FIELDS: Record<
  Gateway,
  { key: string; label: string; secret: boolean; hint?: string; info?: string }[]
> = {
  cod: [],
  mock: [],
  razorpay: [
    {
      key: "keyId",
      label: "Key ID",
      secret: false,
      hint: "Starts with rzp_test_ or rzp_live_",
      info: "The public half of your Razorpay credentials, from Dashboard → Settings → API Keys. Safe to share — it identifies your account when a customer starts a payment. Use the rzp_test_ key until you have taken a real order end to end.",
    },
    {
      key: "keySecret",
      label: "Key Secret",
      secret: true,
      info: "The private half of the pair, shown by Razorpay only once when you generate the key. Anyone holding it can charge and refund on your account, so it is encrypted before it is stored and never shown here again. If it has ever been pasted into a chat or an email, regenerate it.",
    },
    {
      key: "webhookSecret",
      label: "Webhook Secret",
      secret: true,
      hint: "Optional, but strongly recommended",
      info: "Lets us prove that a 'payment succeeded' message really came from Razorpay and not from someone pretending. Without it, a customer who closes the browser mid-payment can leave an order stuck as unpaid even though the money went through.",
    },
  ],
};

/**
 * The PUBLIC payment settings that live in outlet config. Credentials never go
 * here — the storefront reads this config, so secrets live in their own
 * collection, encrypted.
 */
export const paymentSettingsSchema = z.object({
  /** gateways the diner may choose at checkout, in order */
  enabled: z.array(gatewaySchema).default(["cod"]),
  /** test vs live behaviour for gateways that distinguish them */
  testMode: z.boolean().default(true),
});
export type PaymentSettings = z.infer<typeof paymentSettingsSchema>;

export const PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded"] as const;
export const paymentStatusSchema = z.enum(PAYMENT_STATUSES);
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
