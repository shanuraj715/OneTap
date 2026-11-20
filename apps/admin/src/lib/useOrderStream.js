import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
                                    

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3072";

                                                             

                       
                                                                                                 
                         
                   
                
 

/** Backoff between reconnect attempts, in ms. */
const BACKOFF = [1_000, 2_000, 5_000, 10_000, 20_000];

                              
                       
                                                                     
                               
                           
 

/**
 * Live order feed.
 *
 * A kitchen screen that only refreshes every ten seconds is a kitchen screen
 * that misses orders. This opens a WebSocket on the same session cookie and
 * invalidates the orders query the moment something changes, so the table
 * reflects reality rather than a poll interval.
 *
 * It degrades honestly: if the socket can't connect the caller falls back to
 * polling, and the header says "Reconnecting" rather than pretending to be live.
 */
export function useOrderStream(outlet                    , enabled         )              {
  const [status, setStatus] = useState              ("connecting");
  const [lastCreatedId, setLastCreatedId] = useState               (null);
  const [lastEventAt, setLastEventAt] = useState             (null);
  // the kitchen marked a dish or an order ready (only sent when the store switched the waiter's bell on)
  const [lastReady, setLastReady] = useState(null);
  const qc = useQueryClient();
  // The platform can switch live connections off: then no socket is opened at all and the lists refresh on a timer.
  const { user } = useAuth();
  const socketsOn = user?.realtime?.websocket !== false;

  const socketRef = useRef                  (null);
  const attemptRef = useRef(0);
  const timerRef = useRef                                      (null);
  // Guards against a reconnect firing after the component has gone away.
  const stoppedRef = useRef(false);

  useEffect(() => {
    if (!outlet || !enabled) return;
    if (!socketsOn) {
      setStatus("polling");
      return;
    }
    stoppedRef.current = false;

    const url = `${API_BASE.replace(/^http/, "ws")}/realtime?outletId=${encodeURIComponent(outlet._id)}`;

    const connect = () => {
      if (stoppedRef.current) return;
      setStatus(attemptRef.current === 0 ? "connecting" : "offline");

      let socket           ;
      try {
        socket = new WebSocket(url);
      } catch {
        scheduleReconnect();
        return;
      }
      socketRef.current = socket;

      socket.onopen = () => {
        attemptRef.current = 0;
        setStatus("live");
      };

      socket.onmessage = (e) => {
        let event             ;
        try {
          event = JSON.parse(String(e.data))               ;
        } catch {
          return;
        }
        if (event.type === "ping" || event.type === "hello") return;

        setLastEventAt(new Date());
        if (event.type === "order.created" && event.order?.id) setLastCreatedId(event.order.id);

        // Refetch rather than patching the cache by hand: the list is small, and
        // a refetch can't drift out of sync with the server's own filtering.
        if (event.type === "kds.ready") setLastReady({ ...event, seq: Date.now() });
        if (event.type.startsWith("order.")) {
          void qc.invalidateQueries({ queryKey: ["kitchen"] });
          void qc.invalidateQueries({ queryKey: ["orders"] });
          void qc.invalidateQueries({ queryKey: ["order-print-status"] });
        }
        // a table booking was made or changed (by a guest or another screen)
        if (event.type === "reservation.changed") {
          void qc.invalidateQueries({ queryKey: ["reservations"] });
          void qc.invalidateQueries({ queryKey: ["reservation-summary"] });
          void qc.invalidateQueries({ queryKey: ["reservation-slots"] });
        }
        if (event.type === "print.updated") {
          void qc.invalidateQueries({ queryKey: ["order-print-status"] });
          void qc.invalidateQueries({ queryKey: ["print-jobs"] });
        }
      };

      socket.onclose = (e) => {
        socketRef.current = null;
        // TablePe just switched this store off (the server closes with 4403): re-read who we are, so the app
        // shows the "store is disabled" notice straight away instead of at the next click or refresh.
        if (e.code === 4403) void qc.invalidateQueries({ queryKey: ["me"] });
        // the platform just switched live updates off (4410): re-read the switch, then ask on a timer instead of reconnecting
        if (e.code === 4410) {
          stoppedRef.current = true;
          setStatus("polling");
          void qc.invalidateQueries({ queryKey: ["me"] });
          return;
        }
        if (!stoppedRef.current) scheduleReconnect();
      };
      socket.onerror = () => socket.close();
    };

    const scheduleReconnect = () => {
      setStatus("offline");
      const delay = BACKOFF[Math.min(attemptRef.current, BACKOFF.length - 1)] ?? 20_000;
      attemptRef.current += 1;
      timerRef.current = setTimeout(connect, delay);
    };

    connect();

    return () => {
      stoppedRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [outlet, enabled, qc, socketsOn]);

  return { status, lastCreatedId, lastEventAt, lastReady };
}
