import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { corsOrigins } from "./env";
import { logger } from "./logger";
import { authenticate } from "./middleware/auth";
import { errorHandler, notFound } from "./middleware/error";
import { authRouter } from "./modules/auth/auth.routes";
import { couponsRouter } from "./modules/coupons/coupons.routes";
import { customerRouter } from "./modules/customer/customer.routes";
import { customersRouter } from "./modules/customers/customers.routes";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes";
import { deliveryRouter } from "./modules/delivery/delivery.routes";
import { healthRouter } from "./modules/health/health.routes";
import { menuRouter } from "./modules/menu/menu.routes";
import { notifyRouter } from "./modules/notify/notify.routes";
import { ordersRouter } from "./modules/orders/orders.routes";
import { outletsRouter } from "./modules/outlets/outlets.routes";
import { paymentsRouter } from "./modules/payments/payments.routes";
import { printingRouter } from "./modules/printing/printing.routes";
import { tablesRouter } from "./modules/tables/tables.routes";
import { usersRouter } from "./modules/users/users.routes";

export function createApp(): Express {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(cors({ origin: corsOrigins, credentials: true }));
  app.use(
    express.json({
      limit: "1mb",
      // webhook signatures are computed over the exact bytes, so keep them
      verify: (req, _res, buf) => {
        (req as express.Request & { rawBody?: string }).rawBody = buf.toString("utf8");
      },
    }),
  );
  app.use(cookieParser());
  app.use(pinoHttp({ logger }));

  // Attaches req.user when a valid session cookie is present; routes enforce.
  app.use(authenticate);

  app.use("/health", healthRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/outlets", outletsRouter);
  app.use("/api/menu", menuRouter);
  app.use("/api/customer", customerRouter);
  app.use("/api/orders", ordersRouter);
  app.use("/api/coupons", couponsRouter);
  app.use("/api/delivery", deliveryRouter);
  app.use("/api/payments", paymentsRouter);
  app.use("/api/tables", tablesRouter);
  app.use("/api/printing", printingRouter);
  app.use("/api/customers", customersRouter);
  app.use("/api/notify", notifyRouter);
  app.use("/api/dashboard", dashboardRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
