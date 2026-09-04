"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { menuLayoutSchema } from "@onetap/config-schema";
import { MenuSections } from "@onetap/ui";

const BACKOFF = [1_000, 2_000, 5_000, 10_000, 20_000];

/**
 * @param {Object} props
 * @param {string} props.sessionId
 * @param {string} props.apiBase
 * @param {string} props.outletName
 * @param {import("@onetap/config-schema").Menu} props.menu
 * @param {string} props.fallbackCardVariant
 * @param {import("@onetap/config-schema").MenuLayout} props.initialLayout
 */
export function LivePreview({ sessionId, apiBase, outletName, menu, fallbackCardVariant, initialLayout }) {
  const [layout, setLayout] = useState(initialLayout);
  const [status, setStatus] = useState("connecting");
  const [updatedAt, setUpdatedAt] = useState(null);

  const attemptRef = useRef(0);
  const stoppedRef = useRef(false);

  useEffect(() => {
    stoppedRef.current = false;
    const wsUrl = `${apiBase.replace(/^http/, "ws")}/preview?id=${encodeURIComponent(sessionId)}&role=viewer`;
    let socket = null;
    let timer = null;

    const apply = (raw) => {
      try {
        setLayout(menuLayoutSchema.parse(raw ?? {}));
        setUpdatedAt(new Date());
      } catch {
        /* keep the last good layout */
      }
    };

    const connect = () => {
      if (stoppedRef.current) return;
      setStatus(attemptRef.current === 0 ? "connecting" : "reconnecting");
      try {
        socket = new WebSocket(wsUrl);
      } catch {
        schedule();
        return;
      }

      socket.onopen = () => {
        attemptRef.current = 0;
        setStatus("live");
      };
      socket.onmessage = (e) => {
        let msg;
        try {
          msg = JSON.parse(String(e.data));
        } catch {
          return;
        }
        if (msg.type === "preview.init" || msg.type === "preview.layout") apply(msg.layout);
      };
      socket.onclose = (e) => {
        socket = null;
        if (stoppedRef.current) return;
        if (e.code === 4000) {
          setStatus("expired");
          return;
        }
        schedule();
      };
      socket.onerror = () => socket?.close();
    };

    const schedule = () => {
      setStatus("reconnecting");
      const delay = BACKOFF[Math.min(attemptRef.current, BACKOFF.length - 1)] ?? 20_000;
      attemptRef.current += 1;
      timer = setTimeout(connect, delay);
    };

    connect();
    return () => {
      stoppedRef.current = true;
      if (timer) clearTimeout(timer);
      socket?.close();
    };
  }, [sessionId, apiBase]);

  const resolvedLayout = useMemo(() => {
    const l =
      layout.mode === "auto" && layout.sections.length === 0
        ? { ...layout, defaultCardVariant: layout.defaultCardVariant || fallbackCardVariant }
        : layout;
    try {
      return menuLayoutSchema.parse(l);
    } catch {
      return menuLayoutSchema.parse({});
    }
  }, [layout, fallbackCardVariant]);

  return (
    <main style={{ minHeight: "100vh", background: "var(--color-bg)", color: "var(--color-text)" }}>
      <div style={bar}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span style={{ ...dot, background: DOT[status] ?? "var(--color-text-muted)" }} />
          <strong style={{ fontSize: 13 }}>Live preview</strong>
          <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{LABEL[status] ?? status}</span>
        </span>
        <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
          {outletName}
          {updatedAt ? ` · updated ${updatedAt.toLocaleTimeString()}` : ""}
        </span>
      </div>

      <div style={{ paddingTop: 16 }}>
        {menu.items.length > 0 ? (
          <MenuSections menu={menu} layout={resolvedLayout} />
        ) : (
          <p style={{ textAlign: "center", color: "var(--color-text-muted)", marginTop: 40 }}>
            This outlet has no menu items yet.
          </p>
        )}
      </div>
    </main>
  );
}

const DOT = { live: "#2E7D46", connecting: "#8F6410", reconnecting: "#8F6410", expired: "#A5382F" };
const LABEL = {
  live: "connected — edits appear instantly",
  connecting: "connecting…",
  reconnecting: "reconnecting…",
  expired: "session ended — reopen from the editor",
};

const bar = {
  position: "sticky",
  top: 0,
  zIndex: 10,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
  padding: "10px 24px",
  borderBottom: "1px solid var(--color-border)",
  background: "var(--color-surface)",
};
const dot = { width: 9, height: 9, borderRadius: 999, flexShrink: 0 };
