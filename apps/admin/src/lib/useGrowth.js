import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "./api";

/* Riders, table bookings, ratings and cart reminders — the dashboard's data for them. */

export function useRiders(outlet, enabled = true) {
  return useQuery({ queryKey: ["riders", outlet?._id], queryFn: () => api.listRiders(outlet), enabled: Boolean(outlet) && enabled });
}

function useOutletMutation(outlet, fn, keys) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a) => fn(outlet, a),
    onSuccess: () => {
      for (const k of keys) void qc.invalidateQueries({ queryKey: [k] });
    },
  });
}

export const useCreateRider = (o) => useOutletMutation(o, (out, body) => api.createRider(out, body), ["riders"]);
export const useUpdateRider = (o) => useOutletMutation(o, (out, a) => api.updateRider(out, a.id, a.body), ["riders"]);
export const useDeleteRider = (o) => useOutletMutation(o, (out, id) => api.deleteRider(out, id), ["riders"]);
export const useSetRiderPin = (o) => useOutletMutation(o, (out, a) => api.setRiderPin(out, a.id, a.pin), ["riders"]);
/** The PIN is a secret: it is asked for when the dialog opens and forgotten the moment it closes (gcTime 0, no retries, never refetched in the background). */
export const useRiderPin = (outlet, riderId, enabled = true) =>
  useQuery({ queryKey: ["rider-pin", outlet?._id, riderId], queryFn: () => api.getRiderPin(outlet, riderId), enabled: Boolean(outlet && riderId) && enabled, gcTime: 0, staleTime: 0, retry: false, refetchOnWindowFocus: false });
export const useClearRiderPin = (o) => useOutletMutation(o, (out, id) => api.clearRiderPin(out, id), ["riders"]);
export const useAssignRider = (o) => useOutletMutation(o, (out, a) => api.assignRider(out, a.id, a.body), ["orders", "order-print-status"]);

export function useReservations(outlet, day, enabled = true) {
  return useQuery({ queryKey: ["reservations", outlet?._id, day], queryFn: () => api.listReservations(outlet, day), enabled: Boolean(outlet) && enabled, refetchInterval: 30_000 });
}

/** Bookings waiting to be confirmed — the sidebar badge (polled; the bookings page itself refreshes on every change). */
export function useReservationSummary(outlet, enabled = true) {
  return useQuery({ queryKey: ["reservation-summary", outlet?._id], queryFn: () => api.reservationSummary(outlet), enabled: Boolean(outlet) && enabled, refetchInterval: 60_000 });
}

export function useReservationSlots(outlet, day, party, enabled = true) {
  return useQuery({ queryKey: ["reservation-slots", outlet?._id, day, party], queryFn: () => api.reservationAvailability(outlet, day, party), enabled: Boolean(outlet) && enabled });
}

export const useCreateStaffReservation = (o) => useOutletMutation(o, (out, body) => api.createStaffReservation(out, body), ["reservations", "reservation-summary", "reservation-slots"]);
export const useUpdateReservation = (o) => useOutletMutation(o, (out, a) => api.updateReservation(out, a.id, a.body), ["reservations", "reservation-summary", "reservation-slots"]);

export function useFeedback(outlet, filters, enabled = true) {
  return useQuery({ queryKey: ["feedback", outlet?._id, JSON.stringify(filters)], queryFn: () => api.listFeedback(outlet, filters), enabled: Boolean(outlet) && enabled });
}

export function useCartReminders(outlet, enabled = true) {
  return useQuery({ queryKey: ["cart-reminders", outlet?._id], queryFn: () => api.getCartReminders(outlet), enabled: Boolean(outlet) && enabled });
}
export const useSaveCartReminders = (o) => useOutletMutation(o, (out, body) => api.saveCartReminders(out, body), ["cart-reminders"]);
