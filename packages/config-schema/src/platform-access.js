import { z } from "zod";

/**
 * Who may do what in the PLATFORM console (Rasoi Pulse's own admin — the web console at admin.<domain>/platform and the Rasoi Pulse Admin app).
 *
 *  - the SUPER ADMIN (the owner's account, `isSuperAdmin`) may do everything, and is the only one who can create roles and team members;
 *  - a TEAM MEMBER is a person who works for Rasoi Pulse (sales, support …). They have no store; they have exactly one ROLE, made by the super
 *    admin, and a role is a list of FEATURES below. A person with the role "Sales" that holds only `onboarding:manage` sees only Onboarding —
 *    in the web console and in the app — and the API refuses everything else (apps/api/src/modules/platform/platform-access.js).
 *
 * One file of rules for the API, the web console, the app and the tests.
 */

/** The id the Rasoi Pulse Admin app sends as `x-app-id`. It is NOT in the apps catalog (app-release.js): it is for the platform team only, so it has no page on the website. */
export const ADMIN_APP_ID = "admin";

/** Every feature a role can be given. `implies` = what comes with it (a role that can change stores can of course see them). */
export const PLATFORM_FEATURES = [
  { key: "dashboard:read", group: "Overview", label: "Dashboard", hint: "The platform numbers and charts, and who signed in to the dashboards." },
  { key: "stores:read", group: "Stores", label: "Stores — view", hint: "See every store: its outlets, people, plan and address." },
  { key: "stores:manage", group: "Stores", label: "Stores — create and change", hint: "Create a store, change its plan, address, owners and people, switch it off or on, block an outlet.", implies: ["stores:read"] },
  { key: "stores:delete", group: "Stores", label: "Stores — delete", hint: "Delete a whole store or one of its outlets. Cannot be undone.", implies: ["stores:read"] },
  { key: "onboarding:manage", group: "Sales", label: "Onboarding", hint: "Take a new client's requirements, print them and publish them as a store. The form can read the plan list and check an address — nothing else of Plans or Stores is opened." },
  { key: "leads:manage", group: "Sales", label: "Website enquiries (leads)", hint: "See and answer the enquiries that come from the website." },
  { key: "plans:read", group: "Plans", label: "Plans — view", hint: "See the plans and their prices." },
  { key: "plans:manage", group: "Plans", label: "Plans — create and change", hint: "Create a plan, change its limits, features and prices.", implies: ["plans:read"] },
  { key: "website:manage", group: "Website", label: "Website", hint: "Edit the Rasoi Pulse marketing website: its pages, menu and settings." },
  { key: "apps:manage", group: "Apps", label: "App Management", hint: "Upload and publish app versions, require updates, set how often the apps refresh." },
  { key: "server:read", group: "System", label: "Server", hint: "Memory, processor, disk and network of the server, and how healthy it is." },
  { key: "security:manage", group: "System", label: "Security", hint: "See and clear the addresses blocked after wrong passwords." },
  { key: "cache:manage", group: "System", label: "Cache", hint: "See what the API remembers and make it forget (one store or everything)." },
  { key: "storage:manage", group: "System", label: "Storage", hint: "Where pictures are kept: the provider, usage, moving files, optimising pictures." },
  { key: "ai:manage", group: "System", label: "AI pictures", hint: "The keys and limits for making dish pictures with AI." },
  { key: "settings:manage", group: "System", label: "Platform settings", hint: "Grace days, the live-updates switch and other platform-wide settings." },
];
export const PLATFORM_FEATURE_KEYS = PLATFORM_FEATURES.map((f) => f.key);
export const PLATFORM_FEATURE_GROUPS = [...new Set(PLATFORM_FEATURES.map((f) => f.group))];
export const isPlatformFeature = (key) => PLATFORM_FEATURE_KEYS.includes(key);

/** A list of features with everything they bring along, de-duplicated and in the order of PLATFORM_FEATURES. Unknown keys are dropped. */
export function expandPlatformFeatures(keys) {
  const have = new Set();
  const add = (key) => {
    if (have.has(key)) return;
    const f = PLATFORM_FEATURES.find((x) => x.key === key);
    if (!f) return;
    have.add(key);
    for (const more of f.implies ?? []) add(more);
  };
  for (const key of keys ?? []) add(key);
  return PLATFORM_FEATURE_KEYS.filter((k) => have.has(k));
}

/**
 * The areas of the console (the sidebar of the web console, the home screen of the app). A person sees an area when they hold ANY of its features.
 * `path` is the web console's address, `id` is what the app uses.
 */
export const PLATFORM_AREAS = [
  { id: "dashboard", label: "Dashboard", path: "/platform", features: ["dashboard:read"] },
  { id: "stores", label: "Stores", path: "/platform/stores", features: ["stores:read"] },
  { id: "onboarding", label: "Onboarding", path: "/platform/onboarding", features: ["onboarding:manage"] },
  { id: "plans", label: "Plans", path: "/platform/plans", features: ["plans:read"] },
  { id: "leads", label: "Leads", path: "/platform/leads", features: ["leads:manage"] },
  { id: "website", label: "Website", path: "/platform/website", features: ["website:manage"] },
  { id: "app-management", label: "App Management", path: "/platform/app-management", features: ["apps:manage"] },
  { id: "server", label: "Server", path: "/platform/server", features: ["server:read"] },
  { id: "security", label: "Security", path: "/platform/security", features: ["security:manage"] },
  { id: "cache", label: "Cache", path: "/platform/cache", features: ["cache:manage"] },
  { id: "storage", label: "Storage", path: "/platform/storage", features: ["storage:manage"] },
  { id: "ai", label: "AI pictures", path: "/platform/ai", features: ["ai:manage"] },
  { id: "settings", label: "Settings", path: "/platform/settings", features: ["settings:manage"] },
  /** the super admin only: roles, team members and their activity */
  { id: "team", label: "Team & roles", path: "/platform/team", features: [], superAdminOnly: true },
];

/** The areas a person with these (expanded) features, or the super admin, may open. */
export const platformAreasFor = (features, isSuperAdmin = false) =>
  PLATFORM_AREAS.filter((a) => (a.superAdminOnly ? isSuperAdmin : isSuperAdmin || a.features.some((f) => (features ?? []).includes(f))));

/** Can this person (their expanded features) do `feature`? The super admin can do everything. */
export const canPlatform = (features, feature, isSuperAdmin = false) => isSuperAdmin || (features ?? []).includes(feature);

/* ------------------------------------------------------------------ roles and team members (the super admin makes these) */

export const roleInputSchema = z.object({
  name: z.string().trim().min(2, "Give the role a name (at least 2 letters).").max(40, "The name can be at most 40 characters."),
  description: z.string().trim().max(200, "The description can be at most 200 characters.").default(""),
  features: z
    .array(z.string())
    .max(PLATFORM_FEATURE_KEYS.length)
    .default([])
    .refine((list) => list.every(isPlatformFeature), "One of the chosen features doesn't exist."),
});

/** At least 10 characters with a letter and a digit: these accounts can change every store. */
export const teamPassword = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(200)
  .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), "Use letters and at least one number.");

export const teamMemberInputSchema = z.object({
  name: z.string().trim().min(2, "Enter the person's name.").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: teamPassword,
  roleId: z.string().min(1, "Choose a role."),
});

export const teamMemberPatchSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    roleId: z.string().min(1).optional(),
    isActive: z.boolean().optional(),
    password: teamPassword.optional(),
  })
  .refine((b) => Object.keys(b).length > 0, "Nothing to change.");
