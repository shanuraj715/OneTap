                                                         
import { cloudProvider } from "./cloud.js";
import { agentProvider, browserProvider, eposProvider } from "./pull.js";
                                             

export const PRINT_PROVIDERS                                     = {
  browser: browserProvider,
  "epos-lan": eposProvider,
  cloud: cloudProvider,
  agent: agentProvider,
};

export const providerFor = (target             )                => PRINT_PROVIDERS[target];

                                                             
