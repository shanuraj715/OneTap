// T122 — Console → Team & roles: make a role and a person, and what that person sees (only what the role allows); the sidebar says App Management
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t122-platform-team-ui",
  title: "Console → Team & roles: make a role and a person, and what that person sees (only what the role allows); the sidebar says App Management",
  area: "platform",
  browser: true,
  fresh: false,
  summary: "Chrome against the bench console (super admin). The sidebar says 'App Management' (not 'App updates') and has 'Team & roles'. Roles tab: the 'New role' window lists every feature grouped (Overview, Stores, Sales, Plans, Website, Apps, System), each with a line saying what it lets a person do, without Team & roles; 'Make the role' waits for a name; a role 'Sales' holding only Onboarding is made and listed with that one pill. People tab: 'Add a person' makes a strong password (10+ characters, letters and a number) and shows it once after saving; the person is listed Active with their role. On another browser that person signs in: the sidebar has exactly one item, Onboarding; /platform goes straight there; the page asks the server for nothing he may not have (no 403 on the way); stores, plans, team, security, app management and the website each say 'Your role doesn't include this page'; the server answers stores 403, roles 403, onboarding 200; he can start an onboarding form. Adding 'Website enquiries' to the role shows Leads in his sidebar on the next page load and the Leads page opens. Switching him off signs him out at once (the next page load shows the sign-in form); switching on lets him back. A 'Stores — view' role: the sidebar has only Stores, no 'Create store', the store page says 'You can look at this store, not change it', no 'Open dashboard' and no ⋮ menu, every field and button is switched off, and the server refuses a change, a switch-off and a delete (403). The Activity tab lists who made the roles and people and what changed, and never a password. What it makes is removed at the end.",
  expect: [
    "A team member's sidebar and pages hold only what their role allows; the first allowed page opens by itself.",
    "A role's change shows on the next page load; a person switched off is signed out at once.",
    "A view-only role sees a store but can't change it: the controls are off and the server says no.",
  ],
  expectNot: [
    "A team member must NOT see a page, button or number that their role doesn't hold.",
    "No 403 may appear while a team member uses a page that their role allows.",
    "No errors in the browser.",
  ],
};

export const run = (d) => runSuite(d, "platform-team-ui.mjs", { timeoutMs: 5 * 60_000 });
