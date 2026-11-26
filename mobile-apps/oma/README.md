# Rasoi Pulse OMA — Order Management App

An Android app (phones **and** tablets, Android 11 or newer) for restaurant staff who **walk to the tables**: sign in, see
the floor, take an order at a table, send it to the kitchen, and look after the table (move the party, confirm payment, free
the table, cancel it). It is the table-side twin of the dashboard's **Take order** and **Tables** pages and uses the same API.

> The whole project is described in the root [`README.md`](../../README.md). This file only says how to **run, build,
> version and test this app**.

## What you need

| | |
| --- | --- |
| Node | 20.9 or newer |
| Java | JDK 17 (`brew install openjdk@17`, then `export JAVA_HOME=/opt/homebrew/opt/openjdk@17`) |
| Android SDK | platform + build-tools 36/37 (already on this Mac in `~/Library/Android/sdk`) |
| **Android Studio** | **not required.** Gradle (a command-line tool) does the real build; Android Studio would only call the same Gradle. Install it only if you want its emulator manager or a visual debugger |
| Expo | only as a *library* (file-based routing, config). No Expo account, no Expo cloud build, no EAS |

```bash
cd mobile-apps/oma
npm install
npm run check          # type check + lint + all tests + version check
```

## See it live on your phone

The app's screens are JavaScript, so while you work they **reload on the phone within about a second** of saving a file
(no rebuild, no reinstall). The phone and the Mac must be on the same Wi-Fi (or joined by a USB cable).

```bash
node tests/e2e/bench/bench.mjs up   # from the repository root: the throwaway TEST server (fake restaurant, fake data)
cd mobile-apps/oma
npm run phone                       # starts the code server, pointed at the test server on this Mac, and shows a QR code
```

Open **Expo Go** on the phone and scan the QR code (or open the real app from a debug build, see below). Sign in with the
test account: **`s@acme.test` / `Staff1234!`**. The bottom of the sign-in screen shows which server the app is using —
check it first if sign-in ever says something unexpected.

| Command | Talks to |
| --- | --- |
| `npm run phone` | the test server on this Mac, over Wi-Fi (the usual one) |
| `npm run phone:usb` | the same test server through a USB cable (`adb`, USB debugging on; no Wi-Fi needed) |
| `npm run phone:live` | the real live server (real stores — sign in with a real store account) |

Before it starts, the command asks the server whether it knows the app's sign-in, so a wrong or out-of-date server is
reported here in one sentence rather than as "Not found" on the phone. If the test server is not running it tells you how to start it.

> **The live server has the app's sign-in route** (`POST /api/auth/app-login`, deployed 2026-11-26), so `npm start` (no
> `phone` script) talks to the real server by default and `npm run phone:live` works. Use a store account (owner, manager or
> staff) — the platform super admin has no outlet and the app says so. A wrong password counts against this phone's internet
> address, the same as on the dashboard (4 wrong tries pause it for a while).

**Expo Go vs. the real app.** Expo Go (Play Store) is the quickest look but opens as "Expo Go". The debug build is the real
"Rasoi Pulse OMA" with its own name and icon: build it once with `npm run build:debug`, install it with
`adb install -r build-output/rasoi-pulse-oma-*-debug.apk`, then start the code server with `npm run phone` and open the app.
A debug build that must reach a plain `http://` test server is built with `RP_ALLOW_HTTP=1` (never allowed in a release build):

```bash
EXPO_PUBLIC_API_URL=http://<this Mac's address>:3097 RP_ALLOW_HTTP=1 npm run build:debug
```

On the Android emulator the Mac is `http://10.0.2.2:3097`.

## Build an APK

```bash
npm run build:debug      # a test build, loads its code from `npm start`
npm run build:release    # the code is inside the app (for handing to staff) — see "Signing" below
npm run build:debug -- --clean    # start from a freshly generated android/ folder
```

`scripts/build-android.js` writes the native `android/` project from `app.config.ts` (it is **generated and git-ignored — never
edit it**), runs Gradle, and copies the APK to `build-output/rasoi-pulse-oma-<version>-<mode>.apk`.

Why it is quick: arm64-only (every Android 11+ device and the Apple-silicon emulator), Gradle's parallel build, build
cache and daemon switched on (`plugins/with-fast-gradle.js`), and the JavaScript compiled by Hermes. The first build also
downloads Gradle and the libraries once; later builds reuse them.

Typical times on an Apple-silicon Mac: the very first debug build about 15 minutes (it downloads Gradle and the libraries once), a rebuild about 1–3 minutes; a debug APK is ~96 MB, a release APK ~35 MB.

### Release signing (the key)

Android installs an update over an installed app **only if both files are signed with the same key**. So the release build is
signed with our own key, made **once** and kept for the life of the app (never Android's shared debug key). The build checks every
release against that key's fingerprint before it can leave `build-output/`.

```bash
npm run signing:create     # ONCE: makes the key; the fingerprint goes into signing-fingerprint.txt (public: commit it)
npm run build:release      # signs with it, checks the result, copies it to build-output/
npm run signing:show       # where the key is + its fingerprint + does it match signing-fingerprint.txt
npm run signing:verify     # check any APK (default: the newest release in build-output/)
```

- The key (`oma-release.jks`) and its settings (`keystore.properties`, which holds the password) live in
  **`~/.rasoi-pulse/signing/oma/`**, outside every repository, readable only by you. They are never printed and never committed.
  Back up that **whole folder** (password manager or other safe storage). **Lost key = no phone can be updated again**; every
  phone must uninstall the app and sign in again.
- `npm run build:release` stops with a clear message if there is no key, and refuses (does not copy) an APK signed with the debug
  key or with a different key than `signing-fingerprint.txt`. Gradle gets the key through `OMA_KEYSTORE_PROPERTIES`; nothing secret
  is written into the generated `android/` folder (`plugins/with-release-signing.js` does the wiring).
- The key is found in this order: `OMA_KEYSTORE_PROPERTIES` (a path), then `keystore.properties` in this folder, then the default
  folder above. On another Mac, copy the backed-up folder to the same place.
- A throwaway test file with the debug key: `RP_ALLOW_DEBUG_SIGNING=1 npm run build:release` (named `…-release-DEBUGKEY.apk`;
  never upload it).
- A phone that has an app signed with another key (the debug builds, or anything before this key) cannot be updated to a
  release signed with this one: uninstall it once first. After that, every update installs over the previous one.

## Version management

The version is **`v-DDMMYY-NNN`**: the date, then a number for that day. The first version is **`v-261126-001`**.

- It lives in **one file**, `app-version.json`, and from there flows into the app (shown on the sign-in and account
  screens) and into Android (`versionName` = the version, `versionCode` = NNN).
- **It never changes on its own** — not when you build, test, fix a bug or add a feature. Only when the owner asks for an upgrade:

  ```bash
  npm run version:show                     # what it is now
  npm run version:bump -- --confirm        # new version: today's date, and NNN+1 if today already has one
  npm run version:check                    # part of `npm run check`: file and generated config agree
  ```

  Without `--confirm` the bump command refuses. Android's `versionCode` must only go up, so a number is never reused.

## Updates and the platform admin

- **Update check.** When the app opens (and when it returns to the front after 30 minutes away) it asks the server whether a newer
  build exists (`GET /api/app-updates/check?versionCode=<build>`, no sign-in). Code in `src/updates/` (`store.ts` = the logic,
  `UpdateGate.tsx` = the pop-up and the screen, `open.ts` = opening the download page in the phone's browser; only `http(s)`
  addresses are opened). An **optional** update is a pop-up with *Update* and *Later* ("Later" lasts until the app is opened
  next). A **required** update is a full-screen "Update needed" that holds the Back button and can't be closed.
  A phone that can't reach the server is never blocked by the check. Every request carries `x-oma-version-code`, and the server
  refuses an old build's sign-in with `426 update_required` while an update is required (that also shows the same screen).
  *Account → Check for updates* asks by hand.
- **Platform admin.** A platform admin signs in with no outlet chosen and is shown *Choose a store* → *Choose an outlet*
  (`src/screens/ChooseStoreScreen.tsx`) every time, even with one store and one outlet; *Account → Change store or outlet* goes
  back (unsent orders are cleared, and the app says so first). Nothing is remembered for them. Other staff go straight to their outlet.
- New server answers for the tests are recorded by `tests/e2e/suites/_record-staff-app-superadmin-update-fixtures.mjs`
  (it only adds its own fixture files; the older recorder renews every id).
- The version in the app does not change when an update feature is built: versions change only when the owner asks (see above).

## Tests

```bash
npm test                 # everything (jest, no Watchman needed)
npm run typecheck && npm run lint
```

- **Logic** (`__tests__/*.test.ts`): API client (timeouts, errors, 401 handling, response checking), session (sign-in, kept
  sign-in, wrong accounts), cart rules, menu and table helpers, money/time formatting, colour contrast, version tooling.
- **Screens and flows** (`__tests__/screens`, `__tests__/ui`): sign-in (wrong password, countdown after too many tries, kitchen
  account refused), tables board, table actions, taking an order from first tap to "sent", safe handling of a table someone
  else took, sold-out dishes, double taps, the orders list, sign-out, phone and tablet layouts.
- They run against **recorded real answers** of the API in `test/fixtures/` (re-record with
  `node tests/e2e/suites/_record-staff-app-fixtures.mjs` from the repository root, which runs a throwaway API), so a change in
  the server that the app does not understand fails a test.
- The server side of sign-in has its own saved test: `tests/e2e/tests/t87-staff-app-auth-api.mjs`.

Watchman on this Mac is broken (a Homebrew library mismatch), hence `--no-watchman` in the scripts; `brew reinstall watchman` fixes it.

## Sign-in and security

- The app **always asks for email and password when it starts.** The token is kept in memory only. "Keep me signed in" (off by
  default) stores the token in Android's encrypted storage (SecureStore) so the next start continues — after the server confirms it still counts.
- Only accounts that can **take orders and see tables** may use the app; a kitchen or accountant account gets a clear message and its new session is ended again.
- Wrong passwords are counted by the server (per phone address and per account); after too many, the sign-in screen shows a countdown.
- Move / payment / free / cancel buttons appear only for people with the table-management permission. The server checks everything again.
- Signing out (or the server ending the sign-in) removes everything remembered from the screens and any unsent orders.
- A release build refuses plain `http://` servers.

## The menu: loaded once, then only "what can't be ordered now?"

The whole menu is fetched **once**, right after signing in (and again only if the outlet is switched, on a manual refresh, or when
the server's menu *version* changes — a new price, dish or picture). Each time an order is started the app asks one small question,
`GET /api/menu/unavailable`: which dishes can't be ordered right now (switched off, counted stock at zero, outside their serving hours,
or a combo with a part that is out) — and which are running low. Those dishes are marked ("Sold out", "Available 8 AM – 11 AM",
"Only 3 left"); **a dish that is not in the answer can be ordered** — so one that was sold out earlier and is missing from the next
answer is back in stock. The answer is a few hundred bytes against the menu's tens of kilobytes. While the order screen stays open it
is asked again once a minute. Against an older server without that call the app falls back to loading the whole menu each time.

The menu list: the search box and filters stay pinned at the top; categories start **closed** (a menu of hundreds of dishes is a short
list) and open with a tap — searching opens every category with a match; each dish shows its picture (the square one, scaled to the row;
a placeholder when there is none or it can't be loaded) and a green / egg / red mark; the food-type switch has the same marks as icons.
Dish rows are memoised, so adding one dish redraws one row.

## Tables

The board groups tables under their **area** ("Ground floor", "Terrace"; tables with no area last). Areas start **closed** and show
what is going on inside (free / seated / bill-asking counts); opening or closing one is **remembered per person and per outlet** (in the
phone's ordinary preference storage, not the secure store) and applied when the app is opened again. A search or filter shows what it
found, open, without changing what is remembered. "Move table" shows free tables as tiles — "Table", the number, and "4 seats" written
out — under their area (the party's own area open; the others follow what the board keeps open).

## How an order is taken (and why it is safe)

1. Pick a table. A table that already has a party shows their bill and orders; a free table asks for the customer's mobile number at the review step — typing 3 or more digits lists customers with that number (tap one to fill the number and name), and a full 10-digit number that matches exactly one customer fills the empty name box by itself.
2. Find dishes (search, veg/egg/non-veg, category). Dishes with sizes or add-ons open a choice sheet; required choices block "Add".
3. Review: change quantities, add a note, see the **server's** price (taxes, service charge, round-off). A dish that sold out meanwhile is named and blocks sending.
4. Send. The order carries *which party the waiter saw at that table*. If somebody else was seated meanwhile, the server refuses it and the app **stops** — it never adds the order to a stranger's bill. The order stays on the phone to resend or discard.

## Pop-ups and the keyboard

Pop-ups (dish choices, the order review, categories, move table) lift above the keyboard, and the lift is **checked**: after the
keyboard opens, the panel's real position is measured and raised by whatever is still hidden (Android versions and phones differ in
whether a pop-up's window is resized). A box being typed in is scrolled into view; Send stays pinned under the scrolling part.

## Phone and tablet

One layout rule decides everything (`src/lib/layout.ts`): **phone** (< 600 dp) one panel at a time; **tablet** (600–839 dp)
roomier grids and two-column menus; **wide** (≥ 840 dp) a split view — tables on the left with the chosen table on the right,
the order beside the menu — and the tab bar moves to the left edge. Portrait and landscape both work.

## Flows that mirror the storefront and dashboard

If one of these changes in the storefront or dashboard, **ask the owner whether the app should follow** before touching the app:

- Taking an order for a table: dish choices (sizes, add-ons, required/optional rules), notes, customer phone rule, sold-out handling, pricing shown to the waiter.
- Table states and what each action does (move, confirm payment, free, cancel / void).
- Order status names and what they mean.
- Who may use the app and which permissions gate which button.
- Sign-in and blocking rules.

## Project layout

```
app.config.ts        the app's configuration (name, package, Android 11+, plugins) — reads app-version.json
app-version.json     THE version
plugins/             with-fast-gradle.js
scripts/             version.js (show/bump/check), build-android.js
src/app/             screens' routes (Expo Router): sign-in, (app)/(tabs) tables · orders · account, table/[id], take-order/[tableId]
src/screens/         the screens themselves (testable without the router)
src/ui/              the component kit: buttons, text fields, dropdown, bottom sheet, dialogs, toasts, loaders, progress bars, skeletons…
src/api/             API client, endpoint list, response schemas (zod)
src/auth/            session store, secure storage, permissions
src/cart/ features/  order drafts, menu/table/order rules (plain functions)
src/data/            server-data hooks (menu once + unavailable list, board polling, customer search)
src/prefs/           small remembered preferences (which table areas are open), AsyncStorage
src/lib/             layout rules, money/time, picture addresses (images.ts), debounce
test/                fixtures (recorded API answers) and the test harness
```

The UI kit takes its ideas from [uitimate](https://github.com/its-tim-lee/uitimate) (a web/React library): the components are
written natively for React Native, not copied.
