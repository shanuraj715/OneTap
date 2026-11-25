import "@rasoipulse/ui/tokens.css";
import "./index.css";

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { isStoreDisabledError } from "./lib/api";

// If Rasoi Pulse switches a store off while its team has the dashboard open, their next request is turned away.
// Re-read who they are: the session now says the store is disabled, and the app shows that notice instead of
// a screen full of errors.
const whenStoreDisabled = (error) => {
  if (isStoreDisabledError(error)) void queryClient.invalidateQueries({ queryKey: ["me"] });
};

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: whenStoreDisabled }),
  mutationCache: new MutationCache({ onError: whenStoreDisabled }),
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("#root not found");

createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
