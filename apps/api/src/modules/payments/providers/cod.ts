import type { PaymentProvider } from "./types";

/**
 * Cash / pay at the counter. No gateway, no credentials — the order is simply
 * marked paid when staff complete it.
 */
export const codProvider: PaymentProvider = {
  id: "cod",
  isOnline: false,
  requiredFields: [],

  async createIntent() {
    throw new Error("Cash orders don't need a payment intent");
  },

  async verify() {
    return { ok: false, reason: "Cash orders are settled by staff, not verified online" };
  },
};
