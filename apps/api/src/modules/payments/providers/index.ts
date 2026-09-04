import type { Gateway } from "@onetap/config-schema";
import { codProvider } from "./cod";
import { mockProvider } from "./mock";
import { razorpayProvider } from "./razorpay";
import type { PaymentProvider } from "./types";

/** The adapter registry. Adding a gateway is a new file plus one entry here. */
export const PAYMENT_PROVIDERS: Record<Gateway, PaymentProvider> = {
  cod: codProvider,
  razorpay: razorpayProvider,
  mock: mockProvider,
};

export const providerFor = (gateway: Gateway): PaymentProvider => PAYMENT_PROVIDERS[gateway];

export * from "./types";
