# Mobile apps

One folder per app. Each is its own project (its own `package.json`, installed with **npm**, outside the pnpm workspace of
the web apps) and talks to the same API as the dashboard and storefront.

| Folder | App | For | Platform |
| --- | --- | --- | --- |
| [`oma/`](oma/README.md) | **Rasoi Pulse OMA** — Order Management App | Staff who take orders at the tables | Android 11+ (phones and tablets) |
| [`kda/`](kda/README.md) | **Rasoi Pulse KDA** — Kitchen Display App | Kitchen staff and the kitchen manager: the order board, the prep list, sold-out switches | Android 11+ (phones and tablets) |

## Naming

Display name: `{our app name} {ROLE CODE}`, e.g. **Rasoi Pulse OMA** (OMA = Order Management App), **Rasoi Pulse KDA** (KDA =
Kitchen Display App). Folder: the role code in lower case (`oma`, `kda`). Android package: `com.rasoipulse.<code>`. The code is also
the app's id on the server (`x-app-id`, the console's App updates tabs, the website page `/apps/<code>`).

## Rules every app follows

1. **Sign in at every start** (server-side rate limiting and blocking apply). Keeping a sign-in is an opt-in.
2. **Version `v-YY.MM.DD-NNN`** (year, month, day, then the build number; each app counts its own builds), changed only when the owner asks for an upgrade.
   One **company signing key** signs every app (`~/.rasoi-pulse/signing/oma/`): back it up once.
3. **Flow parity**: a changed storefront/dashboard flow is raised with the owner before the app copies it.
4. **The server decides.** Prices, taxes, permissions and limits come from the API; an app only shows them and hides buttons the person cannot use.
5. **Tests ship with the app** — logic and screens run against recorded real API answers (`test/fixtures`).
6. **One README for the whole project**: the root [`README.md`](../README.md). App READMEs only say how to run and build that app.

## Adding another app

Create `mobile-apps/<code>/`, give it its own README, add a row to the table above and to the root README's "Mobile apps"
table, add it to `APP_CATALOG` in `packages/config-schema/src/app-release.js` (the console tab, the website page and the version
checks all follow that one list), and — if it is for one kind of person — to `APP_REQUIRED_PERMISSION` (the server then refuses everyone else's sign-in). Copy what you need from `oma/` (API client + schemas, session handling, UI kit, test harness); nothing is shared
through a package yet — when a second app needs the same code, move it into a shared folder then, not before.
