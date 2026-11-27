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

## Dependency audit (`pnpm audit --prod`, 2026-11-27): 22 known issues in existing packages — 2 critical, 9 high, 11 moderate

Nothing in this list was introduced by the work above. See the commit that follows this review for what was updated.
