import { WebSocket, WebSocketServer } from "ws";
import { OutletModel } from "@rasoipulse/db";
import { logger } from "../logger.js";
import { HttpError } from "../middleware/error.js";
import { SESSION_COOKIE, requireOutletContext } from "../middleware/auth.js";
import { allowUpgrade, refuseUpgrade } from "../middleware/rate-limit.js";
import { onPlatformConfigChange, platformConfig } from "../modules/cache/platform-config.js";
import { userFromToken } from "../modules/auth/auth.service.js";
import { storePlan } from "../modules/platform/plan.service.js";
import { riderFromToken } from "../modules/riders/rider-session.js";
import { installAppFeed } from "./app-feed.js";

/* --------------------------------------------------------------- messages */

/**
 * Two kinds of listener share this one socket address (`/realtime`):
 *
 *  - the DASHBOARD (browser, session cookie): receives the full events below — `order.created`, `order.updated`, `order.deleted`,
 *    `print.updated`, `reservation.changed` … with the data inside;
 *  - the STAFF APPS (OMA, KDA, RDA — `?app=oma|kda|rda`, Authorization: Bearer): receive only small "something changed" messages and
 *    ask the API (which checks who they are, as always) for the new data:
 *        { type: "hello",   app, outletId, at }          — connected; the app loads everything once
 *        { type: "changed", what: ["orders", …], at }    — what to load again (orders · tables · menu · deliveries)
 *        { type: "tick",    at }                         — every 20 s, so an app can tell a silent dead connection from a quiet restaurant
 *    No order, name, phone or price ever travels over an app's socket.
 */

const clients = new Set();
let slimCount = 0;

/** Remove a client from the live set (wherever it was dropped from). */
function drop(client) {
  if (clients.delete(client) && client.slim) slimCount -= 1;
}

/* ------------------------------------------------------------------ config */

const HEARTBEAT_MS = 30_000;
const TICK_MS = 20_000;
const RECHECK_MS = 5 * 60_000;
const COALESCE_MS = 250;

/**
 * The apps that may listen, what each needs permission for, and which kinds of change it cares about. (The rider app has no staff
 * permission: its own signed token says who the rider is, and `deliveries` only ever tells it to look at ITS list again.)
 */
export const LIVE_APPS = {
  oma: { needs: "order:read", wants: ["orders", "tables", "menu"] },
  kda: { needs: "kitchen:app", wants: ["orders", "menu"] },
  rda: { needs: null, wants: ["deliveries"] },
};

/** Cookies arrive as one header on the upgrade request; Express isn't involved. */
function readCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

/** The staff apps have no cookie jar: their sign-in travels as `Authorization: Bearer <token>`. */
const bearerOf = (req) => /^Bearer\s+(\S+)$/i.exec(String(req.headers.authorization ?? ""))?.[1];

const REASONS = { 400: "Bad Request", 401: "Unauthorized", 403: "Forbidden", 404: "Not Found", 503: "Service Unavailable" };

/** A refused sign-in or permission becomes a status; anything else (the database is down…) is a real error. */
function refusal(err) {
  if (err instanceof HttpError) return { refused: err.status === 404 ? 404 : err.status === 401 ? 401 : 403 };
  throw err;
}

/**
 * Who is connecting, and may they watch this outlet?
 *
 * The socket carries the same session cookie as every other request, so a
 * WebSocket grants exactly what the user already had — no separate token, and
 * no way to subscribe to a brand you aren't a member of.
 *
 * A staff app (`?app=oma|kda|rda`) has no cookie: it sends its Bearer token, and gets the SAME checks its REST calls get — role,
 * the outlets the person is mapped to, a paused membership, a switched-off store (`requireOutletContext`), or, for a rider, the
 * rider's own token (`riderFromToken`).
 */
async function authorize(req) {
  const url = new URL(req.url ?? "/", "http://localhost");
  const app = url.searchParams.get("app");
  if (app) return authorizeApp(req, app, url);

  const token = readCookie(req, SESSION_COOKIE);
  const user = await userFromToken(token);
  if (!user) return null;

  const outletId = url.searchParams.get("outletId");
  if (!outletId) return null;

  const outlet = await OutletModel.findOne({ _id: outletId }, null, { allowGlobalQuery: true }).lean();
  if (!outlet) return null;

  const allowed = user.isSuperAdmin || user.memberships.some((m) => m.brandId === outlet.brandId);
  if (!allowed) return null;

  // A store the platform has switched off gets no live feed either (the platform's own super admin still does).
  if (!user.isSuperAdmin && (await storePlan(outlet.brandId)).disabled) return null;

  return { user, brandId: outlet.brandId, outletId: String(outlet._id) };
}

async function authorizeApp(req, app, url) {
  const def = LIVE_APPS[app];
  if (!def) return { refused: 400 };
  const token = bearerOf(req);
  try {
    if (app === "rda") {
      const { rider, ctx } = await riderFromToken(token);
      return { app, slim: true, riderId: String(rider._id), userId: `rider:${rider._id}`, isSuperAdmin: false, brandId: ctx.brandId, outletId: String(ctx.outletId) };
    }
    const user = await userFromToken(token);
    if (!user) return { refused: 401 };
    const outletId = url.searchParams.get("outletId") || "";
    if (!outletId) return { refused: 400 };
    // the same gate every REST call of the app goes through, with a stand-in for the Express request
    const ctx = await requireOutletContext({ user, query: {}, header: (name) => (String(name).toLowerCase() === "x-rasoipulse-outlet" ? outletId : undefined) }, def.needs);
    return { app, slim: true, user, userId: String(user._id), isSuperAdmin: Boolean(user.isSuperAdmin), brandId: ctx.brandId, outletId };
  } catch (err) {
    return refusal(err);
  }
}

/* -------------------------------------------------------------------- hub */

export function attachRealtime(server) {
  // noServer so we can reject an unauthorised upgrade before the handshake
  // completes, rather than accepting a socket and closing it afterwards.
  // nothing useful is ever SENT to this hub by a client — the pings are tiny — so no big message is ever accepted
  const wss = new WebSocketServer({ noServer: true, maxPayload: 4 * 1024 });

  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname !== "/realtime") return; // leave other upgrades alone

    const gate = allowUpgrade(req);
    if (!gate.ok) return refuseUpgrade(socket, gate.retryAfterSec);

    // the platform can switch live connections off for everyone; dashboards and apps then ask the API on a timer instead
    void platformConfig()
      .then((cfg) => {
        if (cfg.realtimeWebsocket === false) return "off";
        return authorize(req);
      })
      .then((auth) => {
        const refuse = (status) => {
          socket.write(`HTTP/1.1 ${status} ${REASONS[status] ?? "Refused"}\r\nConnection: close\r\n\r\n`);
          socket.destroy();
        };
        if (auth === "off") return refuse(503);
        if (!auth) return refuse(401);
        if (auth.refused) return refuse(auth.refused);
        wss.handleUpgrade(req, socket, head, (ws) => {
          const client = {
            socket: ws,
            userId: String(auth.userId ?? auth.user?._id),
            isSuperAdmin: Boolean(auth.isSuperAdmin ?? auth.user?.isSuperAdmin),
            brandId: auth.brandId,
            outletId: auth.outletId,
            isAlive: true,
            app: auth.app ?? null,
            slim: Boolean(auth.slim),
            riderId: auth.riderId ?? null,
            // what is needed to ask again later "is this person still allowed?" (never the cookie of a dashboard: only apps are re-checked)
            again: auth.slim ? { url: req.url, headers: { authorization: req.headers.authorization } } : null,
          };
          clients.add(client);
          if (client.slim) slimCount += 1;

          ws.on("pong", () => {
            client.isAlive = true;
          });
          ws.on("close", () => drop(client));
          ws.on("error", () => drop(client));

          send(client, { type: "hello", app: client.app, outletId: auth.outletId, at: new Date().toISOString() });
          logger.debug({ outletId: auth.outletId, app: client.app, clients: clients.size }, "realtime client connected");
        });
      })
      .catch((err) => {
        logger.warn({ err }, "realtime upgrade failed");
        socket.destroy();
      });
  });

  // When the platform switches live updates off, everyone connected is let go at once (code 4410 tells the dashboard or app why,
  // so it starts asking on a timer straight away); switching it back on needs nothing — dashboards and apps reconnect by themselves.
  onPlatformConfigChange((previous, next) => {
    if (previous.realtimeWebsocket !== false && next.realtimeWebsocket === false) {
      for (const client of [...clients]) {
        try {
          client.socket.close(4410, "live updates switched off");
        } catch {
          /* already gone */
        }
      }
    }
  });

  // A browser tab that goes to sleep or a laptop that closes leaves a socket
  // that looks open but answers nothing. Ping, and drop what doesn't reply.
  const heartbeat = setInterval(() => {
    for (const client of clients) {
      if (!client.isAlive) {
        client.socket.terminate();
        drop(client);
        continue;
      }
      client.isAlive = false;
      try {
        client.socket.ping();
      } catch {
        drop(client);
      }
    }
  }, HEARTBEAT_MS);
  heartbeat.unref();

  // An app can't see a ping, so it gets a tiny message of its own: if none arrives for a minute, the app knows the line is dead.
  const ticker = setInterval(() => {
    if (!slimCount) return;
    const at = new Date().toISOString();
    for (const client of clients) if (client.slim) send(client, { type: "tick", at });
  }, TICK_MS);
  ticker.unref();

  // Signed out on the phone, a person switched off, a store paused, a rider's PIN reset: an app's connection ends at the next check
  // (and straight away for a rider whose record changes, see app-feed.js) — not whenever the app next happens to reconnect.
  const recheck = setInterval(() => void recheckClients(() => true), RECHECK_MS);
  recheck.unref();

  installAppFeed();
  logger.info("Realtime hub listening on /realtime");
}

function send(client, event) {
  if (client.socket.readyState !== WebSocket.OPEN) return;
  try {
    client.socket.send(JSON.stringify(event));
  } catch {
    drop(client);
  }
}

/**
 * Push an event to everyone watching one outlet — the DASHBOARD, with the data. (An app never gets these: see `notifyApps`.)
 *
 * Never throws: a realtime push is a nicety on top of the REST data, and a
 * broken socket must not fail the request that produced the event.
 */
export function broadcast(outletId, event) {
  for (const client of clients) {
    if (client.outletId === outletId && !client.slim) send(client, event);
  }
}

/* ------------------------------------------------------------- the apps' feed */

const waiting = new Map(); // "outlet|brand" → { scope, kinds, timer }

/**
 * Tell the staff apps something changed — `kind` is orders | tables | menu | deliveries. `scope` says whose: an outlet, a whole store
 * (`{ brandId }`), or everybody (`{}`) when a write couldn't say. Changes that follow each other within a moment are sent as ONE message.
 */
export function notifyApps(scope, kind) {
  if (!slimCount) return;
  const key = `${scope.outletId ?? ""}|${scope.brandId ?? ""}`;
  let entry = waiting.get(key);
  if (!entry) {
    entry = { scope, kinds: new Set(), timer: null };
    entry.timer = setTimeout(() => {
      waiting.delete(key);
      flush(entry);
    }, COALESCE_MS);
    entry.timer.unref?.();
    waiting.set(key, entry);
  }
  entry.kinds.add(kind);
}

function flush({ scope, kinds }) {
  const at = new Date().toISOString();
  for (const client of clients) {
    if (!client.slim) continue;
    if (scope.outletId ? client.outletId !== scope.outletId : scope.brandId && client.brandId !== scope.brandId) continue;
    const wanted = LIVE_APPS[client.app]?.wants ?? [];
    const what = [...kinds].filter((k) => wanted.includes(k));
    if (what.length) send(client, { type: "changed", what, at });
  }
}

/** The outlets that have an app listening for `kind` → Map(outletId → brandId). */
export function outletsListeningFor(kind) {
  const found = new Map();
  for (const client of clients) if (client.slim && (LIVE_APPS[client.app]?.wants ?? []).includes(kind)) found.set(client.outletId, client.brandId);
  return found;
}

/**
 * Ask again, for the apps matching `match`, whether the person may still listen (signed in, active, not paused, store on, rider's PIN
 * unchanged) and let go of the ones who may not. A database hiccup is not a reason to disconnect anybody.
 */
export async function recheckClients(match) {
  for (const client of [...clients]) {
    if (!client.slim || !client.again || !match(client)) continue;
    try {
      const req = { url: client.again.url, headers: client.again.headers };
      const result = await authorize(req);
      if (!result || result.refused) {
        try {
          client.socket.close(4401, "signed out");
        } catch {
          client.socket.terminate();
        }
        drop(client);
      }
    } catch {
      /* try again next time */
    }
  }
}

/**
 * Cut off the live connections of a store's team — used when the platform switches the store off, so they stop
 * receiving its orders at once instead of whenever they next reconnect (and a reconnect is refused, see
 * `authorize`). The platform's own super admin, watching the store from the console, keeps theirs.
 */
export function dropStoreTeam(brandId) {
  let dropped = 0;
  for (const client of [...clients]) {
    if (client.brandId !== brandId || client.isSuperAdmin) continue;
    drop(client);
    try {
      client.socket.close(4403, "store disabled");
    } catch {
      client.socket.terminate();
    }
    dropped++;
  }
  return dropped;
}

export function connectionCount(outletId) {
  if (!outletId) return clients.size;
  let n = 0;
  for (const c of clients) if (c.outletId === outletId) n++;
  return n;
}

/** How many staff apps are connected (all of them, or one app's). */
export function appConnectionCount(app) {
  let n = 0;
  for (const c of clients) if (c.slim && (!app || c.app === app)) n++;
  return n;
}
