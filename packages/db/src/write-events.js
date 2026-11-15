/**
 * "Something was just written" notifications.
 *
 * The API keeps copies of data that rarely changes (a store's look, its menu,
 * which address belongs to which store) so a page view doesn't have to read
 * the database. A copy is only safe if it is thrown away the moment the data
 * changes — and "every place that writes" is a list that grows and is easy to
 * forget. So instead of asking each writer to remember, the models that are
 * copied announce every write themselves, whichever way it was made: `save`,
 * `create`, `insertMany`, and every kind of update and delete query.
 *
 *   schema.plugin(writeEvents, { model: "Outlet", brandFrom: "brandId", outletFrom: "_id" });
 *   onModelWrite((event) => ...)   // { model, op, brandId?, outletId?, id?, paths? }
 *
 * Listeners run right after the database confirms the write and before the
 * caller continues, so anything that reads straight afterwards sees fresh data.
 * A listener that throws can never fail the write.
 */

const listeners = new Set();

/** Subscribe to writes. Returns a function that unsubscribes. */
export function onModelWrite(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Announce a write by hand (the plugin uses this; tests do too). */
export function emitModelWrite(event) {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      /* a cache that can't be told must never be the reason a save fails */
    }
  }
}

const NOISE = new Set(["updatedAt", "createdAt", "__v"]);

/** A value from a filter or document as a plain string id, or undefined when it is something else (a $in list, say). */
function asId(value) {
  if (value == null) return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "object" && typeof value.toHexString === "function") return value.toHexString();
  return undefined;
}

/** The top-level fields an update touches — `null` when that can't be told (a pipeline update, a delete). */
function changedFields(update) {
  if (!update || Array.isArray(update)) return null;
  const fields = [];
  for (const [key, value] of Object.entries(update)) {
    // $setOnInsert only applies when an upsert creates a document — it can't change anything already read.
    // (Mongoose adds the model's defaults to it on every upsert, which would look like a change to everything.)
    if (key === "$setOnInsert") continue;
    if (key.startsWith("$")) {
      for (const path of Object.keys(value ?? {})) fields.push(path.split(".")[0]);
    } else {
      fields.push(key.split(".")[0]);
    }
  }
  return fields;
}

/**
 * @param {import("mongoose").Schema} schema
 * @param {{ model: string, brandFrom?: string, outletFrom?: string, ignore?: string[] }} options
 *   brandFrom / outletFrom — which field of the document (or of a query's filter) holds the brand / outlet id.
 *   ignore — fields whose changes don't matter to anything copied (bookkeeping the app does by itself).
 */
export function writeEvents(schema, { model, brandFrom, outletFrom, ignore = [] }) {
  const quiet = new Set([...NOISE, ...ignore]);
  const matters = (fields) => fields === null || fields.some((f) => !quiet.has(f));

  const describe = (source, extra) => ({
    model,
    brandId: brandFrom ? asId(source?.[brandFrom]) : undefined,
    outletId: outletFrom ? asId(source?.[outletFrom]) : undefined,
    ...extra,
  });

  // `save`: what changed is only known before the save finishes, so note it first.
  schema.pre("save", function () {
    this.$locals.writeEventFields = this.isNew ? null : this.modifiedPaths().map((p) => p.split(".")[0]);
  });
  schema.post("save", function (doc) {
    const fields = this.$locals.writeEventFields ?? null;
    if (!matters(fields)) return;
    emitModelWrite(describe(doc, { op: fields === null ? "create" : "save", fields }));
  });

  // `doc.deleteOne()`
  schema.post("deleteOne", { document: true, query: false }, function (doc) {
    emitModelWrite(describe(doc, { op: "delete", fields: null }));
  });

  // every query that changes data: Model.updateOne(...), findOneAndUpdate(...), deleteMany(...), …
  schema.post(
    ["updateOne", "updateMany", "findOneAndUpdate", "findOneAndReplace", "replaceOne", "findOneAndDelete", "deleteOne", "deleteMany"],
    { query: true, document: false },
    function () {
      const isDelete = this.op === "deleteOne" || this.op === "deleteMany" || this.op === "findOneAndDelete";
      const fields = isDelete ? null : changedFields(this.getUpdate?.());
      if (!matters(fields)) return;
      const filter = this.getFilter?.() ?? {};
      emitModelWrite(describe(filter, { op: this.op, fields, id: asId(filter._id) }));
    },
  );

  schema.post("insertMany", function (docs) {
    for (const doc of Array.isArray(docs) ? docs : []) emitModelWrite(describe(doc, { op: "create", fields: null }));
  });
}
