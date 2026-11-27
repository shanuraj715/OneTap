# T121 — Rasoi Pulse team roles: only the super admin makes roles and people; a team member can do exactly what their role holds, in every part of the platform API

**Area:** platform · **Last result:** ✅ PASSED (61 passed, 0 failed · 2026-11-28 01:55 · headless · 8.6 s)

**Run it alone:** `node run.mjs --only t121` (add `--visible` to watch it)

## What this test does

Runs suites/platform-roles-api.mjs against a private API on an in-memory database. Roles: only the super admin makes, changes and deletes them (a name once, any capitals; features must exist; each once; a role somebody holds can't be deleted). Team members: a password of 10+ characters with letters and a number, a real email not already used (a restaurant owner's is refused), an existing role; the account is stored with no store and only a hash of the password; the team list holds only team members. Enforcement: a 'Sales' person holding only Onboarding can use the onboarding forms, the price list, the plan list (read only, for the form) and the address check — and 33 other platform requests answer 403 (dashboard, sign-in log, stores and every change or delete of one, plans, settings, security, cache, storage, AI, server, app releases, roles, team, the log), as do the store list and creating a store, the website pages and its enquiries; no restaurant's menu can be changed or orders read (no store); nobody signed in gets 401. A change of a role reaches its people on their very next request (no new sign-in); 'change stores' brings 'view stores', 'delete' is its own feature and brings only 'view'. The Admin app: the same sign-in with x-app-id 'admin' (no update-required wall), the Bearer token follows the same rules, a restaurant's owner is turned away (403) and the session opened for the check ends. A restaurant's owner gets 403 on the whole platform API. Managing a person: extra fields (isSuperAdmin, a store) are ignored, the super admin and restaurant staff can't be reached through the team routes (404), a new role changes access at once, switching off or a new password signs every device out at once, deleting removes the account and sign-ins. The activity log lists each change (who, what, what was added or removed) and never a password; team members can't read it; their sign-ins show in the sign-in log as platform team. Every one of the 97 routes of /api/platform has a rule in the access table, and a route nobody wrote a rule for is closed to everyone but the super admin.

## Steps

1. Roles: only the super admin makes them
2. Team members: the password, the email, the role
3. What a team member sees and may do — the Sales role holds only Onboarding
4. A role's change reaches its people at once, with no new sign-in
5. Another role: Support — stores (view), then (change), then (delete)
6. The app: the same rules, with the Bearer token
7. A restaurant's own staff can't get in
8. Managing a person
9. The activity log
10. Every route of the platform API has been decided on

## What to expect (these must happen)

- A person with a role can do what the role holds and nothing else, on every route of the platform API; the app's Bearer token follows the same rules.
- Only the super admin can make roles and people, read the activity log, or reach the team routes.
- A role's change, a person switched off or a new password takes effect on the very next request.
- Every route of the platform API has a rule; a route without one is closed.

## What must NOT happen

- A restaurant's owner or staff must NOT get into the platform API or the Admin app.
- A team member must NOT be able to make themselves or anybody a super admin, or reach a restaurant's data.
- No password may appear in any answer or in the activity log.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (61)

**Step 1 — Roles: only the super admin makes them**

- the super admin sees the list of features a role can hold, and no roles yet
- a role is made with its features, each ticked feature once — _["onboarding:manage"]_
- …and says what the people holding it can really do, and how many hold it
- a second role with the same name (any capitals) is refused (409)
- a one-letter name, or a feature that doesn't exist, is refused (400)
- a role can hold every feature (and still isn't the super admin)

**Step 2 — Team members: the password, the email, the role**

- a password needs 10 characters, letters AND a number (these accounts can change every store)
- a bad email, or a role that doesn't exist, is refused
- an email already used by a restaurant's owner is refused (409)
- the member is made; the answer never holds the password or its hash
- stored: not a super admin, no store at all, the role, and only a hash of the password
- the team list has only team members (not the super admin, not restaurant staff)

**Step 3 — What a team member sees and may do — the Sales role holds only Onboarding**

- Sam signs in to the console with the email and password
- the session says: a team member, role Sales, the one feature Onboarding (not even 'Plans' in the sidebar), no store, no store permissions
- Sam CAN: the onboarding forms, the price list, the plan list (for the form to offer a plan) and the address check
- …and can start a new onboarding form
- Sam can NOT do any of 37 other things in the platform console: every one answers 403
- …nor the store list, creating a store, the website pages or its enquiries (403)
- nobody signed in: 401
- Sam can't change any restaurant's menu or read its orders either (no store: 403) — _menu 403, orders 403_
- …and sees no outlets

**Step 4 — A role's change reaches its people at once, with no new sign-in**

- before: Sam can't see the website enquiries
- the super admin adds 'Website enquiries' to the role (and it knows one person holds it)
- Sam's very next request is allowed (leads), without signing in again
- …and /me lists the new features — _["onboarding:manage","leads:manage"]_
- taking it away shuts it again at once, onboarding stays
- (the onboarding form may READ the plan list, never change a plan)

**Step 5 — Another role: Support — stores (view), then (change), then (delete)**

- Sue can see the dashboard, the store list and one store, and the server
- …but not onboarding, plans, or any change to a store
- '/api/brands': the list yes, creating a store no
- 'change stores' brings 'view stores' along
- …and she can rename, switch off and on a store — _rename 200, off 200, on 200_
- …but deleting a store or an outlet is a feature of its own: refused (403)
- 'delete' brings 'view' along but not 'change'

**Step 6 — The app: the same rules, with the Bearer token**

- Sam signs in to the Admin app (and no 'update required' wall: the Admin app is not in the update channel)
- with the token: onboarding yes, stores no — as in the web console
- a restaurant's owner is turned away from the Admin app (403)
- …and the session opened for that check ended (nothing left behind)
- the super admin signs in with everything
- roles: the super admin's token yes, Sam's no

**Step 7 — A restaurant's own staff can't get in**

- an owner gets 403 on the platform API, even to look at the plans
- an owner's session says: no platform access

**Step 8 — Managing a person**

- extra fields like isSuperAdmin or a store are ignored: a team member can't be made bigger through this
- the super admin and a restaurant's owner can't be reached through the team routes (404)
- moving Sam to another role changes what he can do at once
- a role somebody holds can't be deleted (409)
- …an empty one can
- switching Sam off signs him out at once (401), and he can't sign in again
- switched on again, he can sign in with the same password
- a new password ends every old sign-in at once; the old password stops working
- a weak password, or an empty change, is refused

**Step 9 — The activity log**

- the log has roles made, changed and deleted, and people made, changed and given new passwords — _member.password,member.update,role.delete,role.create,role.update,member.create_
- …and never a password
- …it says who did it and what changed (added: leads:manage)
- a team member can't read it
- the sign-in log lists Sam's sign-ins as a platform team member
- deleting a person removes the account and every sign-in

**Step 10 — Every route of the platform API has been decided on**

- all 101 routes of /api/platform have a rule in the table
- a route nobody wrote a rule for is closed to everybody but the super admin
- roles, team and the log are super-admin-only in the table too
- the website's own platform routes (12) are guarded by their own feature check (tested above: pages/settings → website, leads → leads)

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-28 01:55 | pass | 61 | 0 | headless | 8.6 s |
| 2026-11-27 22:06 | pass | 61 | 0 | headless | 8.5 s |
| 2026-11-27 21:03 | pass | 61 | 0 | headless | 8.0 s |
| 2026-11-27 16:59 | pass | 61 | 0 | headless | 8.6 s |
| 2026-11-27 16:52 | pass | 61 | 0 | headless | 10.5 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t121-platform-roles-api.mjs`), not this page._
