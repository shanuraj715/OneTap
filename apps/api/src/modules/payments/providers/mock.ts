import { createHmac, randomUUID } from "node:crypto";
import { env } from "../../../env";
import { safeEqual } from "../../../lib/crypto";
import type {
  CreateIntentInput,
  PaymentIntent,
  PaymentProvider,
  VerifyInput,
  VerifyResult,
} from "./types";

const sign = (orderId: string, paymentId: string) =>
  createHmac("sha256", env.ENCRYPTION_KEY).update(`${orderId}|${paymentId}`).digest("hex");

/**
 * A simulated gateway so the whole online-payment path — intent, checkout,
 * signature verification, order settlement — can be exercised locally before any
 * real Razorpay credentials exist. Refuses to run in production.
 */
export const mockProvider: PaymentProvider = {
  id: "mock",
  isOnline: true,
  requiredFields: [],

  async createIntent(_creds, input: CreateIntentInput): Promise<PaymentIntent> {
    if (!env.ALLOW_MOCK_GATEWAY) throw new Error("The test gateway is disabled");
    const gatewayOrderId = `mock_order_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
    const paymentId = `mock_pay_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
    return {
      gatewayOrderId,
      clientParams: {
        simulated: true,
        order_id: gatewayOrderId,
        amount: input.amount,
        currency: input.currency,
        // the "checkout" hands these straight back, exactly like a real SDK would
        payment_id: paymentId,
        signature: sign(gatewayOrderId, paymentId),
      },
    };
  },

  async verify(_creds, input: VerifyInput): Promise<VerifyResult> {
    if (!env.ALLOW_MOCK_GATEWAY) return { ok: false, reason: "The test gateway is disabled" };
    const paymentId = input.payload.payment_id;
    const signature = input.payload.signature;
    if (!paymentId || !signature) return { ok: false, reason: "Missing payment id or signature" };
    if (!safeEqual(sign(input.gatewayOrderId, paymentId), signature)) {
      return { ok: false, reason: "Signature did not match" };
    }
    return { ok: true, gatewayPaymentId: paymentId };
  },
};
