# Security review — platform roles, the Admin app and the dependency audit (2026-11-27)

Scope: the new **platform roles** (who may do what in the console and the Admin app), the **Admin app's sign-in**, the new **live connection** for the staff apps, the **log redaction**, and a
**dependency audit** of the whole workspace. Everything below is covered by a saved test unless it says otherwise.

## What was checked, and the result

| Area | Check | Result | Test |
|---|---|---|---|
| Authorization | Every `/api/platform/*` route is matched by a rule in `platform-access.js`; an unmatched route is closed to everyone but the super admin | 97 routes, all decided | t121 §10 |
| Authorization | A team member with only "Onboarding" gets 403 on 33 other platform requests, the store list, creating a store, the website pages and enquiries | holds | t121 §3 |
| Authorization | Role change / person switched off / new password take effect on the next request (no stale sign-in cache) | holds | t121 §4, §8 |
| Privilege escalation | Mass assignment (`isSuperAdmin`, `memberships` in a team PATCH) is ignored; the super admin and restaurant staff are unreachable through `/team` (404) | holds | t121 §8 |
| Isolation | Restaurant owners get 403 on the platform API and on the Admin app; team members get 403 on every restaurant route (no membership) | holds | t121 §3, §6, §7 |
| Injection | Every id is checked against an ObjectId pattern before a query; names/emails come through zod strings (no operators can be smuggled in) | holds | t121 §2 |
| Secrets in logs | Session cookie, `Authorization`, the website / agent / site secrets and `Set-Cookie` are `[hidden]` in the API's request log; test fails without the fix | fixed | t119 |
| Passwords | 10+ characters, letters and a number for team accounts; only a hash is stored or returned; never in the activity log | holds | t121 §2, §9 |
| Brute force | Team members sign in through the same guarded sign-in (per address, per account, flood limit) | unchanged | t87, t28 |
| Audit trail | Roles and people changes are logged (who, what; no passwords); only the super admin can read it | holds | t121 §9 |
| Live connection | The apps' WebSocket runs the same role / outlet / store-disabled checks as their ordinary calls; apps receive only "something changed", never data; connections are re-checked every 5 minutes and cut when signed out or switched off | holds | t120 |
| Rate limits | New write routes use the `account-write` policy; the doc `docs/api-rate-limiting.md` is regenerated | holds | t28 |

## Known gaps (not fixed here — decisions for the owner)

* **No second factor.** A team member who can change stores is as powerful as their password. Recommended next: TOTP for roles that hold Stores/Plans/Storage/AI/Security.
* **Passwords are set by the super admin and told to the person**; there is no "change my password" screen for a team member yet.
* **Sessions last 14 days** (like every dashboard sign-in) and one person may have several; switching a person off or a new password ends all of them.
* **The Admin app is not in the update channel** (no forced updates for a security fix): a new APK has to be installed by hand.

## Dependency audit (`pnpm audit --prod`, 2026-11-27)

**Before: 22 known issues (2 critical, 9 high, 11 moderate). After: 2 (1 high, 1 moderate), none critical.** Nothing in the first list was introduced by the work above.

| Package | Issue | What was done |
|---|---|---|
| `next` (storefront, website) | critical remote code execution through the image-optimisation API with SVG files; Server Actions denial of service; cache poisoning of SSG/ISR pages (5 more) | `^15.1.3` → `^15.5.29` (installed 15.5.29) |
| `proxy-addr` (via Express) | critical IP spoofing through the IPv4-mapped IPv6 trust subnet — the per-address sign-in guards depend on the visitor's address | override `^2.0.8`; `express` `^5.3.0` |
| `body-parser` (via Express) | high denial of service (trailing bytes after a compressed request) | override `^2.4.0` |
| `qs` (via body-parser) | moderate uncaught TypeError | override `^6.17.1` |
| `mongoose` | 2 high + 2 moderate (filter sanitising, inherited properties, prototype pollution) | `^8.9.3` → `^8.24.11` |
| `sharp` (and baileys' copy) | high librsvg issue | `^0.35.5` |
| `postcss`, `source-map-js` inside `next` | high file read through attacker-controlled source maps (build time only) | overrides `next>postcss ^8.5.34`, `source-map-js ^1.2.2` |
| `zod` 3.x (API) | high: memory exhaustion validating oversized collections | **not fixed** — the patch is in zod 4, a major upgrade of every schema; every public body is already size-limited by the JSON parser (`express.json` limits) and the rate limits, so the exposure is small. Plan it as its own task. |
| `uuid` 8 (via `exceljs`) | moderate: a missing bounds check when a caller passes its own buffer to v3/v5/v6 | **not applicable** — exceljs only uses v4 without a buffer; waits for exceljs |

After the update the storefront and website build, and the suites that depend on request handling pass (t28 rate limits, t87 staff sign-in, t119 log redaction, t120 live connection, t121 roles, t53/t54/t69/t98, bookings t113–t118, tables t18, website t103/t117/t95, console t122).

The three mobile apps' own packages (`npm audit --omit=dev`): 20 moderate each (the build tool's `glob`), none high or critical, none shipped in the APK's code.
