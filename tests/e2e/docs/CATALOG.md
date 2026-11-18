# TablePe end-to-end tests — catalog

**23 tests** · 23 passing · 0 failing/error · 0 not run yet

| Test | Area | Result | Checks | Last run |
|---|---|---|---|---|
| [t00-bench-smoke](t00-bench-smoke.md) — Bench smoke test — API, dashboard and storefronts are alive with the fake stores | bench | ✅ PASSED | 11/11 | 2026-11-18 17:28 |
| [t01-takeaway-order](t01-takeaway-order.md) — Takeaway order of at least ₹999 — customer places it, staff take it all the way to Completed | orders | ✅ PASSED | 45/45 | 2026-11-18 17:29 |
| [t02-whatsapp-api](t02-whatsapp-api.md) — WhatsApp chat — API rules and the careful-pace sending worker | whatsapp | ✅ PASSED | 132/132 | 2026-11-18 17:29 |
| [t03-whatsapp-dashboard](t03-whatsapp-dashboard.md) — WhatsApp in the dashboard — chat window, numbers, broadcast, access and phone layout | whatsapp | ✅ PASSED | 44/44 | 2026-11-18 17:29 |
| [t04-whatsapp-manage](t04-whatsapp-manage.md) — WhatsApp management — colours, chat stats and sharing out, clean-up by date, delete a message | whatsapp | ✅ PASSED | 20/20 | 2026-11-18 17:30 |
| [t05-whatsapp-chat-filters](t05-whatsapp-chat-filters.md) — WhatsApp chat list — 'via' chips and filters (All, Unread, Needs reply, New, No offers, by number) | whatsapp | ✅ PASSED | 12/12 | 2026-11-18 17:30 |
| [t06-storefront-header-categories](t06-storefront-header-categories.md) — Storefront — favicon, steady message bar, Categories sheet on phone/tablet, delayed smooth scroll | storefront | ✅ PASSED | 28/28 | 2026-11-18 17:31 |
| [t07-favicon-plan-rules](t07-favicon-plan-rules.md) — Favicon — one per store, only when the plan (or a per-store override) includes it | plans | ✅ PASSED | 8/8 | 2026-11-18 17:31 |
| [t08-plans-outlets-settings](t08-plans-outlets-settings.md) — Plans & outlets — Basic → Pro upgrade, outlets 1-3 with menus, all outlet settings, delivery distance, load management | plans | ✅ PASSED | 42/42 | 2026-11-18 17:34 |
| [t09-store-subdomain](t09-store-subdomain.md) — Store subdomain — remove, create lifecycle.<base>, open every outlet on it, unknown addresses, rename | domains | ✅ PASSED | 36/36 | 2026-11-18 17:34 |
| [t10-plan-downgrade](t10-plan-downgrade.md) — Plan downgrade Pro → Basic — what stops, what keeps working, grace period, after the grace period, a manually disabled outlet | plans | ✅ PASSED | 37/37 | 2026-11-18 17:36 |
| [t11-outlet-delete](t11-outlet-delete.md) — Delete an outlet from the dashboard — protection for outlets with orders, then the deleted outlet on the subdomain | domains | ✅ PASSED | 13/13 | 2026-11-18 17:36 |
| [t12-store-delete](t12-store-delete.md) — Delete the store — typed-name confirmation, then the subdomain, the owner and the other stores | domains | ✅ PASSED | 19/19 | 2026-11-18 17:37 |
| [t13-marketing](t13-marketing.md) — Marketing — channels, audience filters (last visit, items, age, gender, order type, area), imports, lists, sending and the sidebar | marketing | ✅ PASSED | 70/70 | 2026-11-18 17:38 |
| [t14-marketing-plan](t14-marketing-plan.md) — Marketing is a plan feature — Basic doesn't have it, Pro does, and it can be unlocked or locked for one store | plans | ✅ PASSED | 16/16 | 2026-11-18 17:40 |
| [t15-login-protection](t15-login-protection.md) — Sign-in protection — wrong guesses block the network, blocks grow longer, a blocked network sees no login form, the platform can unblock | security | ✅ PASSED | 28/28 | 2026-11-18 17:40 |
| [t16-whatsapp-plan-gating](t16-whatsapp-plan-gating.md) — WhatsApp chat off (plan or per-store lock) — numbers unlinked at once, no WhatsApp requests, every WhatsApp address is a 404 | whatsapp | ✅ PASSED | 37/37 | 2026-11-18 17:41 |
| [t17-analytics](t17-analytics.md) — Analytics — sales, per-outlet graphs, compare outlets, best sellers + what to prepare, profit & loss, weekly/monthly/yearly exports, plan and role access | analytics | ✅ PASSED | 93/93 | 2026-11-18 17:42 |
| [t18-tables](t18-tables.md) — Tables — add a table (number, zone, seats), zones, limits and duplicates, QR panel, remove, per-outlet and per-store, who can manage | tables | ✅ PASSED | 54/54 | 2026-11-18 17:43 |
| [t19-dine-in](t19-dine-in.md) — Dine-in at a table — create tables, scan the QR, order onto a running tab, staff move / settle / void, occupied tables, rotated codes, switch-off | tables | ✅ PASSED | 55/55 | 2026-11-18 17:44 |
| [t20-missed-order-alerts](t20-missed-order-alerts.md) — Missed-order alerts — with the feature off nothing warns anyone; with it on: banner, red row, sound, repeat, per-status messages, roles, dashboard, customer | orders | ✅ PASSED | 74/74 | 2026-11-18 17:47 |
| [t21-onboarding](t21-onboarding.md) — Client onboarding form — plan first, plan-fit alerts and 'allow anyway', full form, save / reset / cancel, PDF + print, publish as store | onboarding | ✅ PASSED | 120/120 | 2026-11-18 17:53 |
| [t22-onboarding-price](t22-onboarding-price.md) — Onboarding price estimate — price list, plan + extras, Custom starts above the dearest plan, discount / GST / yearly, the Custom plan, plan dialog | onboarding | ✅ PASSED | 55/55 | 2026-11-18 17:56 |

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
