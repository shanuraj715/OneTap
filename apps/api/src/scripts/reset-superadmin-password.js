import { randomBytes } from "node:crypto";
import { connectDb, disconnectDb, UserModel } from "@onetap/db";
import { env } from "../env.js";
import { logger } from "../logger.js";
import { hashPassword } from "../modules/auth/password.js";

const SUPERADMIN_EMAIL = "admin@tablepe.example";

/**
 * There's no self-service "forgot password" flow yet, so this is the only way
 * back in if the superadmin's password is lost. Generates a fresh password,
 * hashes it, and overwrites just that one account's passwordHash — nothing
 * else about the account (memberships, isSuperAdmin, etc.) is touched.
 *
 * Password is generated fresh at run time, never hardcoded, for the same
 * reason as seed.js: a literal password in source becomes a permanent,
 * public credential in git history.
 */
async function run()                {
  await connectDb({ uri: env.MONGODB_URI, dbName: env.MONGODB_DB });

  const user = await UserModel.findOne({ email: SUPERADMIN_EMAIL });
  if (!user) {
    logger.error({ email: SUPERADMIN_EMAIL }, "No account with that email — run `pnpm seed` instead to create one");
    await disconnectDb();
    process.exitCode = 1;
    return;
  }

  const password = randomBytes(12).toString("base64url");
  user.passwordHash = await hashPassword(password);
  await user.save();

  logger.info({ email: user.email, password }, "Reset the superadmin's password — save this now, it will not be shown again");
  await disconnectDb();
}

run().catch((err) => {
  logger.error({ err }, "Password reset failed");
  process.exitCode = 1;
});
