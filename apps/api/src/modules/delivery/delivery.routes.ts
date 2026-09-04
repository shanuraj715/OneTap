import { Router } from "express";
import { z } from "zod";
import { checkDelivery } from "@onetap/config-schema";
import { OutletModel } from "@onetap/db";
import { HttpError } from "../../middleware/error";
import { outletConfigFor } from "../orders/orders.service";

export const deliveryRouter: Router = Router();

const checkBody = z.object({
  outletId: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  /** the cart's item total in paise, so the free-delivery threshold can apply */
  subtotal: z.number().int().min(0).optional(),
});

/**
 * "Will you deliver to this pin, and on what terms?"
 *
 * Called from the storefront as the customer moves the map marker. Returns the
 * straight-line distance, whether it's inside the delivery radius, the fee, and
 * an ETA — all from the outlet's own settings, with no external API.
 */
deliveryRouter.post("/check", async (req, res) => {
  const body = checkBody.parse(req.body);

  const outlet = await OutletModel.findOne({ _id: body.outletId }, null, { allowGlobalQuery: true }).lean();
  if (!outlet) throw new HttpError(404, "Outlet not found");

  const config = await outletConfigFor({ brandId: outlet.brandId, outletId: String(outlet._id) });

  if (!config.features.ordering.delivery) {
    res.json({ serviceable: false, reason: "This outlet doesn't offer delivery.", distanceKm: 0, fee: 0, etaMinutes: 0, radiusKm: 0 });
    return;
  }

  const limits = config.operations.limits;
  const prep = config.operations.prepTime;

  const result = checkDelivery(
    config.identity.location.point,
    { lat: body.lat, lng: body.lng },
    {
      radiusKm: limits.deliveryRadiusKm,
      fee: limits.deliveryFee,
      freeDeliveryAbove: limits.freeDeliveryAbove,
      prepMinutes: prep.defaultMinutes + (prep.busyMode ? prep.busyExtraMinutes : 0),
      minutesPerKm: limits.deliveryMinutesPerKm,
      minEtaMinutes: limits.deliveryMinEtaMinutes,
    },
    body.subtotal,
  );

  res.json(result);
});

/** The shop's own location, so the storefront map can centre on it. */
deliveryRouter.get("/origin", async (req, res) => {
  const outletId = typeof req.query.outletId === "string" ? req.query.outletId : "";
  if (!outletId) throw new HttpError(400, "outletId is required");

  const outlet = await OutletModel.findOne({ _id: outletId }, null, { allowGlobalQuery: true }).lean();
  if (!outlet) throw new HttpError(404, "Outlet not found");

  const config = await outletConfigFor({ brandId: outlet.brandId, outletId: String(outlet._id) });
  res.json({
    point: config.identity.location.point,
    formattedAddress: config.identity.location.formattedAddress,
    radiusKm: config.operations.limits.deliveryRadiusKm,
    deliveryEnabled: config.features.ordering.delivery,
  });
});
