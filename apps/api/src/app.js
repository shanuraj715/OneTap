import { uploadUrls } from "./middleware/upload-urls.js";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, {              } from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { corsOrigins, env } from "./env.js";
import { logger } from "./logger.js";
import { localUploadsPath } from "./modules/storage/providers/index.js";
import { installCacheInvalidation } from "./modules/cache/invalidation.js";
import { requestStats } from "./modules/sysmon/request-stats.js";
import { authenticate } from "./middleware/auth.js";
import { errorHandler, notFound } from "./middleware/error.js";
import { limiter, onlyWrites } from "./middleware/rate-limit.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { brandsRouter } from "./modules/brands/brands.routes.js";
import { platformRouter, storeRouter } from "./modules/platform/platform.routes.js";
import { couponsRouter } from "./modules/coupons/coupons.routes.js";
import { customerRouter } from "./modules/customer/customer.routes.js";
import { customersRouter } from "./modules/customers/customers.routes.js";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes.js";
import { deliveryRouter } from "./modules/delivery/delivery.routes.js";
import { healthRouter } from "./modules/health/health.routes.js";
import { menuRouter } from "./modules/menu/menu.routes.js";
import { notifyRouter } from "./modules/notify/notify.routes.js";
import { ordersRouter } from "./modules/orders/orders.routes.js";
import { platformSiteRouter, siteRouter } from "./modules/site/site.routes.js";
import { staffOrdersRouter } from "./modules/orders/staff-orders.routes.js";
import { outletsRouter } from "./modules/outlets/outlets.routes.js";
import { pagesRouter } from "./modules/pages/pages.routes.js";
import { analyticsRouter } from "./modules/analytics/analytics.routes.js";
import { marketingRouter } from "./modules/marketing/marketing.routes.js";
import { whatsappRouter } from "./modules/whatsapp/whatsapp.routes.js";
import { paymentsRouter } from "./modules/payments/payments.routes.js";
import { previewRouter } from "./modules/preview/preview.routes.js";
import { printingRouter } from "./modules/printing/printing.routes.js";
import { qrCardsRouter } from "./modules/qr-cards/qr-cards.routes.js";
import { storageRouter } from "./modules/storage/storage.routes.js";
import { appUpdatesRouter } from "./modules/app-releases/app-releases.routes.js";
import { tablesRouter } from "./modules/tables/tables.routes.js";
import { usersRouter } from "./modules/users/users.routes.js";
import { ridersRouter } from "./modules/riders/riders.routes.js";
import { riderAppRouter } from "./modules/riders/rider-app.routes.js";
import { reservationsRouter } from "./modules/reservations/reservations.routes.js";
import { feedbackRouter } from "./modules/feedback/feedback.routes.js";
import { cartRemindersRouter } from "./modules/carts/carts.routes.js";
import { kitchenRouter } from "./modules/kitchen/kitchen.routes.js";

/** The dashboard's own routers: what a signed-in team member changes (each gets the "team-write" limit). */
const TEAM_ROUTES = [
  "/api/brands", "/api/platform", "/api/store", "/api/users", "/api/outlets", "/api/menu", "/api/orders", "/api/coupons",
  "/api/pages", "/api/whatsapp", "/api/marketing", "/api/analytics", "/api/tables", "/api/qr-cards", "/api/printing",
  "/api/preview", "/api/storage", "/api/customers", "/api/notify", "/api/dashboard", "/api/riders", "/api/reservations",
  "/api/feedback", "/api/cart-reminders", "/api/kitchen",
];

export function createApp()          {
  // cached data is thrown away the moment the data behind it is written (see modules/cache)
  installCacheInvalidation();

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
  // The public enquiry form is a few hundred characters; anything bigger is not a person. Same
  // reason as above for sitting here: the first parser to run sets the limit.
  app.use("/api/site/leads", express.json({ limit: "20kb" }));

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
  // picture addresses are kept without a domain in the database and get this deployment's domain on the way out
  app.use(uploadUrls());
  app.use(pinoHttp({ logger }));
  // counts requests, failures and speed for the Server page
  app.use(requestStats);

  // Attaches req.user when a valid session cookie is present; routes enforce.
  app.use(authenticate);

  // Request limits (middleware/rate-limit.js has every policy and the reason for it):
  // the floor under every /api request, and a cap on how fast a team member can change things.
  app.use("/api", limiter("api"));
  app.use(TEAM_ROUTES, onlyWrites(limiter("team-write")));

  app.use("/health", healthRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/brands", brandsRouter);
  // the Rasoi Pulse website: public content + the super admin's management of it
  app.use("/api/site", siteRouter);
  // the staff app asks here whether a newer version exists (before anyone signs in); the website lists and serves the APKs
  app.use("/api/app-updates", appUpdatesRouter);
  app.use("/api/platform/site", platformSiteRouter);
  app.use("/api/platform", platformRouter);
  app.use("/api/store", storeRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/outlets", outletsRouter);
  app.use("/api/menu", menuRouter);
  app.use("/api/customer", customerRouter);
  // before /api/orders, so its paths can never be read as an order id
  app.use("/api/orders/staff", staffOrdersRouter);
  app.use("/api/orders", ordersRouter);
  app.use("/api/coupons", couponsRouter);
  app.use("/api/delivery", deliveryRouter);
  app.use("/api/payments", paymentsRouter);
  // a store's own storefront pages: public reads for visitors, management for its team
  app.use("/api/pages", pagesRouter);
  app.use("/api/whatsapp", whatsappRouter);
  app.use("/api/marketing", marketingRouter);
  app.use("/api/analytics", analyticsRouter);
  app.use("/api/tables", tablesRouter);
  app.use("/api/qr-cards", qrCardsRouter);
  app.use("/api/printing", printingRouter);
  app.use("/api/preview", previewRouter);
  app.use("/api/storage", storageRouter);
  app.use("/api/customers", customersRouter);
  app.use("/api/notify", notifyRouter);
  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/riders", ridersRouter);
  // the rider app: its own sign-in (phone + PIN) and a token that opens only /api/rider
  app.use("/api/rider", riderAppRouter);
  app.use("/api/reservations", reservationsRouter);
  app.use("/api/kitchen", kitchenRouter);
  app.use("/api/feedback", feedbackRouter);
  app.use("/api/cart-reminders", cartRemindersRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
