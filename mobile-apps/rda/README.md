# Rasoi Pulse RDA — Rider Delivery App

An Android app (phones, Android 11 or newer) for **delivery riders**: sign in with your mobile number and a PIN, see the deliveries the
manager has handed to you, get directions in your own maps app, call or message the customer, and mark each order picked up and delivered.
It uses the same API as the dashboard (its own routes, `/api/rider/…`) and needs **no paid map or routing service**.

> The whole project is described in the root [`README.md`](../../README.md) (see "Rider app (RDA)" there for the sign-in, the
> delivery code and the API). This file only says how to **run, build, version and test this app**.

## What is in it

| Tab | What it does |
| --- | --- |
| **Deliveries** | Your deliveries, on the way first, then ready to pick up, then the ones the kitchen is still making. Each card: order number and state, the address with its landmark, the distance from the restaurant, the customer and their number, what is in the bag, whether it was paid online, an order note. Buttons: **Navigate** (the phone's maps app, at the customer's pin), **Call**, **WhatsApp** (a chat with an "I'm outside" message ready) and the one big step button — **Picked up**, then **Delivered**. A new delivery vibrates the phone and says which |
| **Done** | What you delivered today, with **your day in four numbers** on top: how many, the distance, the average time from "picked up" to "delivered", the fastest trip, and your first and last delivery times (a trip over six hours is a forgotten tap and is left out of the average; a day with more than 30 shows "30+") |
| **Account** | Who you are, your store and outlet, the new-delivery alert, version, update check, sign out |

**The delivery code.** When a customer orders delivery they get a 4-digit code on their order page while the food is on its way. **Delivered**
asks the rider for it (the server never sends it to the app). Five wrong tries lock that order for the rider — they call the store, and a
manager can still mark it delivered in the dashboard. Older orders with no code need none.

**Free, no keys.** Navigate opens `https://www.google.com/maps/dir/?api=1&destination=<lat>,<lng>` in the rider's own maps app (or the
phone's generic `geo:` link): a plain link, no API key, no account, no per-use bill. Call is `tel:`, WhatsApp is `https://wa.me/…`.

## Notifications when the app is closed

When the manager hands you a delivery, your phone is told even if the app is closed or minimised ("New delivery #0006 — Sector 62 · 3.5 km · ₹440 · Karan"); tap it to open the deliveries. After you sign in the app asks Android's permission (once), and the **Account** page has a **Notifications** card that says where it stands (on · blocked → *Open phone settings* · not available on this build · couldn't tell the server → *Turn on*). Signing out stops them for that phone.

It needs the Firebase file: put **`google-services.json`** (for the package `com.rasoipulse.rda`) in this folder before building — it is git-ignored. Without it the app builds and works as before, but the card says "not available on this build". The server side (the service-account key, `FCM_SERVICE_ACCOUNT_FILE`) and the whole one-time set-up are in the root [`README.md`](../../README.md) under *Rider app (RDA)*. **After changing `app.config.ts` or adding the file, run the build again** (the Android project is generated from them).

## Who may sign in

A rider is a name and phone number on **Settings → Delivery riders**. The manager gives them an app login there (**App login** → a PIN of 4–6
digits, stored only as a hash; **Reset PIN** ends every sign-in made before; **Login off** removes the access). The rider signs in with the
phone number and that PIN. A rider's token opens **only** `/api/rider/…` — their own deliveries — never the dashboard. A store whose plan has
no **Delivery**, a switched-off store, a rider switched off in the list, a removed rider or an old app build are all turned away.

## What you need

Same as the other apps: Node 20.9+, JDK 17, the Android SDK (no Android Studio, no Expo account). See
[`../oma/README.md`](../oma/README.md#what-you-need) for the one-time setup.

```bash
cd mobile-apps/rda
npm install
npm run check          # type check + lint + all tests + version check
```

## See it live on your phone

```bash
node tests/e2e/bench/bench.mjs up   # from the repository root: the throwaway TEST server (fake restaurant, fake data)
cd mobile-apps/rda
npm run phone                       # the code server, pointed at the test server on this Mac, with a QR code
```

The bench's Acme store has delivery switched on. Give a rider a login in the dashboard (Settings → Delivery riders → *App login*; the dashboard is
`http://localhost:3171`, sign in as `o@acme.test` / `Owner123!`), hand them an order from **Orders**, then sign in to the app with that rider's
phone number and PIN. `npm run phone:usb` is the same through a USB cable; `npm run phone:live` talks to the live server.

## Build an APK

```bash
npm run build:debug      # a test build, loads its code from `npm start`
npm run build:release    # the code is inside the app (for handing to riders)
```

The APK lands in `build-output/rasoi-pulse-rda-<version>-<mode>.apk`. The native `android/` folder is generated from `app.config.ts` (git-ignored,
never edit it). The app id is **`com.rasoipulse.rda`**, so it installs beside the staff app (OMA) and the kitchen app (KDA).

### Release signing (one company key)

The Rasoi Pulse apps share **one** key, in `~/.rasoi-pulse/signing/oma/` — see [`../kda/README.md`](../kda/README.md#release-signing-one-company-key).
`npm run signing:show` / `signing:verify` work here the same way, and a test checks that this app's `signing-fingerprint.txt` is the same as OMA's.

## Version management

`v-YY.MM.DD-NNN`, in `app-version.json`: the first version is **`v-26.11.27-001`**. It changes **only when the owner asks for an upgrade**
(`npm run version:bump -- --confirm`). To publish a build: console → **App Management** → the **RDA** tab → *New version*; the website page is `/apps/rda`.

## Tests

```bash
npm test            # jest: logic, screens, the API client, recorded server answers, the update gate, signing, versions
```

They run against **recorded real API answers** in `test/fixtures`. To record them again (when a rider endpoint changes):

```bash
node tests/e2e/suites/_record-rider-app-fixtures.mjs     # from the repository root: a throwaway API, no real data
```

The server side of the app (sign-in, isolation, the delivery steps and the code) is `tests/e2e/suites/rider-app-api.mjs` (t98); the manager's PIN
screen is t100; the customer's map when ordering delivery is t99.

## Project layout

```
src/app/            routes (Expo Router): sign-in, (app)/(tabs): Deliveries, Done, Account
src/screens/        DeliveriesScreen (+ the code sheet), DeliveryCard, DoneScreen, AccountScreen, SignInScreen
src/features/       plain logic the screens draw: deliveries.ts (order of the list, next step), maps.ts (directions / call / WhatsApp links), signin.ts
src/data/           the server's answers kept in memory and refreshed (TanStack Query): the list every 10 s
src/api/            the client, the endpoints and the schemas
src/auth/           the sign-in (token in memory unless "Keep me signed in")
src/updates/        the update check, pop-up and required screen
src/ui/             the small component kit (buttons, sheets, chips, badges, toasts…), themed light/dark
```
