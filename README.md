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

### App updates: uploading a version, optional vs. required

The apps are not on the Play Store. New versions are uploaded in the platform console and downloaded from the website. **Every app has its own releases, its own build numbers and its own download page**; the one list of apps is `APP_CATALOG` in `packages/config-schema/src/app-release.js` (today `oma`, `kda` and `rda`), and the console, the website and the checks all follow it:

- **Console → App updates** (`/platform/app-updates`, platform admin only): one **tab per app** (OMA · KDA · RDA), each with its own list; *New version* picks the `.apk`, fills the
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

### How often the apps ask for new data (refresh interval, per app)

- **One number per app**, in seconds, **default 8**, allowed **3 to 600**. The platform admin sets it in the console: **App updates → the app's tab → Refresh interval**. The delivery app (RDA) set to 15 asks the server for new deliveries every 15 seconds; OMA and KDA have their own numbers.
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

### Platform console (apps/admin, super admin only)

Stores (plan, limits, features, owners, people, outlets, domains and Rasoi Pulse address, store name, disable or delete) ·
Plans and the price list · Client **onboarding form** (record a client's requirements, export to PDF, publish as a
store) · Marketing website pages and settings · Leads · Cache (lifetimes, expire, viewer) · Server monitor ·
Security (sign-in blocks) · Storage (where pictures live — try any storage without switching it on, see what is stored per store and outlet, and move the files between this server's disk and Cloudflare R2 / S3 with the stored picture addresses following) · AI pictures (Gemini keys) · Settings (grace period…) ·
Login activity.

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
- [`docs/api-rate-limiting.md`](docs/api-rate-limiting.md) — which API requests are limited, how hard, and why
- [`docs/free-maps.md`](docs/free-maps.md) — the free map (Leaflet + OpenStreetMap), what it costs, and how to serve your own tiles; [`mobile-apps/README.md`](mobile-apps/README.md) — how the mobile apps are organised; [`mobile-apps/oma/README.md`](mobile-apps/oma/README.md) — run, build, version and test the staff order app; [`mobile-apps/kda/README.md`](mobile-apps/kda/README.md) — the same for the kitchen display app; [`mobile-apps/rda/README.md`](mobile-apps/rda/README.md) — the rider delivery app
- [`tests/e2e/README.md`](tests/e2e/README.md) — the test library and how to add a test
