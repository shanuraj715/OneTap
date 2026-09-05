import cookieParser from "cookie-parser";
import cors from "cors";
import express, {              } from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { corsOrigins, env } from "./env.js";
import { logger } from "./logger.js";
import { localUploadsPath } from "./modules/storage/providers/index.js";
import { authenticate } from "./middleware/auth.js";
import { errorHandler, notFound } from "./middleware/error.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { brandsRouter } from "./modules/brands/brands.routes.js";
import { couponsRouter } from "./modules/coupons/coupons.routes.js";
import { customerRouter } from "./modules/customer/customer.routes.js";
import { customersRouter } from "./modules/customers/customers.routes.js";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes.js";
import { deliveryRouter } from "./modules/delivery/delivery.routes.js";
import { healthRouter } from "./modules/health/health.routes.js";
import { menuRouter } from "./modules/menu/menu.routes.js";
import { notifyRouter } from "./modules/notify/notify.routes.js";
import { ordersRouter } from "./modules/orders/orders.routes.js";
import { outletsRouter } from "./modules/outlets/outlets.routes.js";
import { paymentsRouter } from "./modules/payments/payments.routes.js";
import { previewRouter } from "./modules/preview/preview.routes.js";
import { printingRouter } from "./modules/printing/printing.routes.js";
import { qrCardsRouter } from "./modules/qr-cards/qr-cards.routes.js";
import { storageRouter } from "./modules/storage/storage.routes.js";
import { tablesRouter } from "./modules/tables/tables.routes.js";
import { usersRouter } from "./modules/users/users.routes.js";

export function createApp()          {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  // Locally-stored uploads (the `local` storage provider). Mounted before helmet
  // so its same-origin CORP header doesn't stop the storefront — a different
  // origin — from loading the images. Immutable: every object has a unique key.
  app.use(
    "/uploads",
    express.static(localUploadsPath(env.UPLOADS_DIR), {
      index: false,
      dotfiles: "ignore",
      fallthrough: true,
      maxAge: "365d",
      setHeaders: (res) => {
        res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      },
    }),
  );

  app.use(helmet());
  app.use(cors({ origin: corsOrigins, credentials: true }));

  // A table-card design embeds its background photo, logo and QR centre-mark as
  // data URLs — a canvas that drew a remote image is tainted and cannot be
  // exported at all, so there is no version of this that stays under 1mb.
  //
  // This has to sit ABOVE the global parser rather than inside the router:
  // express.json sets `req._body` once it has run, and every later json()
  // middleware sees that flag and skips. A router-level limit would therefore
  // never get the chance to raise it — the body would already have been
  // rejected at 1mb.
  app.use("/api/qr-cards", express.json({ limit: "6mb" }));

  app.use(
    express.json({
      limit: "1mb",
      // webhook signatures are computed over the exact bytes, so keep them
      verify: (req, _res, buf) => {
        (req                                          ).rawBody = buf.toString("utf8");
      },
    }),
  );
  app.use(cookieParser());
  app.use(pinoHttp({ logger }));

  // Attaches req.user when a valid session cookie is present; routes enforce.
  app.use(authenticate);

  app.use("/health", healthRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/brands", brandsRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/outlets", outletsRouter);
  app.use("/api/menu", menuRouter);
  app.use("/api/customer", customerRouter);
  app.use("/api/orders", ordersRouter);
  app.use("/api/coupons", couponsRouter);
  app.use("/api/delivery", deliveryRouter);
  app.use("/api/payments", paymentsRouter);
  app.use("/api/tables", tablesRouter);
  app.use("/api/qr-cards", qrCardsRouter);
  app.use("/api/printing", printingRouter);
  app.use("/api/preview", previewRouter);
  app.use("/api/storage", storageRouter);
  app.use("/api/customers", customersRouter);
  app.use("/api/notify", notifyRouter);
  app.use("/api/dashboard", dashboardRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
