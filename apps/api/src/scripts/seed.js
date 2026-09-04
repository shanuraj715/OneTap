import { randomBytes } from "node:crypto";
import { connectDb, disconnectDb } from "@onetap/db";
import { env } from "../env.js";
import { logger } from "../logger.js";
import { ensureSuperAdmin } from "../modules/auth/auth.service.js";

const SUPERADMIN_EMAIL = "admin@tablepe.example";

/**
 * Bootstraps a bare TablePe environment: nothing but the one platform
 * superadmin login, so there's a way in. No demo brand, outlet, menu, or
 * owner account — the superadmin creates those (brands, owners, staff, …)
 * from inside the app itself.
 *
 * The password is generated fresh at run time, never hardcoded — this script
 * can run against a real environment, and a literal password in source
 * becomes a live, permanent credential in git history the moment it does.
 */
async function run()                {
  await connectDb({ uri: env.MONGODB_URI, dbName: env.MONGODB_DB });

  const password = randomBytes(12).toString("base64url"); // only ever used if this account doesn't exist yet
  const result = await ensureSuperAdmin({
    email: SUPERADMIN_EMAIL,
    name: "TablePe Admin",
    password,
  });

  if (result.created) {
    logger.info(
      { email: result.email, password },
      "Created TablePe superadmin — save this password now, it will not be shown again",
    );
  } else {
    logger.info({ email: result.email }, "TablePe superadmin already exists — nothing to do");
  }
  await disconnectDb();
}

run().catch((err) => {
  logger.error({ err }, "Seed failed");
  process.exitCode = 1;
});
