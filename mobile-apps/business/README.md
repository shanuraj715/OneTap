# Rasoi Pulse Business

An Android app (phones **and** tablets, Android 11 or newer) for **restaurant owners** — and for the managers and accountants they share reports
with. It shows how the store is doing: sales by day, week, month and year with comparisons, profit and loss, expenses, GST, best dishes, customers,
outlets side by side, bookings, coupons, stock, staff and ratings — and it makes **Excel / PDF / CSV / JSON reports** to download and share.
It uses the store's own API (`/api/analytics/*`, `/api/users`, …); the server decides everything a person may see or do.

> The whole project is described in the root [`README.md`](../../README.md) (see "Business app" there). This file only says how to **run, build,
> version and test this app**.

## What is in it

Each person sees only the areas their role and the store's plan allow (owner: everything; manager: no money, staff or reports; accountant: money
and reports but no staff). The list is in `src/lib/access.ts`; a test checks that every area has a screen.

Home · Sales · Money (profit & loss, expenses, GST, cash) · Dishes · Customers · Outlets · Bookings · Coupons · Stock · Staff · Reports · Ratings · Account.

## What you need

Node 20.9+, JDK 17, the Android SDK (no Android Studio, no Expo account). See [`../oma/README.md`](../oma/README.md#what-you-need) for the one-time setup.

```bash
cd mobile-apps/business
npm install
npm run check          # type check + lint + all tests + version check
```

## See it live on your phone

```bash
node tests/e2e/bench/bench.mjs up   # from the repository root: the throwaway TEST server (fake data; owner o@acme.test / Owner123!)
cd mobile-apps/business
npm run phone                       # the code server, pointed at the test server on this Mac, with a QR code
```

Restart the code server after changing `app.config.ts` or adding a package. `npm run phone:usb` is the same through a USB cable; `npm run phone:live`
talks to the live server. Sign in with a store owner, manager or accountant account; anyone else is turned away with a sentence.

## Build an APK

```bash
npm run build:debug      # a test build, loads its code from `npm start`
npm run build:release    # the code is inside the app (needs the company signing key)
```

The APK lands in `build-output/rasoi-pulse-business-<version>-<mode>.apk`. The native `android/` folder is generated from `app.config.ts`
(git-ignored, never edit it). The app id is **`com.rasoipulse.business`**, so it installs beside the other Rasoi Pulse apps. Release builds are signed
with the same company key as the other apps (`~/.rasoi-pulse/signing/oma/`); `npm run signing:show` says where it is. The app is **private** on the
website until you make it public (Console → App Management).

## Version management

`v-YY.MM.DD-NNN` in `app-version.json`; it changes **only when the owner asks for an upgrade** (`npm run version:bump -- --confirm`).

## Tests

```bash
npm test            # jest, --no-watchman: every screen against a fake server, access rules, files, app lock, profit maths against the web code
```

The server side is tested by t131 (the reports) and **t135, the contract test**: it asks the real API for every address the app uses and checks the
fields and types the app reads. When you change what the app reads, change `src/api/endpoints.ts`, the fixtures in `test/data.ts` **and** the field
list in `tests/e2e/suites/business-app-contract-api.mjs` together.

## Project layout

```
src/app/            routes (Expo Router): sign-in, (app)/[area]
src/screens/        Home, Sales, Money (+ money/), Dishes, Customers, Outlets, Bookings, Coupons, Stock, Staff, Reports, Ratings, More (Account)
src/ui/             the glass kit: Background, Glass, Frost, charts (line, bars, donut, stacked area, heat map, gauge), sheets, dropdown, date picker, nav, lock screen
src/api/            the client and the endpoints (what the API answers, only the parts the app uses)
src/data/           the period / outlet filter, report queries, the profit plan, report history, the app lock
src/lib/            access (areas by role), dates (India's time), the profit maths, formats, files (save + share)
test/               the fake server and made-up answers the tests use
```
