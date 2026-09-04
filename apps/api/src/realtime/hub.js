                                                         
import { WebSocket, WebSocketServer } from "ws";
import { OutletModel,              } from "@onetap/db";
import { logger } from "../logger.js";
import { SESSION_COOKIE } from "../middleware/auth.js";
import { userFromToken } from "../modules/auth/auth.service.js";

/* --------------------------------------------------------------- messages */

/** Everything the server pushes. The client switches on `type`. */
                         
                                                   
                                             
                                             
                                              
                                           
                                 

                  
                    
                 
                  
                   
                   
 

const clients = new Set        ();

/* ------------------------------------------------------------------ config */

const HEARTBEAT_MS = 30_000;

/** Cookies arrive as one header on the upgrade request; Express isn't involved. */
function readCookie(req                 , name        )                     {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

/**
 * Who is connecting, and may they watch this outlet?
 *
 * The socket carries the same session cookie as every other request, so a
 * WebSocket grants exactly what the user already had — no separate token, and
 * no way to subscribe to a brand you aren't a member of.
 */
async function authorize(
  req                 ,
)                                                                       {
  const token = readCookie(req, SESSION_COOKIE);
  const user = await userFromToken(token);
  if (!user) return null;

  const url = new URL(req.url ?? "/", "http://localhost");
  const outletId = url.searchParams.get("outletId");
  if (!outletId) return null;

  const outlet = await OutletModel.findOne({ _id: outletId }, null, { allowGlobalQuery: true }).lean();
  if (!outlet) return null;

  const allowed =
    user.isSuperAdmin || user.memberships.some((m) => m.brandId === outlet.brandId);
  if (!allowed) return null;

  return { user, brandId: outlet.brandId, outletId: String(outlet._id) };
}

/* -------------------------------------------------------------------- hub */

export function attachRealtime(server        )       {
  // noServer so we can reject an unauthorised upgrade before the handshake
  // completes, rather than accepting a socket and closing it afterwards.
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname !== "/realtime") return; // leave other upgrades alone

    void authorize(req)
      .then((auth) => {
        if (!auth) {
          socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
          socket.destroy();
          return;
        }
        wss.handleUpgrade(req, socket, head, (ws) => {
          const client         = {
            socket: ws,
            userId: String(auth.user._id),
            brandId: auth.brandId,
            outletId: auth.outletId,
            isAlive: true,
          };
          clients.add(client);

          ws.on("pong", () => {
            client.isAlive = true;
          });
          ws.on("close", () => clients.delete(client));
          ws.on("error", () => clients.delete(client));

          send(client, { type: "hello", outletId: auth.outletId, at: new Date().toISOString() });
          logger.debug({ outletId: auth.outletId, clients: clients.size }, "realtime client connected");
        });
      })
      .catch((err       ) => {
        logger.warn({ err }, "realtime upgrade failed");
        socket.destroy();
      });
  });

  // A browser tab that goes to sleep or a laptop that closes leaves a socket
  // that looks open but answers nothing. Ping, and drop what doesn't reply.
  const heartbeat = setInterval(() => {
    for (const client of clients) {
      if (!client.isAlive) {
        client.socket.terminate();
        clients.delete(client);
        continue;
      }
      client.isAlive = false;
      try {
        client.socket.ping();
      } catch {
        clients.delete(client);
      }
    }
  }, HEARTBEAT_MS);
  heartbeat.unref();

  logger.info("Realtime hub listening on /realtime");
}

function send(client        , event             )       {
  if (client.socket.readyState !== WebSocket.OPEN) return;
  try {
    client.socket.send(JSON.stringify(event));
  } catch {
    clients.delete(client);
  }
}

/**
 * Push an event to everyone watching one outlet.
 *
 * Never throws: a realtime push is a nicety on top of the REST data, and a
 * broken socket must not fail the request that produced the event.
 */
export function broadcast(outletId        , event             )       {
  for (const client of clients) {
    if (client.outletId === outletId) send(client, event);
  }
}

export function connectionCount(outletId         )         {
  if (!outletId) return clients.size;
  let n = 0;
  for (const c of clients) if (c.outletId === outletId) n++;
  return n;
}
