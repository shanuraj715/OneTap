# TablePe end-to-end tests — catalog

**42 tests** · 42 passing · 0 failing/error · 0 not run yet

| Test | Area | Result | Checks | Last run |
|---|---|---|---|---|
| [t00-bench-smoke](t00-bench-smoke.md) — Bench smoke test — API, dashboard and storefronts are alive with the fake stores | bench | ✅ PASSED | 11/11 | 2026-11-19 12:21 |
| [t01-takeaway-order](t01-takeaway-order.md) — Takeaway order of at least ₹999 — customer places it, staff take it all the way to Completed | orders | ✅ PASSED | 45/45 | 2026-11-19 22:50 |
| [t02-whatsapp-api](t02-whatsapp-api.md) — WhatsApp chat — API rules and the careful-pace sending worker | whatsapp | ✅ PASSED | 131/131 | 2026-11-19 19:28 |
| [t03-whatsapp-dashboard](t03-whatsapp-dashboard.md) — WhatsApp in the dashboard — chat window, numbers, broadcast, access and phone layout | whatsapp | ✅ PASSED | 44/44 | 2026-11-19 12:22 |
| [t04-whatsapp-manage](t04-whatsapp-manage.md) — WhatsApp management — colours, chat stats and sharing out, clean-up by date, delete a message | whatsapp | ✅ PASSED | 20/20 | 2026-11-19 12:23 |
| [t05-whatsapp-chat-filters](t05-whatsapp-chat-filters.md) — WhatsApp chat list — 'via' chips and filters (All, Unread, Needs reply, New, No offers, by number) | whatsapp | ✅ PASSED | 12/12 | 2026-11-19 12:23 |
| [t06-storefront-header-categories](t06-storefront-header-categories.md) — Storefront — favicon, steady message bar, Categories sheet on phone/tablet, delayed smooth scroll | storefront | ✅ PASSED | 28/28 | 2026-11-19 22:51 |
| [t07-favicon-plan-rules](t07-favicon-plan-rules.md) — Favicon — one per store, only when the plan (or a per-store override) includes it | plans | ✅ PASSED | 8/8 | 2026-11-19 17:49 |
| [t08-plans-outlets-settings](t08-plans-outlets-settings.md) — Plans & outlets — Basic → Pro upgrade, outlets 1-3 with menus, all outlet settings, delivery distance, load management | plans | ✅ PASSED | 42/42 | 2026-11-19 13:32 |
| [t09-store-subdomain](t09-store-subdomain.md) — Store subdomain — remove, create lifecycle.<base>, open every outlet on it, unknown addresses, rename | domains | ✅ PASSED | 36/36 | 2026-11-19 13:33 |
| [t10-plan-downgrade](t10-plan-downgrade.md) — Plan downgrade Pro → Basic — what stops, what keeps working, grace period, after the grace period, a manually disabled outlet | plans | ✅ PASSED | 37/37 | 2026-11-19 13:35 |
| [t11-outlet-delete](t11-outlet-delete.md) — Delete an outlet from the dashboard — protection for outlets with orders, then the deleted outlet on the subdomain | domains | ✅ PASSED | 13/13 | 2026-11-19 13:35 |
| [t12-store-delete](t12-store-delete.md) — Delete the store — typed-name confirmation, then the subdomain, the owner and the other stores | domains | ✅ PASSED | 19/19 | 2026-11-19 13:35 |
| [t13-marketing](t13-marketing.md) — Marketing — channels, audience filters (last visit, items, age, gender, order type, area), imports, lists, sending and the sidebar | marketing | ✅ PASSED | 70/70 | 2026-11-19 13:17 |
| [t14-marketing-plan](t14-marketing-plan.md) — Marketing is a plan feature — Basic doesn't have it, Pro does, and it can be unlocked or locked for one store | plans | ✅ PASSED | 16/16 | 2026-11-19 13:18 |
| [t15-login-protection](t15-login-protection.md) — Sign-in protection — wrong guesses block the network, blocks grow longer, a blocked network sees no login form, the platform can unblock | security | ✅ PASSED | 28/28 | 2026-11-19 12:33 |
| [t16-whatsapp-plan-gating](t16-whatsapp-plan-gating.md) — WhatsApp chat off (plan or per-store lock) — numbers unlinked at once, no WhatsApp requests, every WhatsApp address is a 404 | whatsapp | ✅ PASSED | 37/37 | 2026-11-19 12:34 |
| [t17-analytics](t17-analytics.md) — Analytics — sales, per-outlet graphs, compare outlets, best sellers + what to prepare, profit & loss, weekly/monthly/yearly exports, plan and role access | analytics | ✅ PASSED | 93/93 | 2026-11-19 12:56 |
| [t18-tables](t18-tables.md) — Tables — add a table (number, zone, seats), zones, limits and duplicates, QR panel, remove, per-outlet and per-store, who can manage | tables | ✅ PASSED | 54/54 | 2026-11-19 18:11 |
| [t19-dine-in](t19-dine-in.md) — Dine-in at a table — create tables, scan the QR, order onto a running tab, staff move / settle / void, occupied tables, rotated codes, switch-off | tables | ✅ PASSED | 55/55 | 2026-11-19 22:52 |
| [t20-missed-order-alerts](t20-missed-order-alerts.md) — Missed-order alerts — with the feature off nothing warns anyone; with it on: banner, red row, sound, repeat, per-status messages, roles, dashboard, customer | orders | ✅ PASSED | 74/74 | 2026-11-19 13:00 |
| [t21-onboarding](t21-onboarding.md) — Client onboarding form — plan first, plan-fit alerts and 'allow anyway', full form, save / reset / cancel, PDF + print, publish as store | onboarding | ✅ PASSED | 120/120 | 2026-11-19 12:41 |
| [t22-onboarding-price](t22-onboarding-price.md) — Onboarding price estimate — price list, plan + extras, Custom starts above the dearest plan, discount / GST / yearly, the Custom plan, plan dialog | onboarding | ✅ PASSED | 55/55 | 2026-11-19 12:41 |
| [t23-message-sending](t23-message-sending.md) — Message sending — codes by linked WhatsApp / WhatsApp Business / SMS, chosen by the owner | notifications | ✅ PASSED | 81/81 | 2026-11-19 13:19 |
| [t24-message-sending-api](t24-message-sending-api.md) — Message sending — API rules: codes by linked WhatsApp / WhatsApp Business / SMS, never stored, never shown, capped, plan-gated | notifications | ✅ PASSED | 61/61 | 2026-11-19 12:43 |
| [t25-otp-resend-api](t25-otp-resend-api.md) — Code resend rule — the API makes a number wait 30 s, 1 min, 2 min, 5 min, 15 min, 1 h, then 6 h between codes, however it is called | security | ✅ PASSED | 41/41 | 2026-11-19 12:43 |
| [t26-signin-resend-timer](t26-signin-resend-timer.md) — Sign-in code — resend timer on the screen (30 s first), kept by the server: Back, reload and direct API calls can't skip it | security | ✅ PASSED | 20/20 | 2026-11-19 13:02 |
| [t27-signin-codes-switch](t27-signin-codes-switch.md) — WhatsApp → Numbers has a 'Send sign-in codes from my WhatsApp numbers' switch; with several numbers each code leaves from a random one | notifications | ✅ PASSED | 21/21 | 2026-11-19 13:03 |
| [t28-rate-limits-api](t28-rate-limits-api.md) — Request limits — every protected API stops at its limit with a clear 429, per account sign-in guard, live connections, and nothing that changes data is left unprotected | security | ✅ PASSED | 124/124 | 2026-11-19 19:29 |
| [t29-orders-account-api](t29-orders-account-api.md) — Order history for the storefront Account page, and deleting an order — who may, what it puts right, where it disappears | orders | ✅ PASSED | 63/63 | 2026-11-19 17:49 |
| [t30-account-orders](t30-account-orders.md) — Storefront Account page — 'My orders' menu link, order history with status, payment mode & state, coins; Delete order on the dashboard | storefront | ✅ PASSED | 41/41 | 2026-11-19 22:53 |
| [t31-store-name-header](t31-store-name-header.md) — Storefront — the header and the big heading say the store's name; the outlet's name is only in the outlet dropdown | storefront | ✅ PASSED | 12/12 | 2026-11-19 18:13 |
| [t32-menu-tree-api](t32-menu-tree-api.md) — Menu categories inside categories — depth, moving, pictures, ordering, bulk delete of categories and items, import, and how the storefront builds its sections | menu | ✅ PASSED | 93/93 | 2026-11-19 19:29 |
| [t33-menu-tree](t33-menu-tree.md) — Menu — categories inside categories, category pictures, and multi-select delete for categories and items | menu | ✅ PASSED | 71/71 | 2026-11-19 22:42 |
| [t34-image-compression-api](t34-image-compression-api.md) — Pictures are compressed and optimised on the server when uploaded — size, shape, rotation, privacy, limits and settings | storage | ✅ PASSED | 32/32 | 2026-11-19 19:30 |
| [t35-storefront-category-bar](t35-storefront-category-bar.md) — Storefront — with 30+ categories the sticky category bar stays ONE short row that scrolls sideways, and phones keep one short bar with a Categories sheet | storefront | ✅ PASSED | 34/34 | 2026-11-19 22:53 |
| [t36-upload-urls-api](t36-upload-urls-api.md) — Pictures are stored without a domain and get the current domain when sent out — so a new domain or machine never breaks them | storage | ✅ PASSED | 28/28 | 2026-11-19 19:31 |
| [t37-storefront-mobile-layout](t37-storefront-mobile-layout.md) — Storefront — page side padding is smaller on phones and tablets (desktop unchanged); on phones a path title is two lines with a smaller View all button | storefront | ✅ PASSED | 45/45 | 2026-11-19 22:53 |
| [t38-ai-images-api](t38-ai-images-api.md) — AI dish pictures — several Gemini keys used in turn, only the super admin can use them, and what is made is saved to the dish | menu | ✅ PASSED | 82/82 | 2026-11-19 19:46 |
| [t39-ai-item-images](t39-ai-item-images.md) — AI dish pictures — keys added in the platform console, a sparkles button on the dish row (super admin only), shape and count chosen in a pop-up, pictures saved to the dish | menu | ✅ PASSED | 32/32 | 2026-11-19 19:47 |
| [t40-react-style-warnings](t40-react-style-warnings.md) — Storefront menu — no React warnings (e.g. "Removing a style property during rerender (borderColor) when a conflicting property is set (border)") while scrolling, filtering and expanding | storefront | ✅ PASSED | 4/4 | 2026-11-19 22:54 |
| [t41-storefront-view-all](t41-storefront-view-all.md) — Storefront View all — as configured on a wide screen; under the cards and centred on phones and tablets (portrait and landscape); the extra cards slide open and shut | storefront | ✅ PASSED | 64/64 | 2026-11-19 22:55 |

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
