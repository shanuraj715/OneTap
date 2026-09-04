import { createHmac } from "node:crypto";
import { safeEqual } from "../../../lib/crypto.js";
             
                    
                     
                
                  
              
               
               
                
                 

const API = "https://api.razorpay.com/v1";

const hmac = (secret        , data        ) => createHmac("sha256", secret).update(data).digest("hex");

/**
 * Razorpay, using the outlet's OWN account. Money settles directly to the
 * restaurant — OneTap never holds funds, which keeps us outside RBI Payment
 * Aggregator regulation.
 *
 * Docs: https://razorpay.com/docs/api/orders/ and /docs/webhooks/validate-test/
 */
export const razorpayProvider                  = {
  id: "razorpay",
  isOnline: true,
  requiredFields: ["keyId", "keySecret"],

  async createIntent(creds                    , input                   )                         {
    const auth = Buffer.from(`${creds.keyId}:${creds.keySecret}`).toString("base64");
    const res = await fetch(`${API}/orders`, {
      method: "POST",
      headers: { authorization: `Basic ${auth}`, "content-type": "application/json" },
      body: JSON.stringify({
        amount: input.amount, // Razorpay also works in paise
        currency: input.currency,
        receipt: input.receipt,
        notes: input.notes ?? {},
      }),
    });

    const body = (await res.json().catch(() => ({})))     
                  
                                       
     ;
    if (!res.ok || !body.id) {
      throw new Error(body.error?.description ?? `Razorpay rejected the order (${res.status})`);
    }

    return {
      gatewayOrderId: body.id,
      clientParams: {
        // safe to expose — the key id is public, the secret never leaves the API
        key: creds.keyId,
        order_id: body.id,
        amount: input.amount,
        currency: input.currency,
      },
    };
  },

  async verify(creds                    , input             )                        {
    const paymentId = input.payload.razorpay_payment_id;
    const signature = input.payload.razorpay_signature;
    if (!paymentId || !signature) return { ok: false, reason: "Missing payment id or signature" };

    const expected = hmac(creds.keySecret ?? "", `${input.gatewayOrderId}|${paymentId}`);
    if (!safeEqual(expected, signature)) return { ok: false, reason: "Signature did not match" };

    return { ok: true, gatewayPaymentId: paymentId };
  },

  async parseWebhook(creds                    , input              )                         {
    const signature = input.headers["x-razorpay-signature"];
    const secret = creds.webhookSecret;

    // Without a webhook secret we cannot trust the payload at all.
    if (!secret || !signature || !safeEqual(hmac(secret, input.rawBody), signature)) {
      return { verified: false, eventId: "", eventType: "unknown" };
    }

    const event = JSON.parse(input.rawBody)     
                     
                                                                                               
     ;
    const entity = event.payload?.payment?.entity;
    const type = event.event ?? "unknown";

    const status =
      type === "payment.captured" ? "paid" : type === "payment.failed" ? "failed" : type.startsWith("refund") ? "refunded" : undefined;

    return {
      verified: true,
      eventId: `${type}:${entity?.id ?? input.rawBody.length}`,
      eventType: type,
      gatewayOrderId: entity?.order_id,
      gatewayPaymentId: entity?.id,
      status,
    };
  },
};
