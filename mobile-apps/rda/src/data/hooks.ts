import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { REFRESH_MS } from "@/lib/config";
import { useApi, useSession } from "@/runtime";
import { keys } from "./keys";

/** The rider's deliveries. They refresh by themselves while the app is open (a new delivery must show within seconds) and stop in the background. */
export function useDeliveries() {
  const api = useApi();
  const signedIn = useSession((s) => s.status === "signed-in");
  return useQuery({ queryKey: keys.deliveries, queryFn: () => api.deliveries(), refetchInterval: REFRESH_MS.deliveries, enabled: signedIn, placeholderData: keepPreviousData });
}

/** "I have the food." Asks for the list again afterwards, so what the rider sees is what the server holds. */
export function usePickUp() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api.pickUp(id), onSettled: () => qc.invalidateQueries({ queryKey: keys.deliveries }) });
}

/** "I handed it over", with the customer's code when the order has one. */
export function useDeliver() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, code }: { id: string; code?: string }) => api.deliver(id, code), onSettled: () => qc.invalidateQueries({ queryKey: keys.deliveries }) });
}
