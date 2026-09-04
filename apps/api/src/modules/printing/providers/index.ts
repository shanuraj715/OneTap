import type { PrintTarget } from "@onetap/config-schema";
import { cloudProvider } from "./cloud";
import { agentProvider, browserProvider, eposProvider } from "./pull";
import type { PrintProvider } from "./types";

export const PRINT_PROVIDERS: Record<PrintTarget, PrintProvider> = {
  browser: browserProvider,
  "epos-lan": eposProvider,
  cloud: cloudProvider,
  agent: agentProvider,
};

export const providerFor = (target: PrintTarget): PrintProvider => PRINT_PROVIDERS[target];

export type { DispatchResult, PrintProvider } from "./types";
