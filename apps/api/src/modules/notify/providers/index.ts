import type { NotifyOrderChannel } from "@onetap/config-schema";
import { smsProvider } from "./sms";
import { whatsappProvider } from "./whatsapp";
import type { NotifyProvider } from "./types";

/** The adapter registry. Adding a channel is a new file plus one entry here. */
export const NOTIFY_PROVIDERS: Record<NotifyOrderChannel, NotifyProvider> = {
  whatsapp: whatsappProvider,
  sms: smsProvider,
};

export const providerFor = (channel: NotifyOrderChannel): NotifyProvider => NOTIFY_PROVIDERS[channel];

export * from "./types";
