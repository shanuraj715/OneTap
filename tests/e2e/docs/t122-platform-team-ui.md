# T122 — Console → Team & roles: make a role and a person, and what that person sees (only what the role allows); the sidebar says App Management

**Area:** platform · **Last result:** ✅ PASSED (28 passed, 0 failed · 2026-11-28 02:15 · headless · 9.1 s)

**Run it alone:** `node run.mjs --only t122` (add `--visible` to watch it)

## What this test does

Chrome against the bench console (super admin). The sidebar says 'App Management' (not 'App updates') and has 'Team & roles'. Roles tab: the 'New role' window lists every feature grouped (Overview, Stores, Sales, Plans, Website, Apps, System), each with a line saying what it lets a person do, without Team & roles; 'Make the role' waits for a name; a role 'Sales' holding only Onboarding is made and listed with that one pill. People tab: 'Add a person' makes a strong password (10+ characters, letters and a number) and shows it once after saving; the person is listed Active with their role. On another browser that person signs in: the sidebar has exactly one item, Onboarding; /platform goes straight there; the page asks the server for nothing he may not have (no 403 on the way); stores, plans, team, security, app management and the website each say 'Your role doesn't include this page'; the server answers stores 403, roles 403, onboarding 200; he can start an onboarding form. Adding 'Website enquiries' to the role shows Leads in his sidebar on the next page load and the Leads page opens. Switching him off signs him out at once (the next page load shows the sign-in form); switching on lets him back. A 'Stores — view' role: the sidebar has only Stores, no 'Create store', the store page says 'You can look at this store, not change it', no 'Open dashboard' and no ⋮ menu, every field and button is switched off, and the server refuses a change, a switch-off and a delete (403). The Activity tab lists who made the roles and people and what changed, and never a password. What it makes is removed at the end.

## Steps

1. The super admin's sidebar
2. A role: Sales, with only Onboarding
3. A person with that role
4. Sam signs in (another browser)
5. Changing the role changes what he sees
6. A person is switched off
7. A role that can only LOOK at stores
8. The activity log

## What to expect (these must happen)

- A team member's sidebar and pages hold only what their role allows; the first allowed page opens by itself.
- A role's change shows on the next page load; a person switched off is signed out at once.
- A view-only role sees a store but can't change it: the controls are off and the server says no.

## What must NOT happen

- A team member must NOT see a page, button or number that their role doesn't hold.
- No 403 may appear while a team member uses a page that their role allows.
- No errors in the browser.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (28)

**Step 1 — The super admin's sidebar**

- the sidebar says 'App Management' (it used to say 'App updates')
- …and has 'Team & roles'
- it opens /platform/team

**Step 2 — A role: Sales, with only Onboarding**

- the role window lists every feature, grouped, each with a line saying what it lets a person do
- …Team & roles is not one of them (it stays the super admin's alone)
- 'Make the role' waits for a name
- the role is in the list, holding Onboarding only — _Sales 340452 Onboarding 0_
- saved with exactly that one feature

**Step 3 — A person with that role**

- a strong password is made for them (10+ characters, letters and a number) — _••••••••••••••_
- it is shown once so it can be told to them
- Sam is in the list: Active, role Sales

**Step 4 — Sam signs in (another browser)**

- Sam's sidebar has ONE item: Onboarding — _Onboarding_
- /platform takes him straight to it (no dashboard for his role) — _http://localhost:3171/platform/onboarding_
- the page asked the server for nothing he may not have (no 403 on the way)
- every other page says 'Your role doesn't include this page' (stores, plans, team, security, app management, website)
- and the server agrees: stores 403, roles 403, onboarding 200 — _403,403,200_
- he can start a new onboarding form

**Step 5 — Changing the role changes what he sees**

- after the next page load his sidebar has Onboarding and Leads — _Onboarding \| Leads_
- …and the Leads page opens for him

**Step 6 — A person is switched off**

- his next page load shows the sign-in form: he is signed out at once

**Step 7 — A role that can only LOOK at stores**

- Sue's sidebar has one item: Stores — _Stores_
- the Stores page has no 'Create store' button
- …no 'Open dashboard', no ⋮ menu for disable / delete
- every field and button below is switched off (a disabled group)
- …and the server refuses a change, a switch-off and a delete from her (403) — _403,403,403_

**Step 8 — The activity log**

- the Activity tab says who made the roles and the people, and who changed what
- …and never a password
- no errors in the browser

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-28 02:15 | pass | 28 | 0 | headless | 9.1 s |
| 2026-11-28 01:55 | pass | 28 | 0 | headless | 8.1 s |
| 2026-11-27 16:59 | pass | 28 | 0 | headless | 9.1 s |
| 2026-11-27 16:52 | pass | 28 | 0 | headless | 8.9 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t122-platform-team-ui.mjs`), not this page._
