import { useEffect, useRef, useState } from "react";
import { createPreviewSession } from "./api";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3072";
const STOREFRONT_URL = import.meta.env.VITE_STOREFRONT_URL ?? "http://localhost:3070";

/**
 * Opens a live menu-layout preview session and streams the editor's working
 * layout to it over a WebSocket, so the preview page re-renders as you type.
 *
 * One session per outlet per editor visit. Reloading the editor starts a fresh
 * session (and a fresh link) — the old one is dropped by the server on idle.
 *
 * @param {{ _id: string } | undefined} outlet
 * @param {unknown} layout        the editor's current (unsaved) working layout
 * @param {boolean} active        false pauses the session (e.g. before an outlet exists)
 * @returns {{ sessionId: string | null, previewUrl: string | null, status: string }}
 */
export function usePreviewSession(outlet, layout, active = true) {
  const [sessionId, setSessionId] = useState(null);
  const [status, setStatus] = useState("idle");

  const socketRef = useRef(null);
  const sendTimerRef = useRef(null);
  const layoutRef = useRef(layout);
  const outletRef = useRef(outlet);
  layoutRef.current = layout;
  outletRef.current = outlet;

  const outletId = outlet?._id;

  // Create the session + connect the editor socket, once per outlet.
  useEffect(() => {
    if (!outletId || !active) return;
    let cancelled = false;
    let socket = null;

    setStatus("creating");
    setSessionId(null);

    createPreviewSession(outletRef.current, layoutRef.current)
      .then(({ id }) => {
        if (cancelled) return;
        setSessionId(id);
        setStatus("connecting");
        const url = `${API_BASE.replace(/^http/, "ws")}/preview?id=${encodeURIComponent(id)}&role=editor`;
        try {
          socket = new WebSocket(url);
        } catch {
          setStatus("offline");
          return;
        }
        socketRef.current = socket;
        socket.onopen = () => {
          if (!cancelled) setStatus("live");
        };
        socket.onclose = () => {
          if (!cancelled && socketRef.current === socket) {
            socketRef.current = null;
            setStatus("offline");
          }
        };
        socket.onerror = () => socket?.close();
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
      if (sendTimerRef.current) clearTimeout(sendTimerRef.current);
      socket?.close();
      socketRef.current = null;
    };
  }, [outletId, active]);

  // Push the working layout on every change, debounced.
  useEffect(() => {
    if (status !== "live" || !socketRef.current) return;
    if (sendTimerRef.current) clearTimeout(sendTimerRef.current);
    sendTimerRef.current = setTimeout(() => {
      try {
        socketRef.current?.send(JSON.stringify({ type: "layout", layout: layoutRef.current }));
      } catch {
        /* dropped — the next edit tries again */
      }
    }, 250);
    return () => {
      if (sendTimerRef.current) clearTimeout(sendTimerRef.current);
    };
  }, [layout, status]);

  return {
    sessionId,
    previewUrl: sessionId ? `${STOREFRONT_URL}/preview/${sessionId}` : null,
    status,
  };
}
