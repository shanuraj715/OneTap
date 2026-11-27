import { useState, type ReactNode } from "react";
import type { Order } from "@/api/schemas";
import { RiderSheet } from "./RiderSheet";
import { useStatusChange } from "./useStatusChange";

/**
 * What the buttons on an order do, for the list and for the order's own page:
 *  - `advance(order, to)`: the next step; "out for delivery" asks who is taking it first (the dashboard does the same), anything else asks "are you sure?";
 *  - `changeRider(order)`: pick or change the rider without moving the order;
 *  - `setByHand(order, to, reason)`: any status (the mis-tap correction).
 * `dialogs` holds the pop-ups; draw it once on the screen.
 */
export function useOrderActions(onChanged?: (order: Order) => void) {
  const status = useStatusChange(onChanged);
  const [rider, setRider] = useState<{ order: Order; sendOut: boolean } | null>(null);
  const dialogs: ReactNode = (
    <>
      {status.dialogs}
      <RiderSheet order={rider?.order ?? null} sendOut={rider?.sendOut ?? false} onClose={() => setRider(null)} />
    </>
  );
  return {
    advance: (order: Order, to: string) => (to === "out_for_delivery" ? setRider({ order, sendOut: true }) : status.ask(order, to)),
    changeRider: (order: Order) => setRider({ order, sendOut: false }),
    setByHand: status.applyManual,
    dialogs,
    busy: status.busy,
  };
}
