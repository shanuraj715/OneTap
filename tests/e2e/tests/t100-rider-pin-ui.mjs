// T100 — Settings → Delivery riders: giving a rider an app login (PIN), resetting it, switching it off.
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t100-rider-pin-ui",
  title: "Dashboard: the manager gives a delivery rider an app login with a PIN, resets it and switches it off",
  area: "delivery",
  browser: true,
  fresh: false,
  summary: "Chrome against the bench store. Settings → Delivery riders has a 'Rider app' column ('No login' for a new rider). 'App login' opens a dialog that names the rider's phone number as the login name, suggests a 4-digit PIN (never 0000 or 1111), accepts only digits and needs at least 4, and says the PIN is not shown again; saving turns the row to 'Login on' with 'Reset PIN', the PIN appears nowhere on the page, and the rider can really sign in to the app API with that number and PIN. 'Reset PIN' warns that the old PIN stops working, and it does. 'Login off' (after a confirm) returns the row to 'No login' and the rider can no longer sign in. A rider with no phone number gets the server's sentence that a 10-digit number is needed first. No console errors; the riders it adds are removed.",
  expect: [
    "A manager can turn a rider's app login on with a PIN, reset it, and switch it off from the Delivery riders page.",
    "The rider can sign in with the phone number and PIN, and stops being able to when the PIN is reset (old PIN) or the login is switched off.",
  ],
  expectNot: [
    "The PIN must NOT be shown anywhere after it is saved.",
    "A rider with no phone number must NOT be given a login.",
  ],
};

export const run = (d) => runSuite(d, "rider-pin-ui.mjs", { timeoutMs: 5 * 60_000 });
