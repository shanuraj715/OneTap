// T97 — The Kitchen app's server side: roles at sign-in, dishes sold out / unavailable / available, the manager's numbers.
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t97-kitchen-app-api",
  title: "Kitchen app (KDA) API: only the kitchen team may sign in; a dish can be marked sold out / unavailable / available from the kitchen (with a stock number for managers); nothing the other apps or the dashboard do has changed",
  area: "kitchen",
  browser: false,
  fresh: false,
  summary: "Runs suites/kitchen-app-api.mjs on a private API with an in-memory database (no browser). Sign-in with x-app-id: kda: kitchen staff, a manager, the owner and the platform admin get in; a waiter, an accountant and an editor are turned away with a clear message (403 app_not_allowed) and the session that was just opened is ended; the same waiter and a cook still sign in to OMA exactly as before. Dishes: the list shows every dish with its state (available / sold out / unavailable, a counted dish at zero = sold out, running low flagged); the cook switches a dish sold out → unavailable → available, the staff app's 'unavailable now' list and the storefront menu follow at once and the storefront shows nothing of the kitchen's note; a waiter can't switch a dish; an unknown state is 400, a missing dish 404; a counted dish with none left stays sold out when put back (and says so), a cook can't set a number (403), the manager can (menu:update), a number for an uncounted dish is refused; the dashboard's own switch clears the kitchen's note (switched back on = available, switched off = unavailable, never a stale 'sold out'). The board is the existing one; today's summary with no orders is zeros.",
  expect: [
    "Only kitchen staff, managers, owners and the platform admin can sign in to the Kitchen app; everyone else gets a clear refusal and no session.",
    "A cook can mark a dish sold out, unavailable or available and every screen follows; only a manager can put a stock number on it.",
    "OMA's sign-in and the dashboard behave exactly as before.",
  ],
  expectNot: [
    "A waiter must NOT get into the Kitchen app or switch a dish from it.",
    "A cook must NOT be able to change a stock count.",
    "The storefront menu must NOT show the kitchen's reason for a switched-off dish.",
  ],
};

export const run = (d) => runSuite(d, "kitchen-app-api.mjs", { timeoutMs: 6 * 60_000 });
