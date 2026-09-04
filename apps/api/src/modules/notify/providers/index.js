                                                                
import { smsProvider } from "./sms.js";
import { whatsappProvider } from "./whatsapp.js";
                                              

/** The adapter registry. Adding a channel is a new file plus one entry here. */
export const NOTIFY_PROVIDERS                                             = {
  whatsapp: whatsappProvider,
  sms: smsProvider,
};

export const providerFor = (channel                    )                 => NOTIFY_PROVIDERS[channel];

export * from "./types.js";
