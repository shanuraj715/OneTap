import { Router } from "express";
import { CustomerModel } from "@onetap/db";
import { requireOutletContext } from "../../middleware/auth.js";
import { ledgerFor } from "../wallet/wallet.service.js";

export const customersRouter         = Router();

/** Admin: everyone who has ever ordered at this outlet, name/email/mobile + wallet. */
customersRouter.get("/", async (req, res) => {
  const ctx = await requireOutletContext(req, "customer:read");
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";

  // Customer rows aren't tenant-scoped by outlet (a diner spans outlets of
  // the same brand), so filter by brandId directly rather than tenantFilter.
  const filter                          = { brandId: ctx.brandId };
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ name: rx }, { email: rx }, { phone: rx }];
  }

  const customers = await CustomerModel.find(filter)
    .sort({ lastOrderAt: -1, createdAt: -1 })
    .limit(200)
    .lean();

  res.json({
    customers: customers.map((c) => ({
      id: String(c._id),
      name: c.name ?? null,
      email: c.email ?? null,
      phone: c.phone ?? null,
      gender: c.gender ?? null,
      age: c.age ?? null,
      orderCount: c.orderCount,
      walletBalance: c.walletBalance ?? 0,
      lastOrderAt: c.lastOrderAt ?? null,
      createdAt: c.createdAt,
    })),
  });
});

/** A customer's coin ledger — how they earned and spent what they have now. */
customersRouter.get("/:id/wallet", async (req, res) => {
  const ctx = await requireOutletContext(req, "customer:read");
  const customer = await CustomerModel.findOne({ _id: req.params.id, brandId: ctx.brandId }).lean();
  const entries = await ledgerFor(ctx, req.params.id);
  res.json({
    balance: customer?.walletBalance ?? 0,
    entries: entries.map((e) => ({
      id: String(e._id),
      kind: e.kind,
      coins: e.coins,
      balanceAfter: e.balanceAfter,
      reason: e.reason,
      orderId: e.orderId ?? null,
      orderNumber: e.orderNumber ?? null,
      createdAt: e.createdAt,
    })),
  });
});
