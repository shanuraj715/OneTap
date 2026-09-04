import { useQuery } from "@tanstack/react-query";
import * as api from "./api";
                                    

export function useCustomers(outlet                    , q        ) {
  return useQuery({
    queryKey: ["customers", outlet?._id, q],
    queryFn: () => api.listCustomers(outlet , q || undefined),
    enabled: Boolean(outlet),
  });
}

export function useCustomerWallet(outlet                    , customerId               ) {
  return useQuery({
    queryKey: ["customer-wallet", outlet?._id, customerId],
    queryFn: () => api.getCustomerWallet(outlet , customerId ),
    enabled: Boolean(outlet) && Boolean(customerId),
  });
}
