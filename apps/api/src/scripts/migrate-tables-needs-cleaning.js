/**
 * The "Needs cleaning" table status was removed — a table is Free the moment its party leaves. This turns any table still
 * marked that way into a free one. Safe to run twice.
 *
 *   node src/scripts/migrate-tables-needs-cleaning.js          (dry run: says how many it would change)
 *   node src/scripts/migrate-tables-needs-cleaning.js --apply
 */
import { connectDb, disconnectDb, TableModel } from "@onetap/db";
import { env } from "../env.js";

const apply = process.argv.includes("--apply");
await connectDb({ uri: env.MONGODB_URI, dbName: env.MONGODB_DB });
const n = await TableModel.collection.countDocuments({ status: "needs-cleaning" });
console.log(`${n} table(s) marked "needs-cleaning".`);
if (apply && n) {
  const r = await TableModel.collection.updateMany({ status: "needs-cleaning" }, { $set: { status: "free" } });
  console.log(`made ${r.modifiedCount} free.`);
} else if (n) console.log("Dry run — add --apply to change them.");
await disconnectDb();
