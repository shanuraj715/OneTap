                                                     
import { codProvider } from "./cod.js";
import { mockProvider } from "./mock.js";
import { razorpayProvider } from "./razorpay.js";
                                               

/** The adapter registry. Adding a gateway is a new file plus one entry here. */
export const PAYMENT_PROVIDERS                                   = {
  cod: codProvider,
  razorpay: razorpayProvider,
  mock: mockProvider,
};

export const providerFor = (gateway         )                  => PAYMENT_PROVIDERS[gateway];

export * from "./types.js";
