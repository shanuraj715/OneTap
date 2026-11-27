/**
 * Who may open what — the same list as packages/config-schema/src/platform-access.js (PLATFORM_AREAS), kept in step by __tests__/access.test.ts.
 * The SERVER decides what each request may do; this only decides what the app shows. A person sees an area when they hold ANY of its features
 * (the super admin: every area, and "Team & roles", which is theirs alone).
 */
export interface Area { id: string; label: string; features: string[]; superAdminOnly?: boolean }

export const AREAS: Area[] = [
  { id: "dashboard", label: "Dashboard", features: ["dashboard:read"] },
  { id: "stores", label: "Stores", features: ["stores:read"] },
  { id: "onboarding", label: "Onboarding", features: ["onboarding:manage"] },
  { id: "plans", label: "Plans", features: ["plans:read"] },
  { id: "leads", label: "Leads", features: ["leads:manage"] },
  { id: "website", label: "Website", features: ["website:manage"] },
  { id: "app-management", label: "App Management", features: ["apps:manage"] },
  { id: "server", label: "Server", features: ["server:read"] },
  { id: "security", label: "Security", features: ["security:manage"] },
  { id: "cache", label: "Cache", features: ["cache:manage"] },
  { id: "storage", label: "Storage", features: ["storage:manage"] },
  { id: "ai", label: "AI pictures", features: ["ai:manage"] },
  { id: "settings", label: "Settings", features: ["settings:manage"] },
  { id: "team", label: "Team & roles", features: [], superAdminOnly: true },
];

/** The part of the signed-in person the app needs (what /api/auth/me and the sign-in answer carry). */
export interface Me {
  id: string; email: string; name: string; isSuperAdmin: boolean;
  platform: { access: boolean; features: string[]; role: { id: string; name: string } | null };
}

export const canDo = (me: Me | null | undefined, feature: string) => Boolean(me && (me.isSuperAdmin || me.platform?.features?.includes(feature)));
export const areasFor = (me: Me | null | undefined): Area[] => (me ? AREAS.filter((a) => (a.superAdminOnly ? me.isSuperAdmin : me.isSuperAdmin || a.features.some((f) => me.platform?.features?.includes(f)))) : []);
/** Areas the app has a screen for. (The rest of the console — the website editor, storage, AI keys — is still on the web console.) */
export const APP_AREAS = new Set(["dashboard", "stores", "onboarding", "plans", "leads", "app-management", "server", "security", "cache", "settings", "team"]);
