/**
 * Zero-install local MongoDB for development.
 *
 *   pnpm db:local
 *
 * Downloads a standalone mongod binary on first run (no Homebrew, no Docker),
 * then serves it on 127.0.0.1:27017 with data persisted in apps/api/.local-db/.
 * Leave it running in its own terminal. Ctrl+C to stop.
 *
 * For real data, point apps/api/.env at MongoDB Atlas instead.
 */
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { MongoMemoryServer } from "mongodb-memory-server";

const PORT = 27017;
const DB_PATH = resolve(process.cwd(), ".local-db");

async function main()                {
  mkdirSync(DB_PATH, { recursive: true });

  const server = await MongoMemoryServer.create({
    instance: {
      port: PORT,
      dbPath: DB_PATH,
      storageEngine: "wiredTiger",
    },
  });

  const uri = server.getUri();
  process.stdout.write(
    `\n  Local MongoDB ready\n` +
      `  ${uri}\n` +
      `  data: ${DB_PATH}\n\n` +
      `  Leave this running. In another terminal: pnpm dev\n\n`,
  );

  const stop = async () => {
    await server.stop({ doCleanup: false });
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main().catch((err) => {
  console.error("Failed to start local MongoDB:", err);
  process.exit(1);
});
