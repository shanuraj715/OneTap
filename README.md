# Rasoi Pulse

Multi-tenant restaurant ordering platform. One codebase serves many restaurants: each **store** gets its own
storefront, team dashboard, menu, orders and look — switched on and limited by the **plan** it is on.

- **Diners** order takeaway, delivery or dine-in (scanning the QR on their table) from the store's storefront.
- **The restaurant's team** runs the day from the store dashboard: orders, menu, tables, printing, customers,
  analytics, marketing and WhatsApp chat.
- **The Rasoi Pulse operator** (platform super admin) creates stores, sets plans and limits, and manages the platform and
  the marketing website from the **platform console**.

## What's in the repo

| Part | Tech | Dev port |
| --- | --- | --- |
| `apps/storefront` | Next.js (App Router) — the customer site: menu, checkout, account, table ordering | **3070** |
| `apps/admin` | React + Vite SPA — the store dashboard **and** the platform console | **3071** |
| `apps/api` | Node + Express (JavaScript, ESM) + MongoDB — the one API behind everything | **3072** |
| `apps/website` | Next.js — the Rasoi Pulse marketing website, edited from the platform console | **3073** |
| `packages/config-schema` | Zod schemas and shared rules (store config, plans, pricing, menu, orders…) | — |
| `packages/db` | Mongoose models, the tenant-scoping plugin, the write-event hooks | — |
| `packages/ui` | Shared components (headers, cards, menu sections, pinned bars…) and design tokens | — |
| `mobile-apps/` | Phone and tablet apps (React Native). One folder per app — today **Rasoi Pulse OMA** (Order Management App, for staff who take orders at the table) **Rasoi Pulse KDA** (Kitchen Display App, for the kitchen) and **Rasoi Pulse RDA** (Rider Delivery App, for delivery riders). **Not** part of the pnpm workspace: each app has its own `package.json` and uses npm — see [Mobile apps](#mobile-apps) | — |
| `tests/e2e` | The end-to-end test library and its throwaway test bench — see [Tests](#tests) | 3097 / 3171 / 3170 |
| `deploy/`, `docs/` | Server and operations notes — see [More documentation](#more-documentation) | — |

## Prerequisites

- Node ≥ 20.9 (24 recommended — see `.nvmrc`)
- pnpm (`npm i -g pnpm`)
- MongoDB — any one of:
  - `pnpm db:local` — a zero-install local MongoDB (downloads a `mongod` binary on first run, data kept in
    `apps/api/.local-db/`); leave it running in its own terminal;
  - a local MongoDB install;
  - a **MongoDB Atlas** connection string in `apps/api/.env` (use a dedicated dev database, never a shared cluster).

  The API starts without a database — endpoints that need one report `db: disconnected`.

## Getting started

```bash
pnpm install

# copy the env templates (every value has a working local default)
cp apps/api/.env.example apps/api/.env
cp apps/storefront/.env.example apps/storefront/.env.local
cp apps/admin/.env.example apps/admin/.env
cp apps/website/.env.example apps/website/.env.local     # optional

pnpm db:local       # (if you have no MongoDB) in a separate terminal
pnpm dev            # starts storefront, admin, API and website via Turborepo
pnpm seed           # once, with MongoDB connected: creates the platform super admin
```

`pnpm seed` prints the super admin's generated password — **shown only that once**. Then:

- Storefront → http://localhost:3070
- Dashboard + platform console → http://localhost:3071
- API health → http://localhost:3072/health
- Marketing website → http://localhost:3073

Sign in to the admin with the super admin account. From the **platform console** create a plan, then a store (its
first outlet and owner login are created with it); the owner signs in at the same address and gets the store
dashboard. Individual apps: `pnpm dev:api`, `pnpm dev:storefront`, `pnpm dev:admin`, `pnpm dev:website`.
`pnpm kill` frees ports 3070–3073.

Optional starter data (all editable afterwards in the console; each is safe to run twice):

```bash
cd apps/api
node src/scripts/seed-plans.js      # example plans (Basic, Pro, Custom) — assigned to no store
node src/scripts/seed-website.js    # the marketing website's starter pages and settings
```

Other helpers in `apps/api/src/scripts/`: `reset-superadmin-password.js` (the only way back in if the super admin's
password is lost), `route-inventory.js` (every API route with its limits), `normalize-upload-urls.js` and
`migrate-brand-appearance.js` (one-off data tidy-ups; read the header of each before running).

## Mobile apps

Every phone/tablet app lives in its own folder under [`mobile-apps/`](mobile-apps/README.md) and is named
**"Rasoi Pulse &lt;ROLE&gt;"** with the role's short code (OMA = Order Management App, KDA = Kitchen Display App, RDA = Rider Delivery App). They talk to the same API as the
dashboard and the storefront; nothing in them is a second copy of the business rules — the server decides every price,
permission and limit.

| App | For | Platform | Folder |
| --- | --- | --- | --- |
| **Rasoi Pulse OMA** | Staff who walk to tables: take orders, manage tables (move, confirm payment, free, cancel), watch orders | Android 11+ phones and tablets | [`mobile-apps/oma`](mobile-apps/oma/README.md) |
| **Rasoi Pulse KDA** | Kitchen staff and the kitchen manager: the live order board, the prep list, sold-out / unavailable / available for every dish | Android 11+ phones and tablets | [`mobile-apps/kda`](mobile-apps/kda/README.md) |
| **Rasoi Pulse RDA** | Delivery riders: the deliveries handed to them, directions in their own maps app, call / WhatsApp the customer, picked up and delivered (with the customer's 4-digit code) | Android 11+ phones | [`mobile-apps/rda`](mobile-apps/rda/README.md) |
| **Rasoi Pulse Admin** | The Rasoi Pulse team only (the owner and the roles under them): dashboard, stores, onboarding, leads, server, security, cache, settings, team — each person sees only what their role holds. **Not on the website, not in the apps catalog** | Android 11+ phones and tablets | [`mobile-apps/admin`](mobile-apps/admin/README.md) |

Rules for the apps (decided with the owner):

- **Sign-in at every start.** An app asks for email and password each time it opens (the API rate-limits and blocks
  repeated wrong tries — the same guard as the dashboard). "Keep me signed in" is an opt-in on the sign-in screen.
- **Versions look like `v-YY.MM.DD-NNN`** (year, month, day, then the build number — e.g. `v-26.11.27-003`; each app counts its own builds, and the number is Android's `versionCode`; the first OMA versions were made in the old form `v-DDMMYY-NNN`, e.g. `v-261126-001`, which is still read) and
  change **only when the owner asks for an upgrade** — building, testing and fixing never change it. See
  [`mobile-apps/oma/README.md`](mobile-apps/oma/README.md#version-management).
- **Flow parity needs a yes.** When a flow in the storefront (or dashboard) changes and the same flow exists in an app,
  the app is **not** changed silently: the change is raised with the owner first, and made in the app only after they confirm.
- **One README for the whole project** — this file. App folders have a short README of their own for how to run and
  build that app; anything about the product as a whole goes here.

### App Management (was "App updates"): uploading a version, optional vs. required

The apps are not on the Play Store. New versions are uploaded in the platform console and downloaded from the website. **Every app has its own releases, its own build numbers and its own download page**; the one list of apps is `APP_CATALOG` in `packages/config-schema/src/app-release.js` (today `oma`, `kda` and `rda`), and the console, the website and the checks all follow it:

- **Console → App Management** (`/platform/app-management`; the old `/platform/app-updates` redirects; platform admin only): one **tab per app** (OMA · KDA · RDA), each with its own list; *New version* picks the `.apk`, fills the
  version from its file name (`…-v-26.11.27-003.apk`), takes release notes, and sends the file up in 4 MB pieces with a
  progress bar (so no larger request limit is needed in nginx/Cloudflare, and a dropped connection retries by itself).
  Each version is a **draft**, **published** or **withdrawn**; **Required** makes it compulsory. Uploads are checked: it must
  be a real APK (a zip with an `AndroidManifest.xml`), under `APP_RELEASE_MAX_MB`, with a version `v-YY.MM.DD-NNN` (the old `v-DDMMYY-NNN` is refused for a new upload) whose
  build number (`NNN`) is not used yet. The file's size and SHA-256 are recorded.
- **Website → `/apps`** (all apps) and **`/apps/<app>`** (`/apps/oma`, `/apps/kda`, `/apps/rda`: one page per app — latest version button, release notes, install steps, every version with
  its SHA-256). The old `/app` redirects (permanently) to `/apps/oma`, because OMA builds already installed send people there. It follows the console within seconds (the API tells the website to refresh) and is not indexed by search engines.
- **In the app**, when it opens (and when it comes back to the front after 30 minutes away) it asks
  `GET /api/app-updates/check?app=<its id>&platform=android&versionCode=<its build>` (and says which app it is in the `x-app-id` header of every request; no header = OMA). A newer **optional** version shows a pop-up with *Update* (opens its `/apps/<app>`
  page in the phone's browser) and *Later*. If **any** version newer than the phone's is marked **Required**, the app
  shows a full "Update needed" screen instead, with no way past it (Back does nothing) until the new version is installed.
  The server backs this up: while an update is required, `POST /api/auth/app-login` from an old build answers
  `426 update_required` (before any password is checked), so an old build can't get in even if it skipped the check.
  A phone that can't reach the server is never blocked by the check itself.
- **Where the APK files are kept:** in the **same storage as every other file**, the one chosen in console → **Storage** (this
  server's disk, or the S3/R2 bucket). A finished upload is streamed there (never held in memory) under
  `app-releases/<app>/<version>-<random>.apk`; the **Move files** tool carries them along when the storage is changed. They are
  downloaded through the API (so withdrawing a version stops it at once, and the bucket needs no public access for them).
  `APP_RELEASES_DIR` is only scratch space for uploads in progress. If the storage refuses the file (wrong keys, bucket down),
  finishing the upload says so and the pieces are kept, so after fixing Storage the same upload can be finished without sending
  it again. Settings: `APP_RELEASES_DIR`, `APP_RELEASE_MAX_MB` (default 300), and `WEBSITE_URL` (the address of the `/apps/<app>` pages the apps send people to).
  Public endpoints: `GET /api/app-updates/check`, `/releases`, `/download/:id` (resumable, rate-limited, never cached).
  The test for all of this is t93 (API), t94 (console page) and t95 (website page).
- **Signing:** every update must be signed with the **same key** as the version it replaces, or Android refuses to install it
  over the old one. The release key is made once with `npm run signing:create` (in `mobile-apps/oma`) and lives in
  `~/.rasoi-pulse/signing/oma/` — outside the repo, never committed; **back that folder up, a lost key means every phone must
  uninstall the app**. **One company key signs every app** (OMA and KDA; Android allows it): its public fingerprint is committed in each app as `signing-fingerprint.txt` (a test checks they are the same), and `npm run build:release`
  refuses to produce an APK signed with anything else. How it works and the commands: [`mobile-apps/oma/README.md`](mobile-apps/oma/README.md#release-signing-the-key).
- **Platform admin in the app:** a platform admin who signs in to OMA is asked *which store, then which outlet* every time
  (even if there is only one); *Account → Change store or outlet* goes back. Everyone else goes straight to their own outlet.

The API side of the apps: `GET /api/menu/unavailable` (what can't be ordered now — the staff app loads the menu once and asks only this each order), a `version` in the menu answer, team members can be **mapped to outlets** (Users & roles; they then see only those outlets, in the dashboard and the app), and putting a Completed order back to Preparing **seats its table again** (or asks which free table when someone else has it). Also `POST /api/auth/app-login` (returns a token the app sends as `Authorization: Bearer …`;
the dashboard keeps using its cookie), `GET /api/auth/guard` (is this address paused?) and the Bearer support in the
`authenticate` middleware. Saved test: `tests/e2e/tests/t87-staff-app-auth-api.mjs`.

### Live connection for the staff apps (OMA, KDA, RDA)

The apps no longer ask the server every few seconds. Each keeps ONE WebSocket open to `wss://<api>/realtime` and asks for new data only when the server says
something changed. **The server's side** (`apps/api/src/realtime/hub.js` + `app-feed.js`):

- **Connecting:** `GET /realtime?app=oma|kda&outletId=<id>` with `Authorization: Bearer <the app's sign-in>` (RDA: `?app=rda` with the rider's own token — the token knows the outlet).
  The SAME checks as the app's ordinary calls run on the upgrade (`requireOutletContext`: signed in, role — OMA needs `order:read`, KDA `kitchen:app` —, the outlets the person is
  mapped to, a paused membership, a switched-off store; for a rider `riderFromToken`: still on the list, switched on, PIN not reset, Delivery in the plan). Refusals are plain
  HTTP answers: 400 (bad app / no outlet), 401, 403, 404, 429 (too many connects from one address), 503 (the platform switched live updates off). The dashboard's own connection
  (session cookie, no `app`) is unchanged.
- **What an app is sent** — never data. Only `{type:"hello"}` once, `{type:"changed", what:["orders"|"tables"|"menu"|"deliveries", …], at}` and `{type:"tick"}` every 20 s
  (so an app can tell a quiet restaurant from a dead line). OMA hears orders · tables · menu, KDA orders · menu, RDA deliveries. The app then fetches the new data through its normal
  (permission-checked) calls. Changes within 250 ms are one message.
- **What triggers it:** the database layer announces every write to `Order`, `Table`, `TableSession`, `MenuItem`/`MenuCategory`/`ModifierGroup` and `Rider` (`packages/db/src/write-events.js`),
  whichever code made it — so a storefront order, a waiter's tap, a webhook, a background sweep and the dashboard all reach the apps without anyone remembering to say so. A dish going out of its
  serving hours is not a write: a 30-second watcher compares the "can't be ordered now" list of each outlet that has an app listening with the last one.
- **Letting go:** every 5 minutes (and at once for a rider whose record changes) each app connection is re-checked — sign out, a switched-off person, a paused store, a reset rider PIN end it
  (close codes 4401 signed out · 4403 store off · 4410 the platform switched live updates off). Test: t120.

**The apps' side** (each app has its own copy of `src/live/`: `connection.ts`, `store.ts`, `refresher.ts`, `LiveBridge.tsx`, `LiveBanner.tsx`; the logic is plain TypeScript with its own tests):

- **`LiveBridge`** (mounted once in the root layout, draws nothing) keeps ONE connection while a person is signed in (OMA/KDA: to their outlet; RDA: as the rider). The sign-in travels in the
  `Authorization` header (React Native's WebSocket accepts headers) — never in the address, so it can't end up in a log.
- **Reconnecting by itself:** when the line drops the app tries again after 1 s, 2 s, 4 s … never more than 30 s (a little random, so a restaurant's tablets don't all knock at once after the
  server restarts). A connection that has said nothing for 55 s is dead (the server ticks every 20 s) and is replaced. When the app comes back to the front or the internet returns, it
  reconnects at once. **Every time it is (re)connected the app loads everything once**, so nothing that changed during a gap is missed.
- **"Reconnecting…" loader:** `LiveBanner` shows a spinner and "Reconnecting… Showing the last information" at the top while the connection is coming back (after a 1.2 s grace, so a blink doesn't
  flash it; it never blocks a touch).
- **No timers while live:** the lists (`useRefreshPlan` in each app's `runtime.tsx`) don't poll while the connection is up or coming back. A burst of changes is one catch-up request per kind per second
  (`refresher.ts`). **Fallback:** if the server REFUSES live updates (the platform switched them off, an older server without the app address, "not allowed", too many connects) the lists ask on their old
  timer again, and the app quietly tries again every minute — an old API never breaks a new app, a new API never breaks an old app (old builds keep polling and ignore the socket).
- **Sign-in and start-up screens show the app's real icon** (`assets/icon.png`, the same artwork as the launcher icon) instead of a drawn symbol.
- **Tests:** each app's jest suite — `__tests__/live/*` (connection rules, refresher, polling switch) and `__tests__/screens/live.test.tsx` (the whole thing on screen with a fake WebSocket).

### How often the apps ask for new data (refresh interval, per app)

- **Since the live connection (above) this number is the FALLBACK:** an app that has a live connection never asks on a timer; the interval applies only while there is no live connection (an old server, the platform switched live updates off, the server refused); otherwise it is how often the lists ask.
- **One number per app**, in seconds, **default 8**, allowed **3 to 600**. The platform admin sets it in the console: **App Management → the app's tab → Refresh interval**. The delivery app (RDA) set to 15 asks the server for new deliveries every 15 seconds; OMA and KDA have their own numbers.
- **How the app learns it:** every request an app makes carries `x-app-id`, and the API (`middleware/app-refresh.js`) adds `x-refresh-seconds: <n>` to **every answer** to it (errors too). The app keeps the last number it saw (`src/data/refresh.ts`; bad or out-of-range values are ignored) and uses it for its next refresh, so a change reaches a phone with its very next request — no new version to install. Until the first answer, an app uses 8. The server keeps the numbers in memory for 15 seconds (cleared at once on save).
- **What it covers** (`refreshPlan` in each app's `src/lib/config.ts`): OMA — the table board and the orders list; KDA — the kitchen board; RDA — the list of deliveries. Slower background lists keep their own pace but never refresh faster than the setting (KDA dishes 15 s and today's numbers 30 s, OMA "can't be ordered" 60 s).
- **Old builds:** an app version made before this setting keeps its old fixed pace (OMA 8/10 s, KDA 5/15/30 s, RDA 10 s) until it is updated; it simply ignores the header.
- **Data:** one document per app in `appsettings` (`AppSettingModel`); an app with none uses the default. API: `GET /api/platform/app-releases/settings`, `PUT /api/platform/app-releases/settings/:app` (super admin).
- **Tests:** t104 (API), t105 (console), and in each app's jest suite `__tests__/refresh.test.ts` (limits equal the server's), the client reading the header, and a screen that really waits 15 / 20 seconds when told to.

### Kitchen app (KDA): who may sign in, what each role does

**Rasoi Pulse KDA** is the kitchen's twin of the dashboard's Kitchen display. Its screens: **Board** (New · Preparing · Ready,
All / Kitchen / Bar, Start · Mark ready · Recall, amber/red as an order waits, a vibration for a new order), **Prep** (what to cook
right now, added up), **Dishes** (find a dish; mark it **Available / Sold out / Unavailable**) and, for the manager, **Today**.
It reuses the existing kitchen API unchanged and adds a few endpoints; the other apps and the dashboard behave exactly as before.

| Who | Role | Can sign in to KDA | Switch a dish | Stock numbers + **Today** tab |
| --- | --- | --- | --- | --- |
| Kitchen staff | `kitchen` | yes | yes | no |
| Kitchen manager | `manager` | yes | yes | yes |
| Owner, platform admin | `owner`, `super_admin` | yes | yes | yes |
| Waiter / cashier, accountant, editor | `staff`, `accountant`, `editor` | **no** — `403 app_not_allowed`, in words | — | — |

- **The server decides.** Two new permissions in `packages/config-schema/src/rbac.js`: **`kitchen:app`** (may use the kitchen app) and
  **`menu:availability`** (may switch a dish); `menu:update` (already the manager's) gates the stock numbers and the Today tab.
  `APP_REQUIRED_PERMISSION = { kda: "kitchen:app" }` makes `POST /api/auth/app-login` refuse anyone else **and end the session it just
  opened**; OMA has no such rule, so nothing changed for it. Custom roles can be given `kitchen:app` in *Users & roles*.
- **Three dish states, one switch.** *Available*, *Sold out* (finished for now) and *Unavailable* (can't be made) all use the dish's existing
  on/off switch, so the storefront, the waiters' app and the dashboard obey them at once; the extra `offReason` only remembers which of the
  two the kitchen meant, and the dashboard's own switch clears it. A **counted** dish (stock) with none left is sold out by itself: putting
  it back needs a number, which only the manager can give (`menu:update`).
- **API:** `GET /api/kitchen/orders` and `POST /api/kitchen/orders/:id/stage` (the board, unchanged), **`GET /api/kitchen/items`**,
  **`POST /api/kitchen/items/:id/availability`** (`{ state, left? }`), **`GET /api/kitchen/summary`** (orders now / made today / average
  time / late / slowest / most-made dishes). All need the plan feature **Kitchen display** (`kitchenDisplay`) — a store's real plan must have
  it ticked, like every plan feature.
- **Tests:** the server side is t97 (`tests/e2e/tests/t97-kitchen-app-api.mjs`); the app has its own jest suite (`npm test` in
  `mobile-apps/kda`) that runs against answers recorded from the real API by `tests/e2e/suites/_record-kitchen-app-fixtures.mjs`.
- **App icon:** the same hat-and-heartbeat artwork on a teal tile with **KDA** under it; made by `brand/rasoi-pulse/build.mjs`. **Each app has one colour** — OMA indigo `#404DB6`, KDA teal `#0D7F6B`, RDA violet `#764ED1` — used for its icon tile, its in-app theme (light and dark) and its page on the website (see `brand/rasoi-pulse/README.md`).

### Delivery: the map pin, the delivery code, and the Rider app (RDA)

**Ordering for delivery (storefront).** Choosing Delivery draws a **free map** (Leaflet + OpenStreetMap, no key — see [`docs/free-maps.md`](docs/free-maps.md))
headed *Choose your location on the map — Required*. **The pin is fixed in the middle of the map and the customer moves the map under it**: one finger
drags, two fingers pinch to zoom (the +/− buttons, a double tap, and Ctrl + scroll / a trackpad pinch also zoom; a plain scroll still scrolls the
page); a click does not place anything. The restaurant and its delivery ring are drawn. The OpenStreetMap credit is shown very small (9 px on a phone).
**Where the map starts:** (1) the place the customer **last had food delivered from this outlet** (saved by the server when they order, with the whole address
they typed — text and landmark — and filled back in), else (2) their phone's location **if they have already allowed it** (we never pop the question up;
*Use my current location* asks), else (3) the restaurant. In (1) and (2) the place counts as chosen at once; in (3) it only counts once they move the map.
**No chosen place, no order**: the order button reads *Choose location on the map* and a typed address alone does not unlock it (the server also refuses a
delivery order with no coordinates, 400). The **distance is measured from that pin** to the restaurant (a straight line, `POST /api/delivery/check`,
recomputed by the server when the order is placed); the delivery area, charge and time come from it, and a pin outside the ring says so. The order is **re-priced
only when the pin moves, never while the address is being typed**. Tiles come from `NEXT_PUBLIC_MAP_TILE_URL` (default: OpenStreetMap's public server, meant
for light use). Tests: t99 (map, saved place, confirmation), t101 (saved places + sessions, API).

**Saved delivery places.** `CustomerAddress` (one row per customer **per outlet**: pin, address text, landmark, times used) is written when a delivery order is
placed and rewritten by the next one from the same outlet; another outlet keeps its own row (Noida and Delhi can differ). `GET /api/customer/address?outletId=`
reads it (null when signed out or never ordered), `PUT` saves by hand, `DELETE` forgets it (the picker's *Forget it* button). A customer of another store gets 403.
Staff-placed, takeaway and refused orders save nothing.

**Staying signed in.** A customer's sign-in is a database session (`CustomerSession`, a random token whose hash is stored) in an HttpOnly cookie that lasts **180
days and is pushed out again by every visit** (`GET /api/customer/me`, at most once a day, re-issuing the cookie); an ended session is never revived and signing out
removes it. The storefront treats only a *clear* "nobody" as signed out: a failed check (502 during a deploy/restart, a 429, no connection) is **retried with a growing
pause and never shows the login form** (it used to, which cost customers another code). Test: t102.

**The delivery code.** A new delivery order gets a 4-digit code (`Order.deliveryCode`, never in the dashboard's order data or the rider's list). It is shown to the
customer on the **"Order placed" screen in big highlighted digits** (the order response to the customer who placed it carries it; staff's does not) and on the order's tracking page,
for as long as the delivery is still to come (never after it is delivered or cancelled); the rider types it to mark the order delivered. Five wrong
tries lock the order for the rider (a manager can still complete it from the dashboard); an empty submission isn't a try; orders from before this have none.

**Rider app (RDA)** — `mobile-apps/rda`, `com.rasoipulse.rda`, first version `v-26.11.27-001`, violet icon with **RDA**.
- **Sign-in is its own thing:** a rider isn't a dashboard user. **Settings → Delivery riders → App login** gives a rider a PIN (4–6 digits, salted scrypt hash,
  never returned); the rider signs in with their phone number (its last 10 digits; unique across stores) and the PIN at `POST /api/rider/login`, which uses the
  same per-address and per-account guards as the staff sign-in (12 wrong PINs for one number from any addresses pause it). The token is a signed, 14-day
  `rdr1.…` token with no sessions table; **Reset PIN**, **Login off**, switching the rider off, removing them, a switched-off store or a plan without Delivery end it at once.
  The token opens **only** `/api/rider/…`.
- **API:** `GET /api/rider/me`, `GET /api/rider/deliveries` (their own: to do, and delivered today), `POST /api/rider/deliveries/:id/pickup` (Ready → Out for delivery;
  the customer is told, with the rider's name), `POST /api/rider/deliveries/:id/delivered` (`{ code }`; Out for delivery → Completed, the history says the rider did it),
  `POST /api/rider/logout`; manager side: `PUT /api/riders/:id/pin`, `DELETE /api/riders/:id/pin` (`rider:manage`). Handing an order to a rider also sends them a **WhatsApp message**
  from the store's own linked number when the plan has WhatsApp and a number is linked (never blocks the hand-over).
- **Free:** directions are a plain link into the rider's own maps app, calls are `tel:`, chats are `wa.me` — no map or routing service, no key.
- **Tests:** server t98 (87 checks), manager's PIN screen t100, the app's own jest suite (`npm test` in `mobile-apps/rda`) against answers recorded by
  `tests/e2e/suites/_record-rider-app-fixtures.mjs`.
- **Not in the first version (ideas):** live location sharing, an in-app map, push notifications while the app is closed, a rider list/earnings screen.

### Marketing website (apps/website): header, footer, homepage

- **About Us / Contact Us are footer-only, whatever the console calls them** (`about`, `about-us`, `contact-us`, or a menu label "About Us"): never in the header or the phone menu, always in the footer's Company column; "Talk to us" goes to the contact page. **The phone menu closes** after a link, a press outside or Escape (`MobileMenu.jsx`, a native `<details>` that still opens without JavaScript). Test: t117.
- **Header** = the Product dropdown, **Pricing**, **Apps** (a fixed link to `/apps`, not a console page), **FAQ**, and the Talk to us button. **About** and **Contact** live in the **footer** only (`FOOTER_ONLY` in `src/components/Chrome.jsx`); the footer's Product column also links to Apps.
- **Homepage apps note** (`AppsShowcase.jsx`, placed right after the product tabs by `PageView.jsx`): a few words and a small animated picture of an order travelling from the waiter's app to the kitchen's to the rider's. It deliberately has **no app cards and no downloads** — those are on `/apps`. It is drawn from the same app list as `/apps` and is left out when the list can't be reached.
- **Look**: the homepage hero has a quiet moving backdrop that fades out at the bottom (never a hard edge); Features and "moments" cards are tinted per card, light up under the pointer (`Spotlight.jsx`), and their icons have little hover tricks. Motion is CSS only; scroll-reveal runs only where the browser supports scroll-linked animations, and **everything stops under "reduce motion"**.
- **Text can't be selected and the pointer is never the text I-beam** (arrow over text, hand over links and buttons). Typing fields and an app's file checksum stay selectable on purpose.
- **Tests:** t44 (header and Product dropdown), t95 (`/apps` pages), t103 (the above, including a pixel check that the hero colour has faded by its bottom edge, and reduce-motion).

### Measuring API speed (run it on the server)

`apps/api/src/scripts/speed-test.js` (`npm run speed` in `apps/api`) measures how fast the API answers, where the time goes, and how fast the database is. Run it **on the server**, so the network between a phone and the server isn't part of the numbers:

```
cd /var/www/tablepe-prod/apps/api
SPEED_EMAIL=admin@example.com SPEED_PASSWORD='…' node src/scripts/speed-test.js --json before.json
node src/scripts/speed-test.js --load 10 --duration 15      # also: 10 requests at a time for 15 s
node src/scripts/speed-test.js --compare before.json         # run again, then show what changed
node src/scripts/speed-test.js --compare before.json after.json   # compare two saved runs, no test
node src/scripts/speed-test.js --url http://127.0.0.1:3092   # test the LIVE API from outside (total time only)
```

- **How:** by default it starts a *private copy* of the API inside the script (same code, same database from `.env`, a free local port, none of the background workers) and sends requests to it from `127.0.0.1`. Because the copy runs inside the script it can see inside each request: **server** time (arrival → answer sent, no network), **waiting for the database** (queries that run side by side count once), the **API's own work** (the rest), and the **number of queries**. It also runs a read-only `explain` on the busiest queries and flags **no index** (whole-collection scan), **sorting in memory**, and **reading far more documents than it returns**.
- **Database:** connect time, ping (round trip) and a small read, each timed many times, and the biggest collections. A ping does no work in MongoDB, so it shows the distance to the database; every query pays it.
- **Endpoints:** the public ones always; the dashboard/app ones (tables, orders, kitchen, dashboard stats …) when `SPEED_EMAIL` / `SPEED_PASSWORD` are set (a super admin works for any outlet; `--outlet <id>` picks one, the default is the outlet with the newest order). For each: the first request (cold), typical, slow 95%, worst, answer size.
- **Safe on production:** every request is a GET, except one sign-in and sign-out; it creates no indexes or collections; the private copy has the rate limits switched off (only for itself). It needs about as much memory as one more API process. Load tests are small (at most 20 at a time, 60 s) — still, run them at a quiet hour.
- **Tests:** t106.
- **Why answers take 200 ms+ and what to do about it:** [`docs/api-optimization-report.md`](docs/api-optimization-report.md) — measured with `tests/e2e/audit/api-timing.mjs` (a private API with a pretend distance to the database: `--rtt 0|20|40`): the time is waiting for database trips, worst right after the remembered "who you are / which store / what plan" answers expire.


## How it fits together

- **Store, outlet, owner.** A store (brand) has one or more outlets (locations) and a team. Menu, orders, tables and
  most settings belong to an outlet; the look (colours, fonts, effect, component styles), the plan and the
  **store name** belong to the whole store. The store name is shown read-only in the dashboard — only the platform
  admin renames a store (console → Stores → the store).
- **Plans.** A plan sets limits (people, outlets) and which features, effects and QR-card styles a store may use. The
  platform admin can override any of it per store, or put a store on the **Custom** plan, which includes nothing until
  set by hand. Anything beyond the plan is greyed out in the dashboard with the reason.
- **Roles.** `super_admin` (platform), then per store `owner`, `manager`, `staff`, `kitchen`, `editor`, `accountant`,
  each with its own permissions.
- **Addresses.** A store opens on its own domain (if its plan includes that) or on a free Rasoi Pulse address,
  `acme.<STORE_SUBDOMAIN_BASE>`. One storefront serves every store: it finds the store from the address it was opened on.
- **Tenancy.** Every query is scoped to a store by the `tenantScope` plugin in `packages/db`.

### Store dashboard (apps/admin)

Take order (counter billing; refuses a table another waiter took first and offers a free one) · Kitchen display at `/kitchen` (orders as cards by kitchen / bar station, Start and Ready taps, amber and red when late, optional bell for the waiter) · Dashboard · Orders (with missed-order alerts, takeaway pre-orders for a later pickup
time, and "out for delivery" with the rider who took it) · Table bookings (confirm, seat, no-show; phone bookings) ·
Menu (nested categories, sizes, add-on groups, combos, "goes well with" suggestions, counted stock with a daily refill,
dish and category hours like a breakfast menu, photos in four shapes — square, landscape, wide and portrait — so every
card style shows a fitting picture (including paste-a-picture and AI pictures), and where each dish is prepared) · Tables and printable QR cards · Printing (receipts and kitchen tickets: each dish — and each part of a
combo — goes to its kitchen or bar printer, a pre-order's ticket says when it's wanted, and the kitchen gets an
"order changed" or "order cancelled" ticket when an order is edited or cancelled; a computer switched on as a print
station prints for browser and network printers from any dashboard page) · Coupons (including "buy X, get Y free") ·
Customers and coin wallet · Ratings (customers rate completed orders; happy ones are pointed to Google) · Analytics
(sales, items, customers, outlet comparison, profit & loss, exports) · Marketing (WhatsApp, SMS, WhatsApp Business API
with filters and lists) · WhatsApp chat on the store's own numbers · Storefront builder (headers, banners and
carousels, store pages, theme, typography) · Settings (business identity, hours, order handling, kitchen and delivery,
receipts and GST, features, pre-orders and bookings, ratings and suggestions, load management, delivery riders,
abandoned-cart reminders) · Outlets · Payments · Notifications and message sending · Users and roles.

On the storefront customers also see "only N left" and combo savings on the cards, pick a pickup time for a takeaway,
book a table, rate an order and order it again from their Account page. Each order has its own page (`/<outlet>/order/<id>`) that follows it live — accepted, preparing, ready, out for delivery — and says so when the restaurant is running late.

### Platform console (apps/admin: the super admin, and team members by role)

Stores (plan, limits, features, owners, people, outlets, domains and Rasoi Pulse address, store name, disable or delete) ·
Plans and the price list · Client **onboarding form** (record a client's requirements, export to PDF, publish as a
store) · Marketing website pages and settings · Leads · Cache (lifetimes, expire, viewer) · Server monitor ·
Security (sign-in blocks) · Storage (where pictures live — try any storage without switching it on, see what is stored per store and outlet, and move the files between this server's disk and Cloudflare R2 / S3 with the stored picture addresses following) · AI pictures (Gemini keys) · Settings (grace period…) ·
Login activity.

### Platform team and roles (who may do what in the console and the Admin app)

The super admin (the owner's account, `isSuperAdmin`) does everything. **Everyone else who works for Rasoi Pulse is a team member with ONE role**, and only the super admin makes
roles and people: **Console → Team & roles** (People · Roles · Activity).

- **Features, not pages:** a role is a list of features (`PLATFORM_FEATURES` in `packages/config-schema/src/platform-access.js`): Dashboard · Stores — view / create and change / delete ·
  Onboarding · Website enquiries (leads) · Plans — view / create and change · Website · App Management · Server · Security · Cache · Storage · AI pictures · Platform settings.
  "Change stores" and "delete stores" bring "view stores" along. **Team & roles is never part of a role.** A Sales role that holds only Onboarding sees ONE item in the sidebar (and in the app):
  Onboarding — the onboarding form can read the plan list and check an address, nothing else of Plans or Stores opens.
- **The API decides, the screens follow:** `apps/api/src/modules/platform/platform-access.js` is ONE table of (method, path) → features. Every `/api/platform/*` request goes through it
  (`platformGate`); a person gets in with ANY listed feature; **a route with no row is closed to everyone but the super admin**, and test t121 fails if a route has no row. The website routes
  (`/api/platform/site`) and `/api/brands` ask `requirePlatform(req, "<feature>")` directly. A change to a role, a person switched off or a new password takes effect on the **next request** (the
  sign-in cache drops when a role or user is written) and ends every sign-in of that person.
- **Team members have no store:** `User.platformRoleId`, `memberships: []`. Restaurant owners and staff get 403 on the whole platform API; a team member gets 403 on every restaurant route
  (`requireOutletContext` needs a membership). Passwords: 10+ characters with letters and a number (these accounts can change every store), hashed like every other; the super admin sets or resets
  them and tells the person (shown once).
- **Every change is logged** (`PlatformAudit`: who, what, what was added or removed — never a password; kept a year) and shown on the Activity tab; sign-ins of team members appear in the sign-in log as "platform team".
- **Console:** the sidebar and routes show only the areas a person holds (`PLATFORM_AREAS`; the same list drives the app); a page they can't open says "Your role doesn't include this page"; a view-only
  role sees a store with every control switched off. **The page that used to be "App updates" is now "App Management"** (`/platform/app-management`; the old address redirects).
- **The Admin app** signs in with `x-app-id: admin` on `/api/auth/app-login` — for the super admin and team members only (a restaurant's owner gets 403), no update gate, and it is NOT in the apps catalog,
  so it has no page on the website.
- **Tests:** t121 (API: roles, people, 33+ denied requests, role changes at once, the app's token, the log, every route decided) and t122 (the console: make a role and a person, what Sam sees, view-only Sue).

### Admin app (Rasoi Pulse Admin)

`mobile-apps/admin` — the platform console in a phone or tablet, for the owner and the team roles. Nothing in it is decided locally: every screen calls `/api/platform/*` and the API's access table
(`platform-access.js`) refuses what a role may not do; the app only hides what a role does not hold (`src/lib/access.ts`, compared with `PLATFORM_AREAS` by a test so the two lists cannot drift).

- **Glass look:** one scenery (a gradient and three slowly drifting colour blobs) is drawn once behind the whole app; hero cards, the floating tab bar (phone) and the side rail (tablet) really blur it
  (`expo-blur`, Android needs the scenery registered as the blur target — `Background` / `Frost` in `src/ui/primitives.tsx`). Small list rows are plain translucent panels (no blur, no Android elevation
  shadow, which shows through see-through fills). Dark by default, light when the phone is light.
- **Reduced motion:** the drifting background, shimmer placeholders, row reveals, counting numbers and chart drawing all stop when the phone's "remove animations" is on (`useReducedMotion`).
- **Interactive:** charts draw themselves and can be touched and dragged to read a day; the date picker and dropdowns are our own sheets (never the phone's native boxes); phones get a floating tab bar
  (3 areas + More), tablets (wider than 700) a side rail with every area.
- **What it has:** Dashboard, Stores (+ a store's page), Onboarding (list + the requirement form: plan first, outlets with a map point, "allow anyway" beyond the plan, the server's ready-check, Publish as
  store with a made-for-you owner password shown once), Plans (read only), Leads, Server, Security, Cache, Settings, Team & roles. **Web console only:** the website editor, Storage, AI keys, the plan editor, App Management,
  the form's PDF / print and its look-and-feel (kept untouched when the app saves).
- **Sign-in:** `x-app-id: admin`; not in the apps catalog, so no update gate and no page on the website — install the APK yourself (the same company signing key as the other apps).
- **Tests:** `npm test` in the app (access rules, API client, every screen against a fake server, reduced motion, onboarding rules incl. mutation checks); server side t121/t122.

### Table bookings: a stay, a price, a 50% advance

The storefront's **Book a table** page (`/<outlet>/book`, `BookingView.jsx`) and the API behind it (`reservations.*`, rules in `packages/config-schema/src/reservations.js`).

- **The form** (open to everyone — **no sign-in is asked for until the form is complete**; the last button reads *Continue* and only then shows "One last step — sign in" with every answer
  kept): how many people · the **day** (`DatePickerInput` = DP03 popover input, filled calendar DP02, days limited to today … *days ahead*) · **from / to** (`TimePickerInput`; start times
  come from the API with full ones greyed out, finish times from `availability?start=` with each one's price and whether the table is free that long) · the **occasion**
  (`SearchSelect`, searchable; `BOOKING_EVENTS` + *Other* which opens a box for the name) · the **WhatsApp number** (10 digits; the sign-in number if left out) · an optional note.
  A notice says every request is approved by hand and the answer comes on WhatsApp (or "confirmed as soon as it is paid" when the outlet auto-confirms).
- **The stay** is chosen by the guest: from the outlet's *Shortest stay* to its *Longest stay* (Settings → Pre-orders & bookings; 1 h – 4 h by default), in steps of the booking time step, never past
  closing. A booking made without a finish (phone bookings, older clients) takes the *Usual stay* (90 min). A seat is free while the **busiest moment** of the stay fits the capacity (`peakGuests`) —
  bookings that follow each other don't add up.
- **The price:** *Booking price per person per hour* (Settings; paise in the config, rupees in the box; **0 = no charge, so nothing is paid in advance**) × guests × hours, to the whole rupee.
  The page shows total time and the estimate as the guest chooses. The guest pays **50%** (`PREPAY_PERCENT`) online now and the rest at the restaurant.
- **The advance** goes through the payment gateway (`payments.service.js`: `bookingGatewayFor` — the real gateway, else the test one; `createBookingIntent`; the `Payment` record has `subject: "reservation"`
  and `orderId` holds the booking's id; verify/webhook settle it through `settleReservationPayment`). Only the guest's own booking can be paid or confirmed (checked **before** anything is settled).
  If the outlet has a price but **no usable online gateway**, no advance is taken: the whole amount is paid at the restaurant.
- **While unpaid** a booking holds its seats for 15 minutes (`PAYMENT_HOLD_MINUTES`) and is **invisible to the team** (not in the day list, not in the "to confirm" badge); the guest sees it on the
  account page with *Pay … to finish*. After that it is let go (`sweepUnpaidBookings`, every 5 minutes and lazily when read; payment state `expired`, never shown to the team as "cancelled").
  Paid → the team sees it as *Waiting to be confirmed* and the guest is told on WhatsApp (their WhatsApp number, else the sign-in number) that it was received. A person approves it by hand.
- **Refunds:** declining or cancelling a **paid** booking, or the guest cancelling it, marks the advance **refund due** (shown on the Bookings page with a *Mark refunded* button; the guest is told it
  will be refunded). **Refunds are not sent through Razorpay by the app — the restaurant sends the money back from its gateway dashboard and then marks it.** A no-show keeps the advance.
  Money that arrives after the hold ran out is marked for a refund, not lost.
- **Food and drinks are extra:** the page (and the guest's messages) say the guest pays the *booking amount plus whatever they eat and drink*; only 50% of the **booking amount** is paid online.
- **Coupons on bookings:** a coupon works on a booking only when **Table booking** is ticked in its *Order types* (none ticked = food orders only; "buy X get Y" never applies to a table).
  The guest types a code or presses one of the restaurant's offers (`/api/coupons/public` lists them; the box on the page asks `POST /api/reservations/coupon` which works the price out itself);
  the 50% advance is half of what is **left** after the coupon; a coupon covering everything means nothing to pay online. The use is counted when the booking is made and **given back**
  if the advance is never paid or the guest gives up. The team sees the coupon, what it took off and the original price. The plan feature *Coupons* is needed.
- **The team's Bookings page** (`Reservations.jsx`): **every upcoming booking in one list, soonest first, grouped by day** — nobody changes a date to find them. Tabs *Upcoming* (default, today on),
  *Earlier* (before today, newest first) and *All*; the date is only a **filter** (our `DatePickerInput`; *Show all upcoming* undoes it). `GET /api/reservations?scope=upcoming|earlier|all` or `?day=`
  (cut at 300 with a `more` flag). **Status button** on every booking: the status can be set **by hand** to any other (a no-show marked by mistake isn't stuck) — `PATCH` with `manual: true`;
  the history records "Changed by hand from …"; a booking brought back keeps its advance (refund due → paid; one already refunded stays refunded).
- **Telling the guest** when a booking is approved, declined or cancelled: a window opens with a **reason** (decline/cancel), the **message already written and editable**, and the way it will
  be sent — **automatically**: the store's **linked WhatsApp** number (plan feature *WhatsApp chat*, account online) → **WhatsApp Business** (Settings → *WhatsApp Business template for booking
  updates*: an approved template with one `{{1}}` placeholder; line breaks are turned into spaces) → **SMS** → nothing (the guest still sees the status on their account page).
  `GET /api/reservations/:id/message?status=` previews the words and the route; `notify: { send, message }` on the `PATCH` sends (omitted = the usual message, `{ send: false }` = none).
- **Use our components:** dates on the dashboard use `DatePickerInput` (never a browser `<input type="date">`) — the Bookings filter, *New booking* and the coupon's valid period (with `TimePickerInput`).
  Native `type="time"` boxes still exist in Settings (opening hours), Cart reminders, dish availability windows and the platform onboarding form.
- **Tests:** t113 (rules + API), t114 (the page, with the coupon box), t115 (dashboard: settings, the list and its filter, status by hand, the message window, refunds, coupons),
  t118 (the team's side + coupons, API), t54 (older booking API), t55, t56.

### Order history pages (PAG03)

The storefront Account page shows **5 orders a page** with the joined pagination (`PaginationJoined`, PAG03, now a real control: buttons, `aria-current`, `1 … 4 5 6 … 20` for many pages). The API takes
`GET /api/customer/orders?page=N&limit=5` and answers `page`, `pageSize`, `total`, `pages` (a page past the end gives the last one); without `page` it still pages by date (`before`). The address can set the page
size (`?pageSize=10`, 1–30). Removing the last order on a page drops back to the previous page. Test: t116.

### UI library: time picker, searchable dropdown

`packages/ui` has `TimePicker` / `TimePickerInput` (TP01, TP02 in the catalogue; options can be switched off), `SearchSelect` (DRP08) and `useAnchoredPopover` (the shared popover placement); `DatePickerInput`
now takes `minDate`, `maxDate`, `fullWidth`, `formatValue` and lets a store's style effects reach its box. See Settings → Components catalogue (Pickers & Inputs).

### Plans: features, the table limit, and the plan editor

A plan is **limits** (people, outlets, **tables**) plus **features** (what the store can switch on), and a Custom plan has nothing of its own: each store's
limits and features are set by hand on its page. The shared rules live in `packages/config-schema/src/plan.js` and `plan-presets.js`.

- **Tables are sold in fives** — 5, 10, 15 … never 12 or 19 (`TABLE_STEP`; the schema refuses anything else, and the box rounds what is typed **up**: 12 → 15).
  The limit counts the **whole store** (every outlet together; a table switched off still counts). It is enforced when a table is created
  (`createTable`: 409 with `details.code: "table_limit"`, a **fresh** count, and a check after saving so tables added in the same instant can't slip past the
  limit); the platform's own super admin may go past it. A store that already has **more** tables than its limit keeps all of them and just can't add more — it is
  *not* put into the over-limit grace period (tables can't be "blocked" like outlets and people). **Plans and stores from before the limit have none (unlimited)**,
  so nothing is cut off until someone sets it. A store put on a Custom plan gets a limit that holds its tables (rounded up to 5, at least 5).
  Where it shows: plan editor (Limits row), a store's **Plan & limits** page (From plan / Custom number / Unlimited) and its header pill, the stores list, the
  owner's **Tables** page ("5 of 5 tables used", a warning, Add table switched off), the website's plan cards and comparison table.
- **Price:** the price list has *Every 5 extra tables (₹)* (starts at ₹100); the onboarding estimate charges whole blocks of 5 beyond the plan (12 tables = 15),
  and "Do the prices add up?" counts tables too. The onboarding form has a **Tables** box (steps of 5) — more than the plan allows raises a plan-fit issue with
  "add for this client", which publishes the store with the bigger limit.
- **Presets:** Starter = 1 outlet, 5 people, **5 tables**, six features; Business = every feature (`allFeatures`, so features added later reach it), 3 outlets,
  20 people, **20 tables**. `node src/scripts/update-plans.js` (dry run) / `--apply` (in `apps/api`) brings **existing** plans up to date — features and the
  table limit — and never changes a table limit someone already set. *Run the dry run on the real database first; nothing is applied automatically.*
- **Feature dependencies** (`FEATURE_REQUIRES`): Delivery needs Online payments, Pre-orders need Takeaway, Cart reminders and Marketing need WhatsApp & SMS
  alerts — the plan editor warns, it doesn't forbid.
- **The plan editor** is a wide pop-up (1,360 px) with the limits on one row and Features / Looks / On the website in three columns, so a normal screen shows the
  whole plan without scrolling (a short screen still scrolls). Tests: t108 (features, presets, scripts), t109 (tables, API), t110 (plan editor and table limit UI).

### Dashboard: who sees what

Every widget in `DASHBOARD_WIDGET_CATALOG` (packages/config-schema/src/dashboard.js) says what it **needs**: a permission (revenue needs Reports =
`analytics:read`, coupons `coupon:read`, bookings `reservation:read` …) and sometimes a plan feature (deliveries need Delivery, bookings need Table reservations,
the rating card needs Ratings). `visibleWidgetsFor(settings, role, features)` is the one rule for what a person sees: the widget is **on**, their role is
**ticked**, the role **may read** its numbers, and the **plan** includes it (the platform's super admin sees every widget that is on). A stale tick on a role that may
not read the numbers shows nothing. The API enforces the same rule: `GET /api/dashboard/stats` works out the visible widgets for the caller and **computes and sends
only those** (a cook calling it directly gets no revenue, and the database isn't asked for what nobody will see).

- **"Today" is the Indian day** (IST, midnight to midnight) wherever the server clock is set; the trend chart, the hour chart and "yesterday" use the same day.
- **New widgets:** *Out for delivery* (on the way now, ready and waiting for a rider), *Table bookings today* (still to come, waiting for a yes), *Customer rating*
  (average of the last 30 days).
- **Look:** a greeting and "Updated hh:mm" with Refresh; a *needs attention* strip (orders past their time limit, unpaid online orders, deliveries waiting for a
  rider, bookings waiting for a yes, messages that failed) whose chips go to the page that fixes them, or one calm "all clear" line; cards with a coloured icon
  chip, revenue shown against yesterday with a small trend line, charts drawn at their real width (grid, marked last point, read-out on hover).
- **Settings → Configure dashboard** is one grid: a row per widget, a column per role, an On switch, arrows to reorder, a padlock (with the reason in its tooltip)
  where a role can't be given a widget or the plan lacks it, all / none per column, and **Recommended** to start over (nothing is saved until Save). On a phone the rows
  are stacked. Tests: t111 (rules + what each role is sent, API), t112 (screens), t66 (phone layout).

### Delivery riders: the ⋮ menu and "Show PIN"; the outlet picker

A rider's actions are one **⋮ menu**. A manager can **Show PIN**: the PIN is stored hashed (as before) *and* as an AES-256-GCM copy (`Rider.pinEnc`, key derived from
`ENCRYPTION_KEY` with the fixed salt in `lib/crypto.js` — **never change that salt**); `GET /api/riders/:id/pin` is manager-only, `no-store`, rate-limited
(`rider-pin-view`, 30 per 10 minutes) and logged; riders whose PIN was set before this have no copy ("Set a new PIN"). Tests: t98 (API), t100 (UI).
Choosing a team member's outlets uses `MultiSelect` (packages: `apps/admin/src/ui.jsx`) — a dropdown with search, an *All outlets* row, Select all / Clear / Done,
the same height as the other fields. Test: t92.

## Configuration

Local defaults work out of the box; each app ships a `.env.example`. The settings you will most likely touch are in
`apps/api/.env`:

| Setting | What it does |
| --- | --- |
| `MONGODB_URI`, `MONGODB_DB` | the database |
| `CORS_ORIGINS` | origins allowed to call the API (storefront + admin) |
| `ENCRYPTION_KEY` | encrypts payment and messaging credentials at rest — **change it for production** |
| `ALLOW_MOCK_GATEWAY` | the simulated payment gateway; **never `true` in production** |
| `STOREFRONT_ORIGIN` | the storefront's public origin — every table QR code is built from it (the API refuses to start in production with a localhost value) |
| `STORE_SUBDOMAIN_BASE` | the domain stores' Rasoi Pulse addresses live under (`rasoipulse.in` in production, `localhost:3070` locally so `acme.localhost:3070` works with no DNS) |
| `PUBLIC_API_URL` | the API's own public origin, used to build links to uploaded pictures |
| `UPLOADS_DIR` | where the local storage provider writes uploads |
| `WEBSITE_URL`, `WEBSITE_INTERNAL_URL`, `WEBSITE_REVALIDATE_SECRET` | how the API tells the marketing website to refresh; the secret must match the website's. `WEBSITE_URL` is also the address the staff app sends people to for updates (`<WEBSITE_URL>/app`) |
| `APP_RELEASES_DIR`, `APP_RELEASE_MAX_MB` | scratch space for app uploads in progress (the finished APK goes to the Storage chosen in the console) and the biggest allowed (default 300 MB) |
| `WHATSAPP_WORKER`, `MARKETING_WORKER` | see below |
| `LOGIN_*`, `RATE_LIMITS`, `RATE_LIMIT_SCALE` | sign-in protection and API request limits (see the docs below) |
| `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | optional Cloudflare Turnstile on the website's enquiry form |

Other apps: the storefront and website read `NEXT_PUBLIC_API_URL` (build time) and `API_INTERNAL_URL` (the address
their servers use to reach the API on the same machine); the admin reads `VITE_API_URL`; the website also takes
`NEXT_PUBLIC_SITE_URL` and `WEBSITE_REVALIDATE_SECRET`.

**Run the workers on exactly one API process.** `WHATSAPP_WORKER=on` makes a process hold the linked WhatsApp
numbers' connections and send queued messages; `MARKETING_WORKER=on` sends queued SMS and WhatsApp Business
marketing messages. Abandoned-cart reminders are sent from whichever process has either of the two on. Leave both
`off` everywhere else that shares the same database — in particular your laptop if it points at a shared database — or
two copies will fight over the same WhatsApp session.

## Secrets

Never commit secrets. `.env` files are git-ignored. Restaurant payment keys, SMTP and messaging credentials, the
platform's picture storage and AI keys are entered in the admin or console and stored **encrypted** in MongoDB — they
never live in code or env files in production.

**Logs never hold a secret.** The API's request log (`apps/api/src/logger.js`) replaces the session cookie, an app's `Authorization`
Bearer token, the website/print-agent/site secret headers, a sign-in's `Set-Cookie` and any `password` / `token` field with `[hidden]`
before a line is written (`HIDDEN_IN_LOGS` is the list — add a header there when a new secret header is introduced). Test: t119.
Logs written before 2026-11-27 contain the visitors' session cookies — treat them as exposed (delete them; sessions expire by themselves).

## Tests

`tests/e2e` is a saved, repeatable test library that drives Chrome through the real screens. It runs against a
**throwaway bench** — its own in-memory database, two fake stores and its own builds on ports 3097 / 3171 / 3170 — so
it never touches real data or your dev servers.

```bash
cd tests/e2e && npm install           # once
node run.mjs                          # every test, headless; results and docs are saved
node run.mjs --only t47 --visible     # one test, in a visible Chrome window
node run.mjs --rebuild                # rebuild the dashboard and storefront first
node run.mjs --list                   # the tests and their last result
```

Each test writes its steps, what must happen, what must **not** happen, and its result to
[`tests/e2e/docs/`](tests/e2e/docs/CATALOG.md). The bench API keeps running between runs, so after changing
`packages/config-schema` or `apps/api`, restart it with `node bench/bench.mjs reset` (fresh fake data) before
re-running. `tests/e2e/README.md` explains the bench and how to add a test. The Turborepo scripts are `pnpm build` and
`pnpm lint`.

## Production

Build the apps (`pnpm build`), then run the API with `node src/server.js` (`pnpm --filter @rasoipulse/api start`) and the
Next.js apps with `next start`. The admin is a static `dist/` to be served by a web server. A typical setup is nginx in
front of a process manager such as pm2. Things to get right:

- Set `NODE_ENV=production`, a real `ENCRYPTION_KEY`, `ALLOW_MOCK_GATEWAY=false`, `STOREFRONT_ORIGIN`,
  `STORE_SUBDOMAIN_BASE`, `PUBLIC_API_URL`, `CORS_ORIGINS` and the website secret.
- The storefront and website bake the API address in at **build time** — rebuild them after changing it.
- The reverse proxy must pass the visitor's real IP (`X-Forwarded-For`), or sign-in blocks and rate limits will see
  everyone as one address.
- Wildcard store addresses (`acme.rasoipulse.in`) need a one-time DNS, nginx and certificate step.

## More documentation

- [`deploy/wildcard-subdomains.md`](deploy/wildcard-subdomains.md) — store addresses on a subdomain: local use and the three one-time production steps
- [`deploy/login-protection.md`](deploy/login-protection.md) — sign-in brute-force protection and how to tune it
- [`docs/api-optimization-report.md`](docs/api-optimization-report.md) — why some answers take 200 ms or more, the measurements, and the order to fix them in
- [`docs/api-rate-limiting.md`](docs/api-rate-limiting.md) — which API requests are limited, how hard, and why
- [`docs/free-maps.md`](docs/free-maps.md) — the free map (Leaflet + OpenStreetMap), what it costs, and how to serve your own tiles; [`mobile-apps/README.md`](mobile-apps/README.md) — how the mobile apps are organised; [`mobile-apps/oma/README.md`](mobile-apps/oma/README.md) — run, build, version and test the staff order app; [`mobile-apps/kda/README.md`](mobile-apps/kda/README.md) — the same for the kitchen display app; [`mobile-apps/rda/README.md`](mobile-apps/rda/README.md) — the rider delivery app
- [`tests/e2e/README.md`](tests/e2e/README.md) — the test library and how to add a test
