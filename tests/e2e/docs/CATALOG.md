# Rasoi Pulse end-to-end tests — catalog

**83 tests** · 83 passing · 0 failing/error · 0 not run yet

| Test | Area | Result | Checks | Last run |
|---|---|---|---|---|
| [t00-bench-smoke](t00-bench-smoke.md) — Bench smoke test — API, dashboard and storefronts are alive with the fake stores | bench | ✅ PASSED | 11/11 | 2026-11-21 04:28 |
| [t01-takeaway-order](t01-takeaway-order.md) — Takeaway order of at least ₹999 — customer places it, staff take it all the way to Completed | orders | ✅ PASSED | 45/45 | 2026-11-21 04:29 |
| [t02-whatsapp-api](t02-whatsapp-api.md) — WhatsApp chat — API rules and the careful-pace sending worker | whatsapp | ✅ PASSED | 132/132 | 2026-11-21 13:07 |
| [t03-whatsapp-dashboard](t03-whatsapp-dashboard.md) — WhatsApp in the dashboard — chat window, numbers, broadcast, access and phone layout | whatsapp | ✅ PASSED | 44/44 | 2026-11-21 13:26 |
| [t04-whatsapp-manage](t04-whatsapp-manage.md) — WhatsApp management — colours, chat stats and sharing out, clean-up by date, delete a message | whatsapp | ✅ PASSED | 20/20 | 2026-11-21 04:30 |
| [t05-whatsapp-chat-filters](t05-whatsapp-chat-filters.md) — WhatsApp chat list — 'via' chips and filters (All, Unread, Needs reply, New, No offers, by number) | whatsapp | ✅ PASSED | 12/12 | 2026-11-21 04:30 |
| [t06-storefront-header-categories](t06-storefront-header-categories.md) — Storefront — favicon, steady message bar, Categories sheet on phone/tablet, delayed smooth scroll | storefront | ✅ PASSED | 28/28 | 2026-11-21 15:06 |
| [t07-favicon-plan-rules](t07-favicon-plan-rules.md) — Favicon — one per store, only when the plan (or a per-store override) includes it | plans | ✅ PASSED | 8/8 | 2026-11-21 13:10 |
| [t08-plans-outlets-settings](t08-plans-outlets-settings.md) — Plans & outlets — Basic → Pro upgrade, outlets 1-3 with menus, all outlet settings, delivery distance, load management | plans | ✅ PASSED | 44/44 | 2026-11-21 13:17 |
| [t09-store-subdomain](t09-store-subdomain.md) — Store subdomain — remove, create lifecycle.<base>, open every outlet on it, unknown addresses, rename | domains | ✅ PASSED | 36/36 | 2026-11-21 13:18 |
| [t10-plan-downgrade](t10-plan-downgrade.md) — Plan downgrade Pro → Basic — what stops, what keeps working, grace period, after the grace period, a manually disabled outlet | plans | ✅ PASSED | 38/38 | 2026-11-21 13:19 |
| [t11-outlet-delete](t11-outlet-delete.md) — Delete an outlet from the dashboard — protection for outlets with orders, then the deleted outlet on the subdomain | domains | ✅ PASSED | 13/13 | 2026-11-21 13:19 |
| [t12-store-delete](t12-store-delete.md) — Delete the store — typed-name confirmation, then the subdomain, the owner and the other stores | domains | ✅ PASSED | 19/19 | 2026-11-21 13:19 |
| [t13-marketing](t13-marketing.md) — Marketing — channels, audience filters (last visit, items, age, gender, order type, area), imports, lists, sending and the sidebar | marketing | ✅ PASSED | 70/70 | 2026-11-21 13:07 |
| [t14-marketing-plan](t14-marketing-plan.md) — Marketing is a plan feature — Basic doesn't have it, Pro does, and it can be unlocked or locked for one store | plans | ✅ PASSED | 16/16 | 2026-11-21 13:11 |
| [t15-login-protection](t15-login-protection.md) — Sign-in protection — wrong guesses block the network, blocks grow longer, a blocked network sees no login form, the platform can unblock | security | ✅ PASSED | 28/28 | 2026-11-21 13:10 |
| [t16-whatsapp-plan-gating](t16-whatsapp-plan-gating.md) — WhatsApp chat off (plan or per-store lock) — numbers unlinked at once, no WhatsApp requests, every WhatsApp address is a 404 | whatsapp | ✅ PASSED | 37/37 | 2026-11-21 13:12 |
| [t17-analytics](t17-analytics.md) — Analytics — sales, per-outlet graphs, compare outlets, best sellers + what to prepare, profit & loss, weekly/monthly/yearly exports, plan and role access | analytics | ✅ PASSED | 93/93 | 2026-11-21 13:26 |
| [t18-tables](t18-tables.md) — Tables — add a table (number, zone, seats), zones, limits and duplicates, QR panel, remove, per-outlet and per-store, who can manage | tables | ✅ PASSED | 54/54 | 2026-11-21 04:43 |
| [t19-dine-in](t19-dine-in.md) — Dine-in at a table — create tables, scan the QR, order onto a running tab, staff move / settle / void, occupied tables, rotated codes, switch-off | tables | ✅ PASSED | 54/54 | 2026-11-25 03:06 |
| [t20-missed-order-alerts](t20-missed-order-alerts.md) — Missed-order alerts — with the feature off nothing warns anyone; with it on: banner, red row, sound, repeat, per-status messages, roles, dashboard, customer | orders | ✅ PASSED | 75/75 | 2026-11-21 04:47 |
| [t21-onboarding](t21-onboarding.md) — Client onboarding form — plan first, plan-fit alerts and 'allow anyway', full form, save / reset / cancel, PDF + print, publish as store | onboarding | ✅ PASSED | 120/120 | 2026-11-21 13:21 |
| [t22-onboarding-price](t22-onboarding-price.md) — Onboarding price estimate — price list, plan + extras, Custom starts above the dearest plan, discount / GST / yearly, the Custom plan, plan dialog | onboarding | ✅ PASSED | 55/55 | 2026-11-21 13:22 |
| [t23-message-sending](t23-message-sending.md) — Message sending — codes by linked WhatsApp / WhatsApp Business / SMS, chosen by the owner | notifications | ✅ PASSED | 81/81 | 2026-11-21 13:23 |
| [t24-message-sending-api](t24-message-sending-api.md) — Message sending — API rules: codes by linked WhatsApp / WhatsApp Business / SMS, never stored, never shown, capped, plan-gated | notifications | ✅ PASSED | 61/61 | 2026-11-21 13:08 |
| [t25-otp-resend-api](t25-otp-resend-api.md) — Code resend rule — the API makes a number wait 30 s, 1 min, 2 min, 5 min, 15 min, 1 h, then 6 h between codes, however it is called | security | ✅ PASSED | 43/43 | 2026-11-21 13:08 |
| [t26-signin-resend-timer](t26-signin-resend-timer.md) — Sign-in code — resend timer on the screen (30 s first), kept by the server: Back, reload and direct API calls can't skip it | security | ✅ PASSED | 20/20 | 2026-11-21 13:24 |
| [t27-signin-codes-switch](t27-signin-codes-switch.md) — WhatsApp → Numbers has a 'Send sign-in codes from my WhatsApp numbers' switch; with several numbers each code leaves from a random one | notifications | ✅ PASSED | 21/21 | 2026-11-21 13:24 |
| [t28-rate-limits-api](t28-rate-limits-api.md) — Request limits — every protected API stops at its limit with a clear 429, per account sign-in guard, live connections, and nothing that changes data is left unprotected | security | ✅ PASSED | 124/124 | 2026-11-21 16:14 |
| [t29-orders-account-api](t29-orders-account-api.md) — Order history for the storefront Account page, and deleting an order — who may, what it puts right, where it disappears | orders | ✅ PASSED | 65/65 | 2026-11-25 03:06 |
| [t30-account-orders](t30-account-orders.md) — Storefront Account page — 'My orders' menu link, order history with status, payment mode & state, coins; Delete order on the dashboard | storefront | ✅ PASSED | 42/42 | 2026-11-21 14:26 |
| [t31-store-name-header](t31-store-name-header.md) — Storefront — the header and the big heading say the store's name; the outlet's name is only in the outlet dropdown | storefront | ✅ PASSED | 12/12 | 2026-11-21 13:13 |
| [t32-menu-tree-api](t32-menu-tree-api.md) — Menu categories inside categories — depth, moving, pictures, ordering, bulk delete of categories and items, import, and how the storefront builds its sections | menu | ✅ PASSED | 93/93 | 2026-11-21 13:08 |
| [t33-menu-tree](t33-menu-tree.md) — Menu — categories inside categories, category pictures, and multi-select delete for categories and items | menu | ✅ PASSED | 71/71 | 2026-11-21 15:07 |
| [t34-image-compression-api](t34-image-compression-api.md) — Pictures are compressed and optimised on the server when uploaded — size, shape, rotation, privacy, limits and settings | storage | ✅ PASSED | 32/32 | 2026-11-21 15:40 |
| [t35-storefront-category-bar](t35-storefront-category-bar.md) — Storefront — with 30+ categories the sticky category bar stays ONE short row that scrolls sideways, and phones keep one short bar with a Categories sheet | storefront | ✅ PASSED | 34/34 | 2026-11-26 10:38 |
| [t36-upload-urls-api](t36-upload-urls-api.md) — Pictures are stored without a domain and get the current domain when sent out — so a new domain or machine never breaks them | storage | ✅ PASSED | 28/28 | 2026-11-21 15:40 |
| [t37-storefront-mobile-layout](t37-storefront-mobile-layout.md) — Storefront — page side padding is smaller on phones and tablets (desktop unchanged); on phones a path title is two lines with a smaller View all button | storefront | ✅ PASSED | 45/45 | 2026-11-26 10:38 |
| [t38-ai-images-api](t38-ai-images-api.md) — AI dish pictures — several Gemini keys used in turn, only the super admin can use them, and what is made is saved to the dish | menu | ✅ PASSED | 88/88 | 2026-11-21 15:41 |
| [t39-ai-item-images](t39-ai-item-images.md) — AI dish pictures — keys added in the platform console, a sparkles button on the dish row (super admin only), shape and count chosen in a pop-up, pictures saved to the dish | menu | ✅ PASSED | 32/32 | 2026-11-21 04:55 |
| [t40-react-style-warnings](t40-react-style-warnings.md) — Storefront menu — no React warnings (e.g. "Removing a style property during rerender (borderColor) when a conflicting property is set (border)") while scrolling, filtering and expanding | storefront | ✅ PASSED | 4/4 | 2026-11-26 10:39 |
| [t41-storefront-view-all](t41-storefront-view-all.md) — Storefront View all — as configured from 720px wide up (tablets, narrow windows, desktops); under the cards and centred under 720px; the extra cards slide open and shut | storefront | ✅ PASSED | 85/85 | 2026-11-26 10:41 |
| [t42-storefront-order-type](t42-storefront-order-type.md) — Storefront — the Takeaway / Delivery choice (menu page and checkout) always shows both; one the outlet doesn't offer is shown greyed out and can't be chosen | storefront | ✅ PASSED | 39/39 | 2026-11-21 15:09 |
| [t43-checkout-coupons](t43-checkout-coupons.md) — Checkout — the coupon box is hidden when the platform locks Coupons for the store, and comes back when it is unlocked | storefront | ✅ PASSED | 10/10 | 2026-11-21 13:14 |
| [t44-website-product-menu](t44-website-product-menu.md) — Website header — the Product dropdown is wide, fits the window, and its hovered item is a soft rounded tile with a brand-filled icon (not a grey pill), in light and dark | website | ✅ PASSED | 53/53 | 2026-11-21 04:57 |
| [t45-paste-item-photo](t45-paste-item-photo.md) — Dish photos — a picture copied to the clipboard can be pasted (Ctrl/⌘+V or the 'Paste photo' button) instead of choosing a file | menu | ✅ PASSED | 21/21 | 2026-11-21 15:41 |
| [t46-addon-groups](t46-addon-groups.md) — Add-on groups — the list is multi-column (dish editor and the groups list) and a group can be edited after creation (name, option names and prices, add/remove options) | menu | ✅ PASSED | 50/50 | 2026-11-21 04:58 |
| [t47-storefront-pinned-bars](t47-storefront-pinned-bars.md) — Storefront — the header, the order bar (Takeaway/Delivery + outlet) and the category/filter bar stay pinned to the top while scrolling, on phone, tablet and desktop, with every header style | storefront | ✅ PASSED | 101/101 | 2026-11-26 10:43 |
| [t48-hero-button-card-c02](t48-hero-button-card-c02.md) — Storefront — no 'Order takeaway' button at the top; card C02 (Thumbnail left) shows the price right after the veg / non-veg mark with full-width title and description; every item card cuts its description at one line with an ellipsis | storefront | ✅ PASSED | 69/69 | 2026-11-26 10:39 |
| [t49-storefront-item-popup](t49-storefront-item-popup.md) — Storefront item pop-up — the picture is set in from the edges with rounded corners and has a close button; the name has the veg mark and the price; sizes and extras are tiles that light up; the Add row stays at the bottom while the choices scroll | storefront | ✅ PASSED | 42/42 | 2026-11-26 10:39 |
| [t50-store-name](t50-store-name.md) — Store name — the dashboard's Business identity shows the STORE name, always disabled, with a note to contact the Rasoi Pulse admin; only the platform admin can rename the store (console → Stores → the store); renaming an outlet changes its display name | settings | ✅ PASSED | 31/31 | 2026-11-21 05:00 |
| [t51-kot-tickets](t51-kot-tickets.md) — Kitchen tickets (KOT) — each dish goes to the right printer (kitchen / bar); an order edited after its ticket went out sends an 'ORDER CHANGED' ticket with only the difference; a cancelled order withdraws a waiting ticket or sends 'ORDER CANCELLED — DO NOT COOK' | printing | ✅ PASSED | 62/62 | 2026-11-21 05:01 |
| [t52-print-station-any-page](t52-print-station-any-page.md) — Print station — a computer switched on as a print station prints tickets from ANY dashboard page (Orders, Menu, Dashboard…), once, and only when it is switched on and the plan has Printing | printing | ✅ PASSED | 14/14 | 2026-11-21 13:27 |
| [t53-orders-growth-api](t53-orders-growth-api.md) — Orders that grow the business — out for delivery with a rider, pre-orders for later, stock counts, menu hours, combos and buy-X-get-Y coupons (API rules) | orders | ✅ PASSED | 84/84 | 2026-11-21 13:08 |
| [t54-engagement-api](t54-engagement-api.md) — Bringing customers back — table bookings, ratings, order again, suggestions and abandoned-cart reminders (API rules) | customers | ✅ PASSED | 89/89 | 2026-11-21 13:02 |
| [t55-growth-dashboard](t55-growth-dashboard.md) — Dashboard: pre-orders & bookings settings, riders, out for delivery, stock / combo / hours in the menu, buy-X-get-Y coupons, bookings, ratings and cart reminders | dashboard | ✅ PASSED | 26/26 | 2026-11-21 05:02 |
| [t56-growth-storefront](t56-growth-storefront.md) — Storefront: only N left, combos and dish hours on the menu, suggestions, a pre-order for later, rating an order, order again and booking a table | storefront | ✅ PASSED | 22/22 | 2026-11-21 15:12 |
| [t57-policy-pages](t57-policy-pages.md) — Pages for payment-gateway activation — About, Contact, Pricing, Privacy, Terms, Refunds, Delivery — and their links on the outlet picker | storefront | ✅ PASSED | 13/13 | 2026-11-21 14:25 |
| [t58-item-image-shapes-api](t58-item-image-shapes-api.md) — Dish pictures in four shapes — square (default), landscape 4:3, wide 16:9, portrait 3:4 — stored, limited and chosen per card; existing square pictures untouched | menu | ✅ PASSED | 31/31 | 2026-11-21 13:09 |
| [t59-item-image-shapes-ui](t59-item-image-shapes-ui.md) — Dish photos in four shapes — the dish form's four sections (upload, replace, trim warning, paste into the chosen one, remove) and the picture each card style shows | menu | ✅ PASSED | 45/45 | 2026-11-21 15:12 |
| [t60-store-address](t60-store-address.md) — Super admin inside a store — every page is at /store/<store-name>/<store-id>/…; the store owner keeps the plain addresses | platform | ✅ PASSED | 18/18 | 2026-11-21 13:14 |
| [t61-item-form-modal](t61-item-form-modal.md) — Edit / New item is a pop-up — fixed Save and Cancel footer, scrolling body, Esc closes — and photos are saved as they change | menu | ✅ PASSED | 40/40 | 2026-11-21 05:03 |
| [t62-food-mark](t62-food-mark.md) — The veg / non-veg mark — the dot is exactly centred in its frame on the storefront and in Take order | storefront | ✅ PASSED | 9/9 | 2026-11-21 05:03 |
| [t63-card-picture-shape](t63-card-picture-shape.md) — C07 uses the wide 16:9 picture — and Appearance has a Picture shape field per card style that resets on a new card and can be overridden | storefront | ✅ PASSED | 30/30 | 2026-11-21 15:12 |
| [t64-table-conflict](t64-table-conflict.md) — Two staff taking an order for the same table — the second is told the table is no longer free and can move the order to a free table | tables | ✅ PASSED | 22/22 | 2026-11-25 03:06 |
| [t65-kitchen-display](t65-kitchen-display.md) — Kitchen display (/kitchen) — orders by station, Start / Ready, late colours, and the waiter's bell (off by default) | kitchen | ✅ PASSED | 43/43 | 2026-11-21 13:14 |
| [t66-ops-batch](t66-ops-batch.md) — Completed dine-in order frees the table (no Needs cleaning) · phone layouts · platform live-updates switch · print station every 8 s with check, loader and countdown | operations | ✅ PASSED | 47/47 | 2026-11-21 13:04 |
| [t67-order-tracking-api](t67-order-tracking-api.md) — Following an order — the tracking API, lateness, cancelling an order nobody accepts, and error messages that name the box | orders | ✅ PASSED | 50/50 | 2026-11-21 12:59 |
| [t68-order-tracking-ui](t68-order-tracking-ui.md) — Following an order on the storefront — a page that moves by itself, links from Order placed and Account, cancelled, someone else's link, a phone | storefront | ✅ PASSED | 23/23 | 2026-11-21 15:12 |
| [t69-cache-audit-api](t69-cache-audit-api.md) — Cache audit — what is remembered is dropped the moment it changes; orders, tables and bookings are always read live | platform | ✅ PASSED | 55/55 | 2026-11-21 12:59 |
| [t70-cache-console-ui](t70-cache-console-ui.md) — Cache page store by store — see what each store has remembered and clear one store's cache | platform | ✅ PASSED | 12/12 | 2026-11-21 13:05 |
| [t71-soft-navigation](t71-soft-navigation.md) — Storefront links move between pages without reloading the app (header, Order button, footer pages, message bar, phone menu) | storefront | ✅ PASSED | 14/14 | 2026-11-25 03:06 |
| [t72-menu-chunks](t72-menu-chunks.md) — The storefront menu is drawn in chunks as the diner scrolls | storefront | ✅ PASSED | 15/15 | 2026-11-26 10:40 |
| [t73-reorder-notice](t73-reorder-notice.md) — 'Order again' says clearly which dishes couldn't be added, with space below | storefront | ✅ PASSED | 9/9 | 2026-11-21 15:05 |
| [t74-storage-api](t74-storage-api.md) — Storage — try any storage without switching it on, count what is stored where, and move the files between this server's disk and S3-compatible buckets | platform | ✅ PASSED | 65/65 | 2026-11-21 16:14 |
| [t75-storage-tools-ui](t75-storage-tools-ui.md) — The Storage page — Test connection under the list, files per store and outlet, move files with progress | platform | ✅ PASSED | 31/31 | 2026-11-21 16:14 |
| [t76-storage-optimize-api](t76-storage-optimize-api.md) — Storage — find the pictures bigger than the size limit and compress the chosen ones; every stored address follows | platform | ✅ PASSED | 73/73 | 2026-11-21 16:14 |
| [t77-storage-optimize-ui](t77-storage-optimize-ui.md) — The Storage page — find the pictures bigger than the size limit in a grid, select them and optimize | platform | ✅ PASSED | 37/37 | 2026-11-21 16:15 |
| [t78-storefront-title](t78-storefront-title.md) — The storefront's browser-tab title is the store's name (and follows a rename) | storefront | ✅ PASSED | 16/16 | 2026-11-26 10:40 |
| [t79-stored-secrets](t79-stored-secrets.md) — Stored secrets stay readable — a secret locked before the Rasoi Pulse rename still opens, and old and new builds read each other's secrets | security | ✅ PASSED | 6/6 | 2026-11-25 09:43 |
| [t80-sold-out-last-and-view-all](t80-sold-out-last-and-view-all.md) — Menu: sold-out dishes go to the end of their category, and 'View all' disappears when a filter leaves only a few dishes | storefront | ✅ PASSED | 28/28 | 2026-11-26 10:41 |
| [t81-storefront-card-columns](t81-storefront-card-columns.md) — Menu cards resize with the screen (70–120% of their natural width) and the number per row follows — '3 a row' is only a maximum, nothing is cut off, squeezed or on top of another | storefront | ✅ PASSED | 449/449 | 2026-11-26 10:37 |
| [t82-storefront-nav-progress](t82-storefront-nav-progress.md) — A thin progress bar across the top of the storefront while the page changes — starts at once, creeps, finishes and fades when the page arrives, ignores taps that go nowhere, gives up if nothing comes | storefront | ✅ PASSED | 34/34 | 2026-11-26 10:40 |

## Open findings (noticed during tests, not yet fixed)

- **t01-takeaway-order** — The customer has NO order-tracking page: their confirmation screen never moves past “Order #… placed”, even when the order is Ready. Progress only reaches them through WhatsApp/SMS alerts, which are off by default. (GET /api/orders/:id already lets a signed-in customer read their own order, so a tracking page is feasible.)
- **t18-tables** — A refused table (too long a number, too many seats) says only 'Validation failed' — it doesn't say which box is wrong.
- **t18-tables** — Typing 0 (or nothing) as the seats quietly saves 4 seats instead of saying 0 isn't allowed.
- **t18-tables** — 'T9' and 't9' count as different tables — two tables that look alike to a person can both exist.
- **t20-missed-order-alerts** — Missed-order alerts: a limit over 240 minutes is refused with only 'Validation failed' — it doesn't say which box or what the maximum is.
- **t20-missed-order-alerts** — A missed order is never escalated: nobody is messaged and it is not cancelled — the only signs are the Orders screen alerts and the dashboard's 'Missed orders'.
- **t20-missed-order-alerts** — The customer has no way to see that their order is waiting or late — their confirmation never changes (see also T01: there is no order-tracking page).

## How to run

```
cd tests/e2e
npm install                      # once
node run.mjs                     # every test, headless, ~minutes
node run.mjs --visible           # watch it in a full-size Chrome window
node run.mjs --only t01 --visible
node run.mjs --docs-only         # rebuild these pages from the saved results
```

See [README](../README.md) for the rules and for how to add a test.
