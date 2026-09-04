import { useQuery } from "@tanstack/react-query";
import * as api from "./api";
import type { Outlet } from "./api";

export function useCustomers(outlet: Outlet | undefined, q: string) {
  return useQuery({
    queryKey: ["customers", outlet?._id, q],
    queryFn: () => api.listCustomers(outlet!, q || undefined),
    enabled: Boolean(outlet),
  });
}

export function useCustomerWallet(outlet: Outlet | undefined, customerId: string | null) {
  return useQuery({
    queryKey: ["customer-wallet", outlet?._id, customerId],
    queryFn: () => api.getCustomerWallet(outlet!, customerId!),
    enabled: Boolean(outlet) && Boolean(customerId),
  });
}
