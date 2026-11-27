import { connectDb } from "@rasoipulse/db";
import { createApp } from "./app.js";
import { env } from "./env.js";
import { logger } from "./logger.js";
import { startCacheSweeper } from "./modules/cache/cache.js";
import { startServerMonitor } from "./modules/sysmon/monitor.js";
import { dispatchDue } from "./modules/printing/printing.service.js";
import { attachRealtime } from "./realtime/hub.js";
import { attachPreview } from "./realtime/preview.js";
import { startMarketingWorker } from "./modules/marketing/worker.js";
import { startWhatsAppWorker } from "./modules/whatsapp/worker.js";
import { configured as pushConfigured, projectId as pushProject } from "./modules/notify/push.js";
import { startCartReminderWorker } from "./modules/carts/carts.service.js";
import { startStockSweeper } from "./modules/menu/stock.service.js";
import { startBookingSweeper } from "./modules/reservations/reservations.service.js";
import { startMissedOrderSweeper } from "./modules/orders/orders.service.js";
import { markInterruptedMoves } from "./modules/storage/storage-migrate.js";
import { markInterruptedOptimizations } from "./modules/storage/storage-optimize.js";

const DISPATCH_INTERVAL_MS = 5_000;
let printTimer                        = null;

/**
 * Pushes cloud print jobs and frees jobs a browser or agent claimed and then
 * abandoned. Pull targets aren't polled here — their clients come to us.
 */
function startPrintDispatcher()       {
  let running = false;
  printTimer = setInterval(() => {
    if (running) return; // never overlap a slow batch with the next tick
    running = true;
    dispatchDue()
      .catch((err       ) => logger.error({ err }, "print dispatcher tick failed"))
      .finally(() => {
        running = false;
      });
  }, DISPATCH_INTERVAL_MS);
  printTimer.unref();
  logger.info("Print dispatcher started");
}

function main()       {
  const app = createApp();
  startCacheSweeper();
  startServerMonitor();
  // only where WHATSAPP_WORKER=on — see env.js
  startWhatsAppWorker();
  // only where MARKETING_WORKER=on — see env.js
  startMarketingWorker();
  // abandoned-cart reminders — only where one of the two senders above runs
  startCartReminderWorker();
  // gives back the counted stock of online orders nobody paid for (safe in every process)
  startStockSweeper();
  // lets go of table bookings whose advance was never paid (safe in every process)
  startBookingSweeper();
  startMissedOrderSweeper();
  void markInterruptedMoves().catch(() => undefined); // a move that was running when the last process stopped can't still be running
  void markInterruptedOptimizations().catch(() => undefined); // …and neither can an optimize run

  const server = app.listen(env.API_PORT);

  // Live order + print updates for the admin, on the same session cookie.
  attachRealtime(server);
  // Live menu-layout preview sessions (/preview) for the storefront preview page.
  attachPreview(server);

  server.on("listening", () => {
    logger.info(`Rasoi Pulse API → http://localhost:${env.API_PORT}`);
    logger.info(pushConfigured() ? `Push notifications ON (Firebase project ${pushProject()})` : "Push notifications OFF (no FCM_SERVICE_ACCOUNT_FILE / FCM_SERVICE_ACCOUNT_JSON): riders hear about a delivery with the app open, and on WhatsApp");
  });

  server.on("error", (err                       ) => {
    if (err.code === "EADDRINUSE") {
      logger.error(`Port ${env.API_PORT} is already in use. Stop the other process or change API_PORT.`);
    } else {
      logger.error({ err }, "Server error");
    }
    process.exit(1);
  });

  // Connect in the background — the API stays up even if Mongo is unreachable,
  // so the scaffold runs before you've set up a database. /health reports the state.
  connectDb({ uri: env.MONGODB_URI, dbName: env.MONGODB_DB })
    .then(() => {
      logger.info("MongoDB connected");
      startPrintDispatcher();
    })
    .catch((err       ) =>
      logger.warn(`MongoDB not connected (${err.message}). API running without a database.`),
    );

  const shutdown = (signal        ) => {
    logger.info(`${signal} received — shutting down`);
    if (printTimer) clearInterval(printTimer);
    server.close(() => process.exit(0));
    // Long-lived WebSocket clients (admin order feed, live preview) would keep
    // server.close() pending forever — drop them so the port frees immediately.
    // This is what lets `node --watch` restart cleanly on every save.
    server.closeAllConnections?.();
    setTimeout(() => process.exit(1), env.NODE_ENV === "production" ? 10_000 : 1_500).unref();
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main();
