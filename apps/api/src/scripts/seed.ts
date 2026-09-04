import { connectDb, disconnectDb } from "@onetap/db";
import { env } from "../env";
import { logger } from "../logger";
import { seedGazabMomos } from "../modules/outlets/outlets.service";

async function run(): Promise<void> {
  await connectDb({ uri: env.MONGODB_URI, dbName: env.MONGODB_DB });
  const { brand, outlet } = await seedGazabMomos();
  logger.info({ brand: brand.slug, outlet: outlet.slug }, "Seeded demo tenant");
  await disconnectDb();
}

run().catch((err) => {
  logger.error({ err }, "Seed failed");
  process.exitCode = 1;
});
