# Rasoi Pulse KDA — Kitchen Display App

An Android app (phones **and** tablets, Android 11 or newer) for the people who **cook**: a live order board, a prep list,
and one-tap "sold out / unavailable / available" for every dish. It is the kitchen-side twin of the dashboard's **Kitchen
display** and uses the same API (`/api/kitchen/…`); nothing about orders is decided in the app.

> The whole project is described in the root [`README.md`](../../README.md) (see "Kitchen app (KDA)" there for the roles, the
> rules and the API). This file only says how to **run, build, version and test this app**.

## What is in it

| Tab | For | What it does |
| --- | --- | --- |
| **Board** | everyone | New · Preparing · Ready lanes (side by side on a tablet, one at a time on a phone). Each ticket shows the table / takeaway / delivery, every dish with size, add-ons and note, the customer's note, and ONE button: **Start**, **Mark ready**, **Recall** (a recall asks first). All / Kitchen / Bar switch. Amber then red as an order waits (the store's own minutes). A new order vibrates and says which |
| **Prep** | everyone | What to cook right now, added up over every order that isn't ready (same dish + size + add-ons = one line) |
| **Dishes** | everyone (switching needs `menu:availability`) | Every dish by category with search and filters. **Sold out** / **Put back** on the row, or open the dish for **Available / Sold out / Unavailable**. The kitchen manager can also set "left today" on counted dishes |
| **Today** | kitchen manager (and owners) only | Orders on the board now, orders made today, average time, late orders, the slowest, the dishes made most |
| **Account** | everyone | Who you are and what you may do, which outlet, the new-order alert and keep-the-screen-on switches, version, update check, sign out |

Who may sign in is decided by **the server** (`kitchen:app` permission): kitchen staff, kitchen managers, owners and the platform
admin. A waiter, accountant or editor is turned away with a sentence; the app also checks, for an older server.

## What you need

Same as the staff app: Node 20.9+, JDK 17, the Android SDK (no Android Studio, no Expo account). See
[`../oma/README.md`](../oma/README.md#what-you-need) for the one-time setup.

```bash
cd mobile-apps/kda
npm install
npm run check          # type check + lint + all tests + version check
```

## See it live on your phone

```bash
node tests/e2e/bench/bench.mjs up   # from the repository root: the throwaway TEST server (fake restaurant, fake data)
cd mobile-apps/kda
npm run phone                       # the code server, pointed at the test server on this Mac, with a QR code
```

Open **Expo Go** (or a debug build of the app) and sign in with a test account of the bench:

| Account | Role | Sees |
| --- | --- | --- |
| `k@acme.test` / `Kitchen123!` | kitchen staff | Board, Prep, Dishes (can switch dishes), Account |
| `m@acme.test` / `Manager123!` | kitchen manager | the same + **Today** + "left today" on counted dishes |
| `s@acme.test` / `Staff1234!` | cashier | turned away: "for the kitchen team" |

`npm run phone:usb` is the same through a USB cable; `npm run phone:live` talks to the live server. The kitchen display is a
plan feature (`kitchenDisplay`): a store whose plan lacks it gets the server's "not in your plan" sentence on the board.

## Build an APK

```bash
npm run build:debug      # a test build, loads its code from `npm start`
npm run build:release    # the code is inside the app (for handing to the kitchen)
```

The APK lands in `build-output/rasoi-pulse-kda-<version>-<mode>.apk`. The native `android/` folder is generated from
`app.config.ts` (git-ignored, never edit it). Debug and release builds use their own app id, **`com.rasoipulse.kda`**, so the
kitchen app installs **beside** the staff app (`com.rasoipulse.oma`).

### Release signing (one company key)

The Rasoi Pulse apps are signed with **one key** (Android allows that): the one made for the staff app, in
`~/.rasoi-pulse/signing/oma/`. `signing-fingerprint.txt` here is the same fingerprint as in `mobile-apps/oma`, and a test checks
that. `npm run signing:show` says where the key is and whether it matches; `npm run signing:verify` checks an APK;
`npm run signing:create` never makes a second key (it says where the existing one is, or sends you to `mobile-apps/oma` if there is none yet).
One backup of that folder covers both apps. A lost key means every phone must uninstall the apps first.

## Version management

`v-YY.MM.DD-NNN` (year, month, day, build), in `app-version.json`: the first version is **`v-26.11.27-001`** (all three apps were reset to this initial version on 2026-11-27, before the first release). It changes **only when
the owner asks for an upgrade** (`npm run version:bump -- --confirm`). The build number counts this app's own builds, and is
the Android `versionCode`. To publish a build: console → **App Management** → the **KDA** tab → *New version*.

## Updates

On opening, the app asks `GET /api/app-updates/check?app=kda&platform=android&versionCode=<build>` (no sign-in). An optional
update is a pop-up (*Update* opens `/apps/kda` in the phone's browser; *Later*); a required one is a full screen nobody gets past.
Every request carries `x-app-id: kda` and `x-app-version-code`; an old build's sign-in is refused with `426` while an update is required.

## Tests

```bash
npm test            # jest: logic, screens, the API client, the recorded server answers, the update gate, signing, versions
```

They run against **recorded real API answers** in `test/fixtures`. To record them again (when a kitchen endpoint changes):

```bash
node tests/e2e/suites/_record-kitchen-app-fixtures.mjs     # from the repository root: a throwaway API, no real data
```

The server side of the app (roles, the dish switch, the summary, "nothing else changed") is tested by
`tests/e2e/suites/kitchen-app-api.mjs` (t97).

## Project layout

```
src/app/            routes (Expo Router): sign-in, choose (platform admin), (app)/(tabs): Board, Prep, Dishes, Today, Account
src/screens/        BoardScreen, TicketCard, PrepScreen, DishesScreen, TodayScreen, AccountScreen, SignInScreen, ChooseStoreScreen
src/features/       plain logic the screens draw: board.ts (lanes, urgency, prep list), dishes.ts (filters, states)
src/data/           the server's answers kept in memory and refreshed (TanStack Query): board every 5 s, dishes 15 s, summary 30 s
src/api/            the client, the endpoints and the schemas (an answer the app doesn't understand is a clear error, not a broken screen)
src/auth/           the sign-in (token in memory unless "Keep me signed in"), and what each role may do
src/updates/        the update check, pop-up and required screen
src/ui/             the small component kit (buttons, sheets, chips, badges, toasts…), themed light/dark
```
