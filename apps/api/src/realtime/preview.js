import { WebSocket, WebSocketServer } from "ws";
import { menuLayoutSchema } from "@onetap/config-schema";
import { logger } from "../logger.js";
import { SESSION_COOKIE } from "../middleware/auth.js";
import { userFromToken } from "../modules/auth/auth.service.js";

/**
 * Live menu-layout preview sessions.
 *
 * The admin's Menu Layout editor opens a session, gets a shareable URL, and
 * streams its unsaved working layout over a WebSocket. A preview page (on the
 * public storefront, so it looks exactly like the real thing) joins the same
 * session and re-renders on every keystroke.
 *
 * Everything here is in memory and deliberately short-lived — a session only
 * ever carries a menu layout, which is public storefront config anyway, and
 * the id is an unguessable token. Editors must still prove they may touch the
 * outlet (same session cookie as every other admin request); viewers don't
 * need an account, the same as the storefront itself.
 */

const SESSION_TTL_MS = 3 * 60 * 60 * 1000; // dropped this long after the last edit
const HEARTBEAT_MS = 30_000;

/**
 * @typedef {Object} PreviewSession
 * @property {string} id
 * @property {string} outletId
 * @property {string} brandId
 * @property {import("@onetap/config-schema").MenuLayout} layout last known working layout
 * @property {number} updatedAt
 * @property {Set<import("ws").WebSocket>} viewers
 * @property {Set<import("ws").WebSocket>} editors
 * @property {NodeJS.Timeout | null} timer
 */

/** @type {Map<string, PreviewSession>} */
const sessions = new Map();

function safeLayout(layout) {
  try {
    return menuLayoutSchema.parse(layout ?? {});
  } catch {
    return menuLayoutSchema.parse({});
  }
}

function touch(session) {
  session.updatedAt = Date.now();
  if (session.timer) clearTimeout(session.timer);
  session.timer = setTimeout(() => destroySession(session), SESSION_TTL_MS);
  session.timer.unref?.();
}

function destroySession(session) {
  if (session.timer) clearTimeout(session.timer);
  sessions.delete(session.id);
  for (const set of [session.viewers, session.editors]) {
    for (const ws of set) {
      try {
        ws.close(4000, "preview session expired");
      } catch {
        /* already gone */
      }
    }
    set.clear();
  }
  logger.debug({ id: session.id }, "preview session ended");
}

/** Create a fresh session for an outlet the caller has already been authorised for. */
export function createPreviewSession({ outletId, brandId, layout }) {
  const session = {
    id: crypto.randomUUID(),
    outletId,
    brandId,
    layout: safeLayout(layout),
    updatedAt: Date.now(),
    viewers: new Set(),
    editors: new Set(),
    timer: null,
  };
  sessions.set(session.id, session);
  touch(session);
  logger.debug({ id: session.id, outletId }, "preview session created");
  return session;
}

export function getPreviewSession(id) {
  return sessions.get(id) ?? null;
}

function send(ws, event) {
  if (ws.readyState !== WebSocket.OPEN) return;
  try {
    ws.send(JSON.stringify(event));
  } catch {
    /* the close handler will clean it up */
  }
}

function broadcastLayout(session) {
  for (const ws of session.viewers) {
    send(ws, { type: "preview.layout", layout: session.layout, at: new Date().toISOString() });
  }
}

/* ----------------------------------------------------------------- cookies */

function readCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

/** An editor connection must belong to the session's brand. */
async function authorizeEditor(req, session) {
  const user = await userFromToken(readCookie(req, SESSION_COOKIE));
  if (!user) return false;
  if (user.isSuperAdmin) return true;
  return user.memberships.some((m) => m.brandId === session.brandId);
}

/* -------------------------------------------------------------------- hub */

/**
 * Wire the /preview WebSocket onto the shared HTTP server. Runs alongside the
 * order realtime hub — each upgrade listener guards its own path.
 */
export function attachPreview(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname !== "/preview") return; // not ours

    const id = url.searchParams.get("id") ?? "";
    const role = url.searchParams.get("role") === "editor" ? "editor" : "viewer";
    const session = getPreviewSession(id);

    if (!session) {
      socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
      socket.destroy();
      return;
    }

    const finish = (ok) => {
      if (!ok) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }
      wss.handleUpgrade(req, socket, head, (ws) => {
        const set = role === "editor" ? session.editors : session.viewers;
        set.add(ws);
        // @ts-ignore — mark for the heartbeat sweep
        ws.isAlive = true;
        ws.on("pong", () => {
          ws.isAlive = true;
        });
        ws.on("close", () => set.delete(ws));
        ws.on("error", () => set.delete(ws));

        if (role === "editor") {
          ws.on("message", (raw) => {
            let msg;
            try {
              msg = JSON.parse(String(raw));
            } catch {
              return;
            }
            if (msg && msg.type === "layout") {
              session.layout = safeLayout(msg.layout);
              touch(session);
              broadcastLayout(session);
            }
          });
          send(ws, { type: "preview.ready", outletId: session.outletId });
        } else {
          send(ws, {
            type: "preview.init",
            outletId: session.outletId,
            layout: session.layout,
            at: new Date().toISOString(),
          });
        }
      });
    };

    if (role === "editor") {
      void authorizeEditor(req, session).then(finish).catch(() => finish(false));
    } else {
      finish(true);
    }
  });

  const heartbeat = setInterval(() => {
    for (const session of sessions.values()) {
      for (const set of [session.viewers, session.editors]) {
        for (const ws of set) {
          // @ts-ignore
          if (ws.isAlive === false) {
            ws.terminate();
            set.delete(ws);
            continue;
          }
          // @ts-ignore
          ws.isAlive = false;
          try {
            ws.ping();
          } catch {
            set.delete(ws);
          }
        }
      }
    }
  }, HEARTBEAT_MS);
  heartbeat.unref();

  logger.info("Preview hub listening on /preview");
}
