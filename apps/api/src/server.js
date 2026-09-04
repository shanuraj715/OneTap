import { connectDb } from "@onetap/db";
import { createApp } from "./app.js";
import { env } from "./env.js";
import { logger } from "./logger.js";
import { dispatchDue } from "./modules/printing/printing.service.js";
import { attachRealtime } from "./realtime/hub.js";

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

  const server = app.listen(env.API_PORT);

  // Live order + print updates for the admin, on the same session cookie.
  attachRealtime(server);

  server.on("listening", () => {
    logger.info(`OneTap API → http://localhost:${env.API_PORT}`);
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
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main();
