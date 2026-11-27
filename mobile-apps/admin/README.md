# Rasoi Pulse Admin

An Android app (phones **and** tablets, Android 11 or newer) for the **Rasoi Pulse team**: the owner (super admin) and the people who
work under them (sales, support …). It is the app version of the platform console and uses the same API (`/api/platform/…`).
It is **not** for restaurants or customers, and it is **not** on the website or in the apps catalog (no update channel: you install the APK yourself).

> The whole project is described in the root [`README.md`](../../README.md) (see "Platform team and roles" and "Admin app" there). This file
> only says how to **run, build, version and test this app**.

## What is in it

Each person sees **only the areas their role holds** (the owner sees all); the server refuses everything else anyway.

| Area | What it does |
| --- | --- |
| **Dashboard** | **Rasoi Pulse business** first: what the shops pay you — total sales, new sales, re-subscribed, who ran out, one chart that switches Day / Week / Month against the period before. Below it, under "Across every store": sales this month against last month (touch and drag to read a day), totals, month-by-month, top stores, where orders come from |
| **Stores** | Every client: search, filter, plan, standing. Open one to rename it, change its plan, switch it off or on, block an outlet or a person, delete it, and see / write down its **subscription payments** (each only if the role may) |
| **Onboarding** | Requirement forms for new clients: plan first, outlets, features (with "allow anyway" beyond the plan), save as a draft, the server's "ready?" check, **Publish as store** |
| **Plans** | What each plan includes: limits, price, features, how many stores use it (read only) |
| **Leads** | Website enquiries: call, WhatsApp, email, mark contacted / won / lost, notes |
| **Server** | A 0–10 health score with the reasons, processor, memory, disks, network, the API (refreshes itself) |
| **Security** | Blocked and watched networks, unblock one or all, how the guard works |
| **Cache** | What the API remembers, its lifetime, expire everything or one store |
| **Settings** | Grace days and the live-updates switch |
| **Team & roles** | The owner only: roles, people, their activity |

Still on the web console only: the website editor, storage, AI picture keys, the plan editor (the app only reads plans), App Management, the PDF / print of an onboarding form,
and the look-and-feel of a form (it is kept untouched when the app saves).

## What you need

Node 20.9+, JDK 17, the Android SDK (no Android Studio, no Expo account). See [`../oma/README.md`](../oma/README.md#what-you-need) for the one-time setup.

```bash
cd mobile-apps/admin
npm install
npm run check          # type check + lint + all tests + version check
```

## See it live on your phone

```bash
node tests/e2e/bench/bench.mjs up   # from the repository root: the throwaway TEST server (fake data)
cd mobile-apps/admin
npm run phone                       # the code server, pointed at the test server on this Mac, with a QR code
```

**Restart it after changing `app.config.ts` or adding a package.** Expo reads the config only when the code server starts, and Expo Go keeps what it was told: a change that "does nothing" on the phone (the light/dark setting did exactly this) is usually a code server that is still running from before. Press Ctrl+C, start `npm run phone` again, and on Android swipe the project away in Expo Go before opening it again. JS changes need none of this (they reload by themselves).

`npm run phone:usb` is the same through a USB cable; `npm run phone:live` talks to the live server. Sign in with a platform account
(the bench's super admin, or a team member made in Console → Team & roles). A restaurant owner's account is turned away with a sentence.

## Build an APK

```bash
npm run build:debug      # a test build, loads its code from `npm start`
npm run build:release    # the code is inside the app
```

The APK lands in `build-output/rasoi-pulse-admin-<version>-<mode>.apk`. The native `android/` folder is generated from `app.config.ts`
(git-ignored, never edit it). The app id is **`com.rasoipulse.admin`**, so it installs beside the other Rasoi Pulse apps. Release builds are
signed with the same company key as the other apps (`~/.rasoi-pulse/signing/oma/`); `npm run signing:show` says where it is.

## Version management

`v-YY.MM.DD-NNN` in `app-version.json`; it changes **only when the owner asks for an upgrade** (`npm run version:bump -- --confirm`).

## Tests

```bash
npm test            # jest: the access rules (compared with the server's list), the API client, every screen against a fake server
```

The server side (roles, the API gate, the app's sign-in) is tested by t121 and t122 in `tests/e2e`.

## Project layout

```
src/app/            routes (Expo Router): sign-in, (app)/[area], (app)/stores/[id], (app)/onboarding/[id]
src/screens/        Dashboard, Stores, StoreDetail, Onboarding, OnboardingForm, Leads, Server, Security, Cache, Settings, Team, More
src/ui/             the glass kit: Background (the one scenery everything blurs), Glass, Frost, charts, sheets, dropdown, date picker, nav
src/api/            the client and the endpoints (what the API answers, only the parts the app uses)
src/lib/            access (areas by role), onboarding rules, formats, password maker
```
