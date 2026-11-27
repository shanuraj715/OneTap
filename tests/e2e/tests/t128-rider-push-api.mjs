// T128 — A delivery handed to a rider is pushed to their phone (Firebase Cloud Messaging), with the app closed or minimised
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t128-rider-push-api",
  title: "Rider push notifications: a phone registers its Firebase token; a NEW hand-over pushes 'New delivery #…' (where, how far, how much) to that rider's phones only; dead tokens are forgotten; no key set up = nothing breaks",
  area: "riders",
  browser: false,
  fresh: false,
  summary: "API checks on an in-memory database, with a local stand-in for Google's token server and FCM (it verifies the service-account JWT's signature and claims). A rider's phone registers its device token (PUT /api/rider/push-token; 401 without sign-in, 400 for a nonsense token, one phone = one rider, five newest kept, DELETE on sign-out, never shown in the manager's rider list). Handing a delivery to a rider sends 'New delivery #0001' with the address, distance, total and customer, data (type, orderId, orderNumber — all text) for a tap to open it, high priority on the 'deliveries' channel with a time limit, and no delivery code. Only a NEW hand-over pushes: the same rider saved again, a rider typed in by name, taking the rider off and the rider marking it picked up themselves send nothing; moving it to another rider pushes the new one only. One access token is reused for many messages; a 401 from Google gets one fresh token and one more try. A phone Google says is UNREGISTERED is removed from the rider; a 500 is not. With no key set up (or a broken one) the hand-over works and nothing is sent.",
  expect: [
    "A new hand-over sends a signed, well-formed notification to the new rider's phones and nobody else's.",
    "Dead device tokens are removed; temporary failures are not.",
    "Push being off or broken never breaks a hand-over.",
  ],
  expectNot: [
    "The same rider saved again, or the rider's own pickup, must NOT push.",
    "A device token must NOT appear in the manager's rider list.",
    "The delivery code must NOT be in a notification.",
  ],
};

export const run = (d) => runSuite(d, "rider-push-api.mjs", { timeoutMs: 4 * 60_000 });
