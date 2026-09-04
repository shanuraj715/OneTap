import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
                                    

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
  const qc = useQueryClient();

  const socketRef = useRef                  (null);
  const attemptRef = useRef(0);
  const timerRef = useRef                                      (null);
  // Guards against a reconnect firing after the component has gone away.
  const stoppedRef = useRef(false);

  useEffect(() => {
    if (!outlet || !enabled) return;
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
        if (event.type.startsWith("order.")) {
          void qc.invalidateQueries({ queryKey: ["orders"] });
          void qc.invalidateQueries({ queryKey: ["order-print-status"] });
        }
        if (event.type === "print.updated") {
          void qc.invalidateQueries({ queryKey: ["order-print-status"] });
          void qc.invalidateQueries({ queryKey: ["print-jobs"] });
        }
      };

      socket.onclose = () => {
        socketRef.current = null;
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
  }, [outlet, enabled, qc]);

  return { status, lastCreatedId, lastEventAt };
}
