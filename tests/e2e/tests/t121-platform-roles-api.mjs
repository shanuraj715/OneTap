// T121 — Rasoi Pulse team roles: only the super admin makes roles and people; a team member can do exactly what their role holds, in every part of the platform API
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t121-platform-roles-api",
  title: "Rasoi Pulse team roles: only the super admin makes roles and people; a team member can do exactly what their role holds, in every part of the platform API",
  area: "platform",
  browser: false,
  fresh: false,
  summary: "Runs suites/platform-roles-api.mjs against a private API on an in-memory database. Roles: only the super admin makes, changes and deletes them (a name once, any capitals; features must exist; each once; a role somebody holds can't be deleted). Team members: a password of 10+ characters with letters and a number, a real email not already used (a restaurant owner's is refused), an existing role; the account is stored with no store and only a hash of the password; the team list holds only team members. Enforcement: a 'Sales' person holding only Onboarding can use the onboarding forms, the price list, the plan list (read only, for the form) and the address check — and 33 other platform requests answer 403 (dashboard, sign-in log, stores and every change or delete of one, plans, settings, security, cache, storage, AI, server, app releases, roles, team, the log), as do the store list and creating a store, the website pages and its enquiries; no restaurant's menu can be changed or orders read (no store); nobody signed in gets 401. A change of a role reaches its people on their very next request (no new sign-in); 'change stores' brings 'view stores', 'delete' is its own feature and brings only 'view'. The Admin app: the same sign-in with x-app-id 'admin' (no update-required wall), the Bearer token follows the same rules, a restaurant's owner is turned away (403) and the session opened for the check ends. A restaurant's owner gets 403 on the whole platform API. Managing a person: extra fields (isSuperAdmin, a store) are ignored, the super admin and restaurant staff can't be reached through the team routes (404), a new role changes access at once, switching off or a new password signs every device out at once, deleting removes the account and sign-ins. The activity log lists each change (who, what, what was added or removed) and never a password; team members can't read it; their sign-ins show in the sign-in log as platform team. Every one of the 97 routes of /api/platform has a rule in the access table, and a route nobody wrote a rule for is closed to everyone but the super admin.",
  expect: [
    "A person with a role can do what the role holds and nothing else, on every route of the platform API; the app's Bearer token follows the same rules.",
    "Only the super admin can make roles and people, read the activity log, or reach the team routes.",
    "A role's change, a person switched off or a new password takes effect on the very next request.",
    "Every route of the platform API has a rule; a route without one is closed.",
  ],
  expectNot: [
    "A restaurant's owner or staff must NOT get into the platform API or the Admin app.",
    "A team member must NOT be able to make themselves or anybody a super admin, or reach a restaurant's data.",
    "No password may appear in any answer or in the activity log.",
  ],
};

export const run = (d) => runSuite(d, "platform-roles-api.mjs", { timeoutMs: 4 * 60_000 });
