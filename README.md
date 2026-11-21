# TablePe

Multi-tenant restaurant ordering platform. One codebase serves many restaurants: each **store** gets its own
storefront, team dashboard, menu, orders and look — switched on and limited by the **plan** it is on.

- **Diners** order takeaway, delivery or dine-in (scanning the QR on their table) from the store's storefront.
- **The restaurant's team** runs the day from the store dashboard: orders, menu, tables, printing, customers,
  analytics, marketing and WhatsApp chat.
- **The TablePe operator** (platform super admin) creates stores, sets plans and limits, and manages the platform and
  the marketing website from the **platform console**.

## What's in the repo

| Part | Tech | Dev port |
| --- | --- | --- |
| `apps/storefront` | Next.js (App Router) — the customer site: menu, checkout, account, table ordering | **3070** |
| `apps/admin` | React + Vite SPA — the store dashboard **and** the platform console | **3071** |
| `apps/api` | Node + Express (JavaScript, ESM) + MongoDB — the one API behind everything | **3072** |
| `apps/website` | Next.js — the TablePe marketing website, edited from the platform console | **3073** |
| `packages/config-schema` | Zod schemas and shared rules (store config, plans, pricing, menu, orders…) | — |
| `packages/db` | Mongoose models, the tenant-scoping plugin, the write-event hooks | — |
| `packages/ui` | Shared components (headers, cards, menu sections, pinned bars…) and design tokens | — |
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
- **Addresses.** A store opens on its own domain (if its plan includes that) or on a free TablePe address,
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

Stores (plan, limits, features, owners, people, outlets, domains and TablePe address, store name, disable or delete) ·
Plans and the price list · Client **onboarding form** (record a client's requirements, export to PDF, publish as a
store) · Marketing website pages and settings · Leads · Cache (lifetimes, expire, viewer) · Server monitor ·
Security (sign-in blocks) · Storage (where pictures live) · AI pictures (Gemini keys) · Settings (grace period…) ·
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
| `STORE_SUBDOMAIN_BASE` | the domain stores' TablePe addresses live under (`tablepe.in` in production, `localhost:3070` locally so `acme.localhost:3070` works with no DNS) |
| `PUBLIC_API_URL` | the API's own public origin, used to build links to uploaded pictures |
| `UPLOADS_DIR` | where the local storage provider writes uploads |
| `WEBSITE_URL`, `WEBSITE_INTERNAL_URL`, `WEBSITE_REVALIDATE_SECRET` | how the API tells the marketing website to refresh; the secret must match the website's |
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

Build the apps (`pnpm build`), then run the API with `node src/server.js` (`pnpm --filter @onetap/api start`) and the
Next.js apps with `next start`. The admin is a static `dist/` to be served by a web server. A typical setup is nginx in
front of a process manager such as pm2. Things to get right:

- Set `NODE_ENV=production`, a real `ENCRYPTION_KEY`, `ALLOW_MOCK_GATEWAY=false`, `STOREFRONT_ORIGIN`,
  `STORE_SUBDOMAIN_BASE`, `PUBLIC_API_URL`, `CORS_ORIGINS` and the website secret.
- The storefront and website bake the API address in at **build time** — rebuild them after changing it.
- The reverse proxy must pass the visitor's real IP (`X-Forwarded-For`), or sign-in blocks and rate limits will see
  everyone as one address.
- Wildcard store addresses (`acme.tablepe.in`) need a one-time DNS, nginx and certificate step.

## More documentation

- [`deploy/wildcard-subdomains.md`](deploy/wildcard-subdomains.md) — store addresses on a subdomain: local use and the three one-time production steps
- [`deploy/login-protection.md`](deploy/login-protection.md) — sign-in brute-force protection and how to tune it
- [`docs/api-rate-limiting.md`](docs/api-rate-limiting.md) — which API requests are limited, how hard, and why
- [`tests/e2e/README.md`](tests/e2e/README.md) — the test library and how to add a test
