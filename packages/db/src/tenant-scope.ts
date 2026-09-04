import type { MongooseQueryMiddleware, Schema } from "mongoose";

export interface TenantContext {
  brandId: string;
  outletId?: string;
}

/** Query operations that must be tenant-scoped. */
const GUARDED_OPS: MongooseQueryMiddleware[] = [
  "countDocuments",
  "deleteMany",
  "deleteOne",
  "find",
  "findOne",
  "findOneAndDelete",
  "findOneAndReplace",
  "findOneAndUpdate",
  "replaceOne",
  "updateMany",
  "updateOne",
];

/**
 * Mandatory on every tenant-owned model. MongoDB has no row-level security, so this
 * plugin IS the isolation boundary:
 *
 *  - adds `brandId` (required) + `outletId` (optional), both indexed
 *  - refuses any read/write query that isn't filtered by `brandId`, unless the caller
 *    explicitly opts out with `{ allowGlobalQuery: true }` (super-admin / migrations only)
 *  - refuses to save / insert a document with no `brandId`
 *
 * Scope every query with {@link tenantFilter}.
 */
export function tenantScope(schema: Schema): void {
  schema.add({
    brandId: { type: String, required: true, index: true },
    outletId: { type: String, required: false, index: true },
  });

  schema.pre(GUARDED_OPS, function guard(this: any) {
    const options = (this.getOptions?.() ?? {}) as Record<string, unknown>;
    const filter = (this.getFilter?.() ?? this.getQuery?.() ?? {}) as Record<string, unknown>;
    const scoped = filter.brandId != null || options.tenantScoped === true;

    if (!scoped && options.allowGlobalQuery !== true) {
      throw new Error(
        `[tenant-scope] Refusing unscoped "${this.op ?? "query"}" on ` +
          `"${this.model?.modelName ?? "?"}". Filter by brandId (use tenantFilter), ` +
          `or pass { allowGlobalQuery: true } deliberately.`,
      );
    }
  });

  schema.pre("save", function guardSave(this: any) {
    if (!this.brandId) {
      throw new Error(
        `[tenant-scope] Cannot save "${this.constructor?.modelName ?? "document"}" without brandId.`,
      );
    }
  });

  schema.pre("insertMany", function guardInsertMany(this: any, next: (err?: Error) => void, docs: any[]) {
    if (!Array.isArray(docs) || docs.some((d) => !d || !d.brandId)) {
      next(new Error("[tenant-scope] insertMany requires brandId on every document."));
      return;
    }
    next();
  });
}

/**
 * Build a tenant-scoped filter. Use for EVERY query on a tenant-owned model:
 *
 *   OutletModel.find(tenantFilter(ctx, { slug: "laxmi-nagar" }))
 */
export function tenantFilter(
  ctx: TenantContext,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    ...extra,
    brandId: ctx.brandId,
    ...(ctx.outletId ? { outletId: ctx.outletId } : {}),
  };
}
