# API rate limiting

Which API requests are limited, how hard, and **why**.

Everything below comes from one table in code — [`apps/api/src/middleware/rate-limit.js`](../apps/api/src/middleware/rate-limit.js) — and the tables in this page are generated from it and from the real routes, so they cannot drift from what the server does. A test (`t28-rate-limits-api`) fails if a route that changes data is ever added without a limit.

## The idea in four rules

1. **Everything is limited a little, the risky things a lot.** Every `/api` request counts against a general limit; routes that cost money, can be guessed at, or can hurt someone have a stricter limit of their own.
2. **A limit counts one "who".** Either the visitor's network address, the signed-in team member, the customer's sign-in cookie, one store, one account, or one phone number — whichever is the thing being abused.
3. **Our own servers are never limited by address.** The storefront's and website's servers call the API over the loopback address for every page they render; counted by address they would all look like one visitor. (Limits on a *person* — a user, a store, a phone number — still apply to them.)
4. **Saying no is polite and consistent.** A limited request gets `429 Too Many Requests`, a `Retry-After` header (seconds), and a JSON body the screens already know how to show:

   ```json
   { "error": "Too many code requests from this network. Please try again in 10 minutes.",
     "details": { "code": "rate_limited", "retryAfterSec": 600, "policy": "otp-send-ip" } }
   ```

## How a sign-in code is protected (the layers)

Asking for a code is the request that costs real money (an SMS or a WhatsApp message) and can annoy a real person, so it has the most layers. A request has to get through all of them, in this order:

| Layer | Stops | Limit |
|---|---|---|
| `api` | any script hammering anything | 600 / min per address |
| `otp-flood` | a burst of code requests or guesses | 30 / min per address (sign-in guard) |
| `otp-send-ip` | one address texting many different phones | 15 / 10 min per address |
| `otp-send-store` | any attack, from any number of addresses, making one store pay for codes | 300 / hour per store |
| `otp-resend-number` | flooding one person's phone | the same number waits 30 s, then 1 min, 2 min, 5 min, 15 min, 1 h, then 6 h between codes — however the number is written (`+91…`, `0091…`, spaces) |
| attempts per code | guessing a 6-digit code | 5 wrong tries per code; wrong guesses also block the address (5 minutes, growing to a day) |

Signing in to the dashboard works the same way: `login-flood` (a burst from one address), the sign-in guard (5 wrong passwords block that address, longer each time), and **`login-account`** — new — which counts wrong passwords for the *account* whatever address they come from, so a botnet spreading guesses over hundreds of addresses is still stopped: 10 wrong passwords pause that account for 1 minute, then 5, 15 and 60 minutes. The pauses are deliberately short, so nobody can lock an owner out for a day by mistyping their email.

## What is limited, and why

<!-- generated:begin (node apps/api/src/scripts/route-inventory.js --write-doc) -->

| Limit | Counted per | Allows | Why | Where it applies |
|---|---|---|---|---|
| `api` | signed-in user (else address) | 600 per min for a visitor's address · 1,500 per min for a signed-in user | The floor under everything: no one — a script, a stuck app, a stolen session — can hammer any endpoint without limit. Signed-in team members get 1,500 a minute, visitors 600 a minute per address (a restaurant's whole Wi-Fi shares one). | every `/api` request |
| `login-flood` | visitor's address | 30 requests per min per address; then 5 wrong passwords block the address for 5 min, 15 min, 1 h, 6 h, 24 h (each block longer) | A script can't hammer the dashboard sign-in before it even starts guessing. (Wrong guesses are separately counted per address and per account, and block for longer each time.) | `POST /api/auth/app-login`<br>`POST /api/auth/login`<br>`POST /api/rider/login` |
| `login-account` | account (email) | 10 wrong passwords in 15 min pause the account for 1 min, then 5 min, 15 min, 1 h | Guessing one account's password from many addresses (a botnet) gets past the per-address block. After 10 wrong passwords for the same email — from anywhere — that account's sign-in pauses for 1 minute, then 5, 15 and 60 minutes. Counts submitted emails whether or not they exist, so it reveals nothing. | `POST /api/auth/app-login`<br>`POST /api/auth/login`<br>`POST /api/rider/login` |
| `otp-flood` | visitor's address | 30 requests per min per address; 5 wrong codes block the address, longer each time | Any burst of sign-in-code requests or code guesses from one address. | `POST /api/customer/otp/request`<br>`POST /api/customer/otp/verify` |
| `otp-send-ip` | visitor's address | 15 per 10 min | Each code costs the store an SMS or a WhatsApp message. One address can't make the store text hundreds of different phone numbers (SMS bombing). 15 per 10 minutes leaves room for a restaurant's shared Wi-Fi. | `POST /api/customer/otp/request` |
| `otp-send-store` | store | 300 per hour | A ceiling on what any attack — however many addresses it uses — can make ONE store spend on codes in an hour. | `POST /api/customer/otp/request` |
| `otp-resend-number` | phone number | the same number waits 30 s, 1 min, 2 min, 5 min, 15 min, 1 h, then 6 h between codes | The same phone number gets its next code only after 30 s, then 1 min, 2 min, 5 min, 15 min, 1 h, then 6 h — enforced by the server, however the number is written. Stops a victim's phone being flooded. | `POST /api/customer/otp/request` |
| `coins-code` | signed-in user (else address) | 40 per 10 min | Staff asking a customer for a coin-spending code, and typing it in: stops a signed-in account (or a stolen one) trying numbers and codes at speed. | `POST /api/orders/staff/coins-code`<br>`POST /api/orders/staff/coins-code/verify` |
| `site-challenge` | visitor's address | 40 per 10 min | The enquiry form's spam-guard puzzle is cheap to hand out but not free; this stops it being farmed. | `GET /api/site/challenge` |
| `site-lead` | visitor's address | 8 per 10 min | The enquiry form writes to the database and notifies the team. A cheap per-address cap in front of the spam guard's other checks (puzzle, hidden field, per-phone and site-wide caps). | `POST /api/site/leads` |
| `public-compute` | visitor's address | 90 per min | Price quotes, delivery checks and capacity lookups are open to visitors and each runs several database reads — they must stay fast for real customers, not be a way to load the database. | `GET /api/customer/cart/:id`<br>`POST /api/delivery/check`<br>`POST /api/menu/suggestions`<br>`GET /api/orders/capacity`<br>`GET /api/orders/pickup-slots`<br>`POST /api/orders/quote`<br>`GET /api/reservations/availability` |
| `coupon-guess` | visitor's address | 20 per 5 min | Coupon codes are short; without a limit a script can try thousands to find a valid one. | `POST /api/coupons/apply` |
| `table-scan` | visitor's address | 60 per min | QR scans and table lookups are open to anyone with a link; this stops table ids or tokens being guessed at speed. A dining room's Wi-Fi scanning at once still fits. | `POST /api/tables/claim`<br>`GET /api/tables/public`<br>`GET /api/tables/scan/:tableId`<br>`POST /api/tables/scan/:tableId/session`<br>`GET /api/tables/sessions/:id/tab` |
| `rider-pin-view` | signed-in user (else address) | 30 per 10 min | A manager looking up a rider's PIN to tell it to them again: a few a day. Each look reads a stored secret, so a high rate means a script or a stolen session. | `GET /api/riders/:id/pin` |
| `customer-account` | user, else customer, else address | 30 per 10 min | A customer saving their profile or signing out: a few a day is normal, so a high rate means a script. | `DELETE /api/customer/address`<br>`PUT /api/customer/address`<br>`POST /api/customer/logout`<br>`DELETE /api/customer/orders/:id`<br>`PATCH /api/customer/profile`<br>`POST /api/reservations/:id/cancel` |
| `order-tracking` | user, else customer, else address | 40 per min | The tracking page asks where one order is every few seconds while it is open. That is about ten asks a minute for one tab, so this leaves room for a few tabs and is still far too little for a script scraping orders. | `GET /api/customer/orders/:id` |
| `customer-orders` | user, else customer, else address | 90 per 10 min | A customer's Account page (their order history). It refreshes every 20 seconds or so while an order is being prepared, which is far under this; a higher rate is a script copying history or loading the database. | `GET /api/customer/orders`<br>`POST /api/customer/orders/:id/reorder`<br>`GET /api/reservations/mine` |
| `cart-sync` | user, else customer, else address | 120 per 10 min | A signed-in customer's cart is saved (for abandoned-cart reminders) a moment after each change. A busy customer changes it a few dozen times; more than this is a script writing to the database. | `PUT /api/customer/cart` |
| `customer-feedback` | user, else customer, else address | 20 per 10 min | Rating an order: a customer rates a handful of orders at most; this stops a script filling the store's ratings. | `POST /api/customer/orders/:id/feedback` |
| `reservation-request` | user, else customer, else address | 10 per hour | Booking a table holds seats for everybody else: a few requests an hour is plenty for a real guest, and a script must not be able to fill a restaurant's evening with fake bookings. | `POST /api/reservations` |
| `order-place` | user, else customer, else address | 12 per 10 min for a customer · 150 per 10 min for staff at the till | A customer placing orders: a dozen in ten minutes is generous, more is a script flooding the kitchen. Staff at the till (who send the outlet header) get a much bigger budget. | `POST /api/orders` |
| `rider-action` | visitor's address | 90 per min per address | A rider tapping Picked up / Delivered (and the code box) in the rider app. A few a minute is normal; this stops a script from trying delivery codes or flooding an outlet's orders. (Wrong codes are also counted per order: five and it locks.) | `POST /api/rider/deliveries/:id/delivered`<br>`POST /api/rider/deliveries/:id/pickup`<br>`POST /api/rider/logout` |
| `payment` | user, else customer, else address | 40 per 10 min | Starting and confirming a payment calls the payment gateway; this stops a script burning the store's gateway quota. | `POST /api/payments/intent`<br>`POST /api/payments/verify` |
| `webhook` | visitor's address | 240 per min | Payment gateways call this with a signature we check — but a flood of forged calls would still cost a signature check and a database read each. A gateway's servers speak for every merchant it has, so the ceiling is generous (4 a second per address) — raise RATE_LIMIT_SCALE if the platform grows to many busy stores. | `POST /api/payments/webhook/:gateway` |
| `print-agent` | visitor's address | 300 per min | The little program at a restaurant's printer asks for jobs every second or two with its own token. 300 a minute leaves room for several printers; it stops a leaked token being used to hammer the queue. | `GET /api/printing/agent/jobs`<br>`POST /api/printing/agent/jobs/:id/result` |
| `app-update-check` | visitor's address | 120 per min | Every phone running the staff app asks once when it starts whether a newer version exists. A restaurant's whole Wi-Fi shares one address and the staff all open the app at the same time, so the budget is generous — it only stops a script hammering the question. | `GET /api/app-updates/apps`<br>`GET /api/app-updates/check`<br>`GET /api/app-updates/releases` |
| `app-download` | visitor's address | 40 per 10 min | Downloading the app's APK (tens of MB). 40 downloads per 10 minutes per address leaves room for a whole team installing at once behind one Wi-Fi, and stops someone using the download as a bandwidth drain. | `GET /api/app-updates/download/:id` |
| `release-upload` | signed-in user (else address) | 200 per 10 min | Uploading a new app version: a 100 MB file goes up in 4 MB pieces, one request each (a 300 MB file is 75). 200 pieces in 10 minutes is room for a couple of uploads plus retries, and it is kept under the dashboard's own 240-changes-a-minute cap so a stuck page or a script is stopped by this one. Only the platform's super admin can upload. | `POST /api/platform/app-releases/uploads`<br>`PUT /api/platform/app-releases/uploads/:id/chunks/:index`<br>`POST /api/platform/app-releases/uploads/:id/complete` |
| `team-write` | signed-in user (else address) | 240 per min | Every change a team member makes to the dashboard (menu, outlets, orders, tables, pages, settings…). 240 a minute is four a second — more than any person — so a stolen session can't mass-delete or mass-edit in a blink. | 181 routes (see the full list below) |
| `account-write` | signed-in user (else address) | 30 per 10 min | Creating team members, changing roles and resetting passwords. Takeover of accounts is the worst thing that can happen to a store, so it is slow on purpose. | `POST /api/platform/stores/:id/owners`<br>`DELETE /api/platform/stores/:id/owners/:userId`<br>`PATCH /api/platform/stores/:id/owners/:userId`<br>`DELETE /api/platform/stores/:id/people/:userId`<br>`POST /api/platform/stores/:id/people/:userId/block`<br>`POST /api/platform/stores/:id/people/:userId/unblock`<br>`POST /api/users`<br>`DELETE /api/users/:id`<br>`PATCH /api/users/:id` |
| `ai-images` | signed-in user (else address) | 15 per 10 min | Making dish pictures with Gemini. Every picture is a paid call to Google, one request can make up to four, and only the platform's super admin can start one — this is a brake on a stuck button or a script, not on normal use. | `POST /api/menu/items/:id/generate-images` |
| `storage-heavy` | signed-in user (else address) | 60 per 10 min | Scanning the storage for pictures that are too big, and starting an optimize run. A scan reads every stored file's name and every collection of the database, and a run compresses pictures (a few at a time) — only the platform's super admin can start either, so this is a brake on a stuck button or a script, not on normal use. | `POST /api/platform/storage/optimize`<br>`POST /api/platform/storage/optimize/scan` |
| `secrets` | signed-in user (else address) | 30 per 10 min | Saving or revealing payment-gateway keys, SMS / WhatsApp connections, storage credentials and printer-agent tokens. They are rarely touched; a flood means something is wrong. | 18 routes (see the full list below) |
| `pii-read` | signed-in user (else address) | 120 per min | Looking up customers and their wallets by phone number. A person looks one up at a time; a loop is someone (or a stolen session) copying the customer list or trying phone numbers to see who has coins. | `GET /api/customers`<br>`GET /api/customers/:id/wallet`<br>`GET /api/orders/staff/customer`<br>`GET /api/orders/staff/customers` |
| `upload` | signed-in user (else address) | 60 per 10 min | Uploads write files to storage and cost bandwidth (images, menu imports, contact files). Stops a session filling the store's disk or bill. | `POST /api/marketing/contacts/parse`<br>`POST /api/menu/import`<br>`POST /api/platform/site/upload`<br>`PUT /api/qr-cards/design`<br>`POST /api/storage/upload`<br>`POST /api/whatsapp/media` |
| `report` | signed-in user (else address) | 120 per min | Analytics screens run aggregations over a store's whole order history. A person opening screens and changing filters stays well under two a second; a loop does not. | 20 routes (see the full list below) |
| `preview` | signed-in user (else address) | 30 per 10 min | Each live-preview session is kept in the server's memory for three hours; this stops a session being opened thousands of times to fill it. | `POST /api/preview` |
| `export` | signed-in user (else address) | 10 per min | Spreadsheet / PDF exports build a whole file in memory from many database rows — the most expensive requests the API serves. | `POST /api/analytics/export`<br>`GET /api/platform/onboarding/:id/pdf`<br>`POST /api/platform/server/folders/scan` |
| `outbound-fetch` | signed-in user (else address) | 30 per 10 min | Resolving a Google Maps short link makes the SERVER call out to the internet. Limited so it can't be used to probe or hammer other sites. | `POST /api/platform/onboarding/resolve-map`<br>`GET /api/platform/stores/:id/subdomain/status`<br>`GET /api/platform/subdomains/probe` |
| `bulk-send` | signed-in user (else address) | 20 per 10 min | Broadcasts, marketing campaigns and clean-ups message many customers at once. Sending to a customer list is also what gets a WhatsApp number banned, so it is deliberately slow. | `POST /api/marketing/campaigns`<br>`POST /api/marketing/campaigns/:id/cancel`<br>`POST /api/whatsapp/broadcasts`<br>`POST /api/whatsapp/cleanup`<br>`POST /api/whatsapp/distribute` |
| `chat-send` | signed-in user (else address) | 120 per min | Sending and retrying chat messages from the store's own WhatsApp number. (The WhatsApp worker also paces what actually goes out.) | `POST /api/whatsapp/chats`<br>`POST /api/whatsapp/chats/:id/messages`<br>`POST /api/whatsapp/chats/:id/messages/:messageId/retry` |
| `wa-link` | signed-in user (else address) | 30 per 10 min | Linking, relinking and unlinking WhatsApp numbers. Repeated linking attempts are what get a number logged out or banned. | `POST /api/whatsapp/accounts`<br>`DELETE /api/whatsapp/accounts/:id`<br>`POST /api/whatsapp/accounts/:id/relink`<br>`POST /api/whatsapp/accounts/:id/unlink` |
| `hardware` | signed-in user (else address) | 60 per min | Test prints, reprints and retries physically drive a printer in the restaurant. | `POST /api/printing/jobs/:id/reprint`<br>`POST /api/printing/jobs/:id/retry`<br>`POST /api/printing/orders/:orderId/print`<br>`POST /api/printing/printers/:id/test` |
| `destructive` | signed-in user (else address) | 20 per 10 min | Deleting an order, a chat, an outlet or a store (or switching a store off); publishing a client onboarding as a live store; creating stores. A stolen super-admin session can't wipe the platform at machine speed. | `POST /api/brands`<br>`POST /api/menu/categories/bulk-delete`<br>`POST /api/menu/items/bulk-delete`<br>`DELETE /api/orders/:id`<br>`DELETE /api/outlets/:id`<br>`POST /api/platform/onboarding/:id/publish`<br>`DELETE /api/platform/stores/:id`<br>`POST /api/platform/stores/:id/disable`<br>`POST /api/platform/stores/:id/enable`<br>`DELETE /api/platform/stores/:id/outlets/:outletId`<br>`DELETE /api/whatsapp/chats/:id`<br>`POST /api/whatsapp/chats/:id/clear` |
| `ws-connect` | visitor's address | 30 per min | Live-order and live-preview WebSocket connections: each one is a held-open socket. 30 new connections a minute per address (a few browser tabs reconnecting) is plenty. | the live-order connection `/realtime` and the live-preview connection `/preview` (WebSocket upgrades — not routes, so not in the route list) |

### Every route

| Method | Path | Limits |
|---|---|---|
| GET | `/api/analytics/cash` | `api`, `report` |
| GET | `/api/analytics/compare` | `api`, `report` |
| GET | `/api/analytics/customers` | `api`, `report` |
| POST | `/api/analytics/export` | `api`, `team-write`, `report`, `export` |
| GET | `/api/analytics/gst` | `api`, `report` |
| GET | `/api/analytics/items` | `api`, `report` |
| GET | `/api/analytics/operations` | `api`, `report` |
| GET | `/api/analytics/options` | `api`, `report` |
| GET | `/api/analytics/overview` | `api`, `report` |
| GET | `/api/analytics/pnl` | `api`, `report` |
| GET | `/api/analytics/profile` | `api`, `report` |
| PUT | `/api/analytics/profile` | `api`, `team-write`, `report` |
| GET | `/api/analytics/sales` | `api`, `report` |
| GET | `/api/analytics/stock` | `api`, `report` |
| GET | `/api/app-updates/apps` | `api`, `app-update-check` |
| GET | `/api/app-updates/check` | `api`, `app-update-check` |
| GET | `/api/app-updates/download/:id` | `api`, `app-download` |
| GET | `/api/app-updates/releases` | `api`, `app-update-check` |
| POST | `/api/auth/app-login` | `api`, `login-flood`, `login-account` |
| GET | `/api/auth/guard` | `api` |
| POST | `/api/auth/login` | `api`, `login-flood`, `login-account` |
| POST | `/api/auth/logout` | `api` |
| GET | `/api/auth/me` | `api` |
| GET | `/api/brands` | `api` |
| POST | `/api/brands` | `api`, `team-write`, `destructive` |
| GET | `/api/cart-reminders` | `api` |
| PUT | `/api/cart-reminders` | `api`, `team-write` |
| GET | `/api/coupons` | `api` |
| POST | `/api/coupons` | `api`, `team-write` |
| DELETE | `/api/coupons/:id` | `api`, `team-write` |
| PATCH | `/api/coupons/:id` | `api`, `team-write` |
| POST | `/api/coupons/apply` | `api`, `team-write`, `coupon-guess` |
| GET | `/api/coupons/public` | `api` |
| DELETE | `/api/customer/address` | `api`, `customer-account` |
| GET | `/api/customer/address` | `api` |
| PUT | `/api/customer/address` | `api`, `customer-account` |
| PUT | `/api/customer/cart` | `api`, `cart-sync` |
| GET | `/api/customer/cart/:id` | `api`, `public-compute` |
| GET | `/api/customer/guard` | `api` |
| POST | `/api/customer/logout` | `api`, `customer-account` |
| GET | `/api/customer/me` | `api` |
| GET | `/api/customer/orders` | `api`, `customer-orders` |
| DELETE | `/api/customer/orders/:id` | `api`, `customer-account` |
| GET | `/api/customer/orders/:id` | `api`, `order-tracking` |
| POST | `/api/customer/orders/:id/feedback` | `api`, `customer-feedback` |
| POST | `/api/customer/orders/:id/reorder` | `api`, `customer-orders` |
| POST | `/api/customer/otp/request` | `api`, `otp-send-ip`, `otp-send-store`, `otp-resend-number`, `otp-flood` |
| POST | `/api/customer/otp/verify` | `api`, `otp-flood` |
| PATCH | `/api/customer/profile` | `api`, `customer-account` |
| GET | `/api/customers` | `api`, `pii-read` |
| GET | `/api/customers/:id/wallet` | `api`, `pii-read` |
| GET | `/api/dashboard/stats` | `api` |
| POST | `/api/delivery/check` | `api`, `public-compute` |
| GET | `/api/delivery/origin` | `api` |
| GET | `/api/feedback` | `api` |
| GET | `/api/kitchen/items` | `api` |
| POST | `/api/kitchen/items/:id/availability` | `api`, `team-write` |
| GET | `/api/kitchen/orders` | `api` |
| POST | `/api/kitchen/orders/:id/stage` | `api`, `team-write` |
| GET | `/api/kitchen/summary` | `api` |
| POST | `/api/marketing/audience/preview` | `api`, `team-write` |
| GET | `/api/marketing/campaigns` | `api` |
| POST | `/api/marketing/campaigns` | `api`, `team-write`, `bulk-send` |
| GET | `/api/marketing/campaigns/:id` | `api` |
| POST | `/api/marketing/campaigns/:id/cancel` | `api`, `team-write`, `bulk-send` |
| GET | `/api/marketing/channels` | `api` |
| POST | `/api/marketing/contacts/parse` | `api`, `team-write`, `upload` |
| GET | `/api/marketing/lists` | `api` |
| POST | `/api/marketing/lists` | `api`, `team-write` |
| DELETE | `/api/marketing/lists/:id` | `api`, `team-write` |
| GET | `/api/marketing/lists/:id` | `api` |
| POST | `/api/marketing/lists/:id/contacts` | `api`, `team-write` |
| DELETE | `/api/marketing/lists/:id/contacts/:contactId` | `api`, `team-write` |
| GET | `/api/marketing/options` | `api` |
| GET | `/api/menu` | `api` |
| POST | `/api/menu/categories` | `api`, `team-write` |
| DELETE | `/api/menu/categories/:id` | `api`, `team-write` |
| PATCH | `/api/menu/categories/:id` | `api`, `team-write` |
| POST | `/api/menu/categories/bulk` | `api`, `team-write` |
| POST | `/api/menu/categories/bulk-delete` | `api`, `team-write`, `destructive` |
| POST | `/api/menu/categories/move` | `api`, `team-write` |
| POST | `/api/menu/categories/order` | `api`, `team-write` |
| POST | `/api/menu/import` | `api`, `team-write`, `upload` |
| POST | `/api/menu/items` | `api`, `team-write` |
| DELETE | `/api/menu/items/:id` | `api`, `team-write` |
| PATCH | `/api/menu/items/:id` | `api`, `team-write` |
| POST | `/api/menu/items/:id/generate-images` | `api`, `team-write`, `ai-images` |
| POST | `/api/menu/items/bulk-delete` | `api`, `team-write`, `destructive` |
| POST | `/api/menu/modifier-groups` | `api`, `team-write` |
| DELETE | `/api/menu/modifier-groups/:id` | `api`, `team-write` |
| PATCH | `/api/menu/modifier-groups/:id` | `api`, `team-write` |
| POST | `/api/menu/suggestions` | `api`, `team-write`, `public-compute` |
| GET | `/api/menu/unavailable` | `api` |
| GET | `/api/notify/config` | `api` |
| DELETE | `/api/notify/config/:channel` | `api`, `team-write`, `secrets` |
| PUT | `/api/notify/config/:channel` | `api`, `team-write`, `secrets` |
| GET | `/api/notify/logs` | `api` |
| GET | `/api/notify/messaging` | `api` |
| PUT | `/api/notify/messaging` | `api`, `team-write`, `secrets` |
| GET | `/api/orders` | `api` |
| POST | `/api/orders` | `api`, `team-write`, `order-place` |
| DELETE | `/api/orders/:id` | `api`, `team-write`, `destructive` |
| GET | `/api/orders/:id` | `api` |
| PATCH | `/api/orders/:id` | `api`, `team-write` |
| PATCH | `/api/orders/:id/rider` | `api`, `team-write` |
| PATCH | `/api/orders/:id/status` | `api`, `team-write` |
| PATCH | `/api/orders/:id/status/manual` | `api`, `team-write` |
| GET | `/api/orders/capacity` | `api`, `public-compute` |
| GET | `/api/orders/pickup-slots` | `api`, `public-compute` |
| POST | `/api/orders/quote` | `api`, `team-write`, `public-compute` |
| POST | `/api/orders/staff` | `api`, `team-write` |
| POST | `/api/orders/staff/coins-code` | `api`, `team-write`, `coins-code` |
| POST | `/api/orders/staff/coins-code/verify` | `api`, `team-write`, `coins-code` |
| GET | `/api/orders/staff/customer` | `api`, `pii-read` |
| GET | `/api/orders/staff/customers` | `api`, `pii-read` |
| POST | `/api/orders/staff/quote` | `api`, `team-write` |
| GET | `/api/outlets` | `api` |
| POST | `/api/outlets` | `api`, `team-write` |
| DELETE | `/api/outlets/:id` | `api`, `team-write`, `destructive` |
| GET | `/api/outlets/:id` | `api` |
| PATCH | `/api/outlets/:id` | `api`, `team-write` |
| PATCH | `/api/outlets/:id/config` | `api`, `team-write` |
| GET | `/api/outlets/for-host` | `api` |
| GET | `/api/outlets/resolve` | `api` |
| GET | `/api/pages` | `api` |
| POST | `/api/pages` | `api`, `team-write` |
| DELETE | `/api/pages/:id` | `api`, `team-write` |
| GET | `/api/pages/:id` | `api` |
| PATCH | `/api/pages/:id` | `api`, `team-write` |
| PUT | `/api/pages/order` | `api`, `team-write` |
| GET | `/api/pages/public` | `api` |
| GET | `/api/pages/public/:slug` | `api` |
| POST | `/api/pages/starter` | `api`, `team-write` |
| GET | `/api/payments/config` | `api` |
| DELETE | `/api/payments/config/:gateway` | `api`, `secrets` |
| PUT | `/api/payments/config/:gateway` | `api`, `secrets` |
| POST | `/api/payments/intent` | `api`, `payment` |
| GET | `/api/payments/order/:orderId` | `api` |
| POST | `/api/payments/verify` | `api`, `payment` |
| POST | `/api/payments/webhook/:gateway` | `api`, `webhook` |
| GET | `/api/platform/ai` | `api` |
| PUT | `/api/platform/ai` | `api`, `team-write`, `secrets` |
| POST | `/api/platform/ai/keys` | `api`, `team-write`, `secrets` |
| DELETE | `/api/platform/ai/keys/:id` | `api`, `team-write`, `secrets` |
| PATCH | `/api/platform/ai/keys/:id` | `api`, `team-write`, `secrets` |
| POST | `/api/platform/ai/keys/:id/test` | `api`, `team-write`, `secrets` |
| GET | `/api/platform/app-releases` | `api` |
| DELETE | `/api/platform/app-releases/:id` | `api`, `team-write` |
| PATCH | `/api/platform/app-releases/:id` | `api`, `team-write` |
| GET | `/api/platform/app-releases/settings` | `api` |
| PUT | `/api/platform/app-releases/settings/:app` | `api`, `team-write` |
| POST | `/api/platform/app-releases/uploads` | `api`, `team-write`, `release-upload` |
| PUT | `/api/platform/app-releases/uploads/:id/chunks/:index` | `api`, `team-write`, `release-upload` |
| POST | `/api/platform/app-releases/uploads/:id/complete` | `api`, `team-write`, `release-upload` |
| GET | `/api/platform/cache` | `api` |
| GET | `/api/platform/cache/entries` | `api` |
| GET | `/api/platform/cache/entry` | `api` |
| POST | `/api/platform/cache/expire` | `api`, `team-write` |
| PUT | `/api/platform/cache/settings` | `api`, `team-write` |
| GET | `/api/platform/dashboard` | `api` |
| GET | `/api/platform/login-logs` | `api` |
| GET | `/api/platform/onboarding` | `api` |
| POST | `/api/platform/onboarding` | `api`, `team-write` |
| DELETE | `/api/platform/onboarding/:id` | `api`, `team-write` |
| GET | `/api/platform/onboarding/:id` | `api` |
| PUT | `/api/platform/onboarding/:id` | `api`, `team-write` |
| GET | `/api/platform/onboarding/:id/check` | `api` |
| GET | `/api/platform/onboarding/:id/pdf` | `api`, `export` |
| POST | `/api/platform/onboarding/:id/publish` | `api`, `team-write`, `destructive` |
| GET | `/api/platform/onboarding/pricing` | `api` |
| PUT | `/api/platform/onboarding/pricing` | `api`, `team-write` |
| POST | `/api/platform/onboarding/resolve-map` | `api`, `team-write`, `outbound-fetch` |
| GET | `/api/platform/overview` | `api` |
| GET | `/api/platform/plans` | `api` |
| POST | `/api/platform/plans` | `api`, `team-write` |
| PATCH | `/api/platform/plans/:id` | `api`, `team-write` |
| DELETE | `/api/platform/security/blocks` | `api`, `team-write` |
| GET | `/api/platform/security/blocks` | `api` |
| DELETE | `/api/platform/security/blocks/:id` | `api`, `team-write` |
| GET | `/api/platform/server` | `api`, `report` |
| GET | `/api/platform/server/folders` | `api`, `report` |
| POST | `/api/platform/server/folders/scan` | `api`, `team-write`, `report`, `export` |
| GET | `/api/platform/server/health` | `api`, `report` |
| GET | `/api/platform/server/history` | `api`, `report` |
| GET | `/api/platform/server/processes` | `api`, `report` |
| GET | `/api/platform/settings` | `api` |
| PUT | `/api/platform/settings` | `api`, `team-write` |
| GET | `/api/platform/site/leads` | `api` |
| PATCH | `/api/platform/site/leads/:id` | `api`, `team-write` |
| GET | `/api/platform/site/pages` | `api` |
| POST | `/api/platform/site/pages` | `api`, `team-write` |
| DELETE | `/api/platform/site/pages/:id` | `api`, `team-write` |
| GET | `/api/platform/site/pages/:id` | `api` |
| PUT | `/api/platform/site/pages/:id` | `api`, `team-write` |
| POST | `/api/platform/site/pages/:id/duplicate` | `api`, `team-write` |
| GET | `/api/platform/site/pages/:id/preview-link` | `api` |
| GET | `/api/platform/site/settings` | `api` |
| PUT | `/api/platform/site/settings` | `api`, `team-write` |
| POST | `/api/platform/site/upload` | `api`, `team-write`, `upload` |
| DELETE | `/api/platform/storage` | `api`, `team-write`, `secrets` |
| GET | `/api/platform/storage` | `api` |
| PUT | `/api/platform/storage` | `api`, `team-write`, `secrets` |
| POST | `/api/platform/storage/adopt/:brandId` | `api`, `team-write`, `secrets` |
| GET | `/api/platform/storage/move` | `api` |
| POST | `/api/platform/storage/move` | `api`, `team-write`, `secrets` |
| POST | `/api/platform/storage/move/:id/cancel` | `api`, `team-write` |
| POST | `/api/platform/storage/move/preview` | `api`, `team-write`, `secrets` |
| GET | `/api/platform/storage/optimize` | `api` |
| POST | `/api/platform/storage/optimize` | `api`, `team-write`, `storage-heavy` |
| POST | `/api/platform/storage/optimize/:id/cancel` | `api`, `team-write` |
| GET | `/api/platform/storage/optimize/scan` | `api` |
| POST | `/api/platform/storage/optimize/scan` | `api`, `team-write`, `storage-heavy` |
| POST | `/api/platform/storage/test` | `api`, `team-write`, `secrets` |
| GET | `/api/platform/storage/usage` | `api` |
| POST | `/api/platform/storage/usage/scan` | `api`, `team-write`, `secrets` |
| GET | `/api/platform/stores` | `api` |
| DELETE | `/api/platform/stores/:id` | `api`, `team-write`, `destructive` |
| GET | `/api/platform/stores/:id` | `api` |
| PATCH | `/api/platform/stores/:id` | `api`, `team-write` |
| GET | `/api/platform/stores/:id/cache` | `api` |
| GET | `/api/platform/stores/:id/deletion-summary` | `api` |
| POST | `/api/platform/stores/:id/disable` | `api`, `team-write`, `destructive` |
| GET | `/api/platform/stores/:id/disable-summary` | `api` |
| PUT | `/api/platform/stores/:id/domains` | `api`, `team-write` |
| POST | `/api/platform/stores/:id/enable` | `api`, `team-write`, `destructive` |
| DELETE | `/api/platform/stores/:id/outlets/:outletId` | `api`, `team-write`, `destructive` |
| POST | `/api/platform/stores/:id/outlets/:outletId/block` | `api`, `team-write` |
| POST | `/api/platform/stores/:id/outlets/:outletId/unblock` | `api`, `team-write` |
| POST | `/api/platform/stores/:id/owners` | `api`, `team-write`, `account-write` |
| DELETE | `/api/platform/stores/:id/owners/:userId` | `api`, `team-write`, `account-write` |
| PATCH | `/api/platform/stores/:id/owners/:userId` | `api`, `team-write`, `account-write` |
| DELETE | `/api/platform/stores/:id/people/:userId` | `api`, `team-write`, `account-write` |
| POST | `/api/platform/stores/:id/people/:userId/block` | `api`, `team-write`, `account-write` |
| POST | `/api/platform/stores/:id/people/:userId/unblock` | `api`, `team-write`, `account-write` |
| PATCH | `/api/platform/stores/:id/plan` | `api`, `team-write` |
| DELETE | `/api/platform/stores/:id/subdomain` | `api`, `team-write` |
| PUT | `/api/platform/stores/:id/subdomain` | `api`, `team-write` |
| GET | `/api/platform/stores/:id/subdomain/status` | `api`, `outbound-fetch` |
| GET | `/api/platform/subdomains/check` | `api` |
| GET | `/api/platform/subdomains/probe` | `api`, `outbound-fetch` |
| POST | `/api/preview` | `api`, `team-write`, `preview` |
| GET | `/api/preview/:id` | `api` |
| GET | `/api/printing/agent/jobs` | `api`, `print-agent` |
| POST | `/api/printing/agent/jobs/:id/result` | `api`, `team-write`, `print-agent` |
| GET | `/api/printing/jobs` | `api` |
| POST | `/api/printing/jobs/:id/cancel` | `api`, `team-write` |
| POST | `/api/printing/jobs/:id/reprint` | `api`, `team-write`, `hardware` |
| POST | `/api/printing/jobs/:id/result` | `api`, `team-write` |
| POST | `/api/printing/jobs/:id/retry` | `api`, `team-write`, `hardware` |
| GET | `/api/printing/jobs/by-order` | `api` |
| POST | `/api/printing/jobs/claim` | `api`, `team-write` |
| POST | `/api/printing/orders/:orderId/print` | `api`, `team-write`, `hardware` |
| POST | `/api/printing/preview` | `api`, `team-write` |
| GET | `/api/printing/printers` | `api` |
| POST | `/api/printing/printers` | `api`, `team-write` |
| DELETE | `/api/printing/printers/:id` | `api`, `team-write` |
| PATCH | `/api/printing/printers/:id` | `api`, `team-write` |
| GET | `/api/printing/printers/:id/agent-token` | `api`, `secrets` |
| GET | `/api/printing/printers/:id/endpoint` | `api` |
| GET | `/api/printing/printers/:id/template` | `api` |
| POST | `/api/printing/printers/:id/test` | `api`, `team-write`, `hardware` |
| GET | `/api/printing/targets` | `api` |
| GET | `/api/printing/templates` | `api` |
| POST | `/api/printing/templates` | `api`, `team-write` |
| DELETE | `/api/printing/templates/:id` | `api`, `team-write` |
| PATCH | `/api/printing/templates/:id` | `api`, `team-write` |
| GET | `/api/qr-cards/design` | `api` |
| PUT | `/api/qr-cards/design` | `api`, `team-write`, `upload` |
| POST | `/api/qr-cards/design/reset` | `api`, `team-write` |
| GET | `/api/reservations` | `api` |
| POST | `/api/reservations` | `api`, `team-write`, `reservation-request` |
| PATCH | `/api/reservations/:id` | `api`, `team-write` |
| POST | `/api/reservations/:id/cancel` | `api`, `team-write`, `customer-account` |
| GET | `/api/reservations/availability` | `api`, `public-compute` |
| GET | `/api/reservations/mine` | `api`, `customer-orders` |
| POST | `/api/reservations/staff` | `api`, `team-write` |
| GET | `/api/reservations/summary` | `api` |
| GET | `/api/rider/deliveries` | `api` |
| POST | `/api/rider/deliveries/:id/delivered` | `api`, `rider-action` |
| POST | `/api/rider/deliveries/:id/pickup` | `api`, `rider-action` |
| POST | `/api/rider/login` | `api`, `login-flood`, `login-account` |
| POST | `/api/rider/logout` | `api`, `rider-action` |
| GET | `/api/rider/me` | `api` |
| GET | `/api/riders` | `api` |
| POST | `/api/riders` | `api`, `team-write` |
| DELETE | `/api/riders/:id` | `api`, `team-write` |
| PATCH | `/api/riders/:id` | `api`, `team-write` |
| DELETE | `/api/riders/:id/pin` | `api`, `team-write` |
| GET | `/api/riders/:id/pin` | `api`, `rider-pin-view` |
| PUT | `/api/riders/:id/pin` | `api`, `team-write` |
| GET | `/api/site/challenge` | `api`, `site-challenge` |
| POST | `/api/site/leads` | `api`, `site-lead` |
| GET | `/api/site/links` | `api` |
| GET | `/api/site/pages` | `api` |
| GET | `/api/site/pages/:slug` | `api` |
| GET | `/api/site/preview/:id` | `api` |
| GET | `/api/site/pricing` | `api` |
| GET | `/api/site/settings` | `api` |
| DELETE | `/api/storage/object` | `api`, `team-write` |
| POST | `/api/storage/upload` | `api`, `team-write`, `upload` |
| GET | `/api/store/plan` | `api` |
| GET | `/api/tables` | `api` |
| POST | `/api/tables` | `api`, `team-write` |
| DELETE | `/api/tables/:id` | `api`, `team-write` |
| PATCH | `/api/tables/:id` | `api`, `team-write` |
| GET | `/api/tables/:id/qr` | `api` |
| POST | `/api/tables/:id/qr/rotate` | `api`, `team-write` |
| POST | `/api/tables/claim` | `api`, `team-write`, `table-scan` |
| GET | `/api/tables/public` | `api`, `table-scan` |
| GET | `/api/tables/qr-urls` | `api` |
| GET | `/api/tables/scan/:tableId` | `api`, `table-scan` |
| POST | `/api/tables/scan/:tableId/session` | `api`, `team-write`, `table-scan` |
| POST | `/api/tables/sessions/:id/close` | `api`, `team-write` |
| POST | `/api/tables/sessions/:id/confirm-payment` | `api`, `team-write` |
| POST | `/api/tables/sessions/:id/move` | `api`, `team-write` |
| GET | `/api/tables/sessions/:id/tab` | `api`, `table-scan` |
| POST | `/api/tables/sessions/:id/void` | `api`, `team-write` |
| GET | `/api/tables/sessions/active` | `api` |
| GET | `/api/users` | `api` |
| POST | `/api/users` | `api`, `team-write`, `account-write` |
| DELETE | `/api/users/:id` | `api`, `team-write`, `account-write` |
| PATCH | `/api/users/:id` | `api`, `team-write`, `account-write` |
| GET | `/api/whatsapp/access` | `api` |
| PUT | `/api/whatsapp/access` | `api`, `team-write` |
| GET | `/api/whatsapp/accounts` | `api` |
| POST | `/api/whatsapp/accounts` | `api`, `team-write`, `wa-link` |
| DELETE | `/api/whatsapp/accounts/:id` | `api`, `team-write`, `wa-link` |
| GET | `/api/whatsapp/accounts/:id` | `api` |
| PATCH | `/api/whatsapp/accounts/:id` | `api`, `team-write` |
| POST | `/api/whatsapp/accounts/:id/relink` | `api`, `team-write`, `wa-link` |
| POST | `/api/whatsapp/accounts/:id/unlink` | `api`, `team-write`, `wa-link` |
| GET | `/api/whatsapp/broadcasts` | `api` |
| POST | `/api/whatsapp/broadcasts` | `api`, `team-write`, `bulk-send` |
| POST | `/api/whatsapp/broadcasts/:id/cancel` | `api`, `team-write` |
| GET | `/api/whatsapp/chats` | `api` |
| POST | `/api/whatsapp/chats` | `api`, `team-write`, `chat-send` |
| DELETE | `/api/whatsapp/chats/:id` | `api`, `team-write`, `destructive` |
| GET | `/api/whatsapp/chats/:id` | `api` |
| PATCH | `/api/whatsapp/chats/:id` | `api`, `team-write` |
| POST | `/api/whatsapp/chats/:id/clear` | `api`, `team-write`, `destructive` |
| GET | `/api/whatsapp/chats/:id/messages` | `api` |
| POST | `/api/whatsapp/chats/:id/messages` | `api`, `team-write`, `chat-send` |
| DELETE | `/api/whatsapp/chats/:id/messages/:messageId` | `api`, `team-write` |
| POST | `/api/whatsapp/chats/:id/messages/:messageId/retry` | `api`, `team-write`, `chat-send` |
| POST | `/api/whatsapp/chats/:id/read` | `api`, `team-write` |
| POST | `/api/whatsapp/cleanup` | `api`, `team-write`, `bulk-send` |
| POST | `/api/whatsapp/cleanup/preview` | `api`, `team-write` |
| POST | `/api/whatsapp/distribute` | `api`, `team-write`, `bulk-send` |
| POST | `/api/whatsapp/distribute/preview` | `api`, `team-write` |
| GET | `/api/whatsapp/me` | `api` |
| POST | `/api/whatsapp/media` | `api`, `team-write`, `upload` |
| GET | `/api/whatsapp/stats` | `api` |
| GET | `/health` | — |

Exempt from a limit of their own (still under `api`): `POST /api/auth/logout`.

<!-- generated:end -->

## What is deliberately not limited by its own policy

| Route | Why |
|---|---|
| `POST /api/auth/logout` | Ends the caller's own session — cheap, repeatable, nothing to protect. (It is still under the general `api` limit.) |
| `GET /health` | The server's own monitoring calls it from the same machine; it does no work worth limiting. |
| Public reads — menus, store pages, outlet lookups, coupons list | Cheap, cached, and called by the storefront for every visit. The general `api` limit is the floor; a stricter one would cut off real customers on a shared restaurant Wi-Fi. |
| `/uploads/…` (stored images) | Static files with a one-year cache header; nginx can serve them. |

## What can go wrong, and what to know

* **One process.** Counters are kept in the API process's memory (the same process serves everything today). If the API ever runs as several processes, each counts on its own; the counters would then need to move to the database or Redis. The sign-in guard and the code-resend waits are already kept in the database, so they are shared.
* **Shared addresses.** A restaurant's customers share one Wi-Fi address, so per-address limits are set well above what a busy room does (a dining room scanning QR codes at once; 15 code requests per 10 minutes). If a real venue ever hits one, raise `RATE_LIMIT_SCALE` rather than removing a limit.
* **The real visitor address needs the proxy to pass it.** nginx must send `X-Forwarded-For` (and, behind Cloudflare, restore the visitor's address from `CF-Connecting-IP`) — the same requirement as the sign-in guard. The API reads the first address outside our own network from the *right* of that header, so nothing a visitor writes in it lets them hide or borrow someone else's budget. If the proxy forgets, every visitor looks like one of our own servers: the address-based limits on this page switch themselves off, and the sign-in guard instead counts everyone as one address — so check this after any nginx change.
* **Payment gateways** call the webhook from their own servers, which speak for every merchant they have. The webhook limit is generous (4 a second per address); if the platform grows to many busy stores, raise it.
* **An attacker can still make an owner wait a few minutes** by typing the owner's email wrongly ten times (the account pause). That is the price of stopping distributed guessing; the pauses are 1, 5, 15 and 60 minutes, never a lock-out, and signing in clears the count.
* **In front of the app,** nginx can add a coarse `limit_req` per address as a second wall (it stops a flood before it reaches Node). This is not set up; the limits here are the application's own rules and work without it.

## Settings

| Variable | Default | What it does |
|---|---|---|
| `RATE_LIMITS` | `on` | `off` switches every limit in this page off (the sign-in guard has its own switch, `LOGIN_GUARD`). Only for a laptop. |
| `RATE_LIMIT_SCALE` | `1` | Multiplies every limit. `0.5` is twice as strict, `2` twice as loose. The way to tune without editing code. |
| `LOGIN_FLOOD_PER_MINUTE` | `30` | The sign-in burst limit (`login-flood`, `otp-flood`). |
| `LOGIN_MAX_FAILURES`, `LOGIN_BLOCK_STEPS_SECONDS`, … | see `env.js` | The per-address block after wrong passwords or codes. |

## Adding a route

1. Add it to its router as usual.
2. If it changes data, it is already under `team-write` when it belongs to a dashboard router (`TEAM_ROUTES` in `apps/api/src/app.js`). Public routes and anything costly need a specific limit: pick one from the table above (or add a policy to `POLICIES` with its reason) and put `limiter("name")` in front of the handler — **before** any body-reading middleware, so a refused caller can't use up bandwidth.
3. Run `node apps/api/src/scripts/route-inventory.js --write-doc` to refresh the tables here.
4. `node tests/e2e/run.mjs --only t28` fails if a route that changes data has no limit of its own, if a limit in the table is attached to nothing, or if this page doesn't mention a limit.
