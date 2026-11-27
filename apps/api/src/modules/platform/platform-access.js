import { requirePlatform, requireSuperAdmin, requireUser } from "../../middleware/auth.js";

/**
 * Which platform feature a request to `/api/platform/*` needs — ONE table, so it can be read, tested and audited in one place.
 *
 *  - a person (the super admin, or a team member whose role holds the feature) gets through when they hold ANY feature listed on the row;
 *  - `null` = the super admin only (roles, team members, the activity log);
 *  - a request that matches NO row is refused for everyone but the super admin — a new route is closed until somebody decides who may use it.
 *
 * Paths are relative to /api/platform. Rows are tried top to bottom and the first match wins, so the specific ones come first.
 * The same decisions are listed for the web console's sidebar and the app in config-schema/platform-access.js (PLATFORM_AREAS).
 */
export const PLATFORM_RULES = [
  // the dashboard's numbers; who signed in (emails, addresses of store staff too) is a security matter
  ["GET", /^\/(overview|dashboard)$/, ["dashboard:read"]],
  ["GET", /^\/login-logs$/, ["security:manage"]],

  // plans
  // (the onboarding form, and a person who changes a store's plan, read the plan list to offer a plan; that is all of Plans they get)
  ["GET", /^\/plans$/, ["plans:read", "onboarding:manage", "stores:manage"]],
  [["POST", "PATCH"], /^\/plans(\/[^/]+)?$/, ["plans:manage"]],

  // stores (the most specific rows first)
  ["GET", /^\/stores\/[^/]+\/cache$/, ["cache:manage"]],
  ["GET", /^\/stores$/, ["stores:read"]],
  ["GET", /^\/stores\/[^/]+$/, ["stores:read"]],
  ["GET", /^\/stores\/[^/]+\/deletion-summary$/, ["stores:delete"]],
  ["DELETE", /^\/stores\/[^/]+$/, ["stores:delete"]],
  ["DELETE", /^\/stores\/[^/]+\/outlets\/[^/]+$/, ["stores:delete"]],
  ["GET", /^\/stores\/[^/]+\/(disable-summary|subdomain\/status)$/, ["stores:manage"]],
  [["POST", "PATCH", "PUT", "DELETE"], /^\/stores\/[^/]+(\/.*)?$/, ["stores:manage"]],
  // the address check the onboarding form needs as well
  ["GET", /^\/subdomains\/(check|probe)$/, ["stores:manage", "onboarding:manage"]],

  // sales
  [["GET", "POST", "PUT", "PATCH", "DELETE"], /^\/onboarding(\/.*)?$/, ["onboarding:manage"]],

  // the rest of the console, one area each
  [["GET", "POST", "PUT", "PATCH", "DELETE"], /^\/app-releases(\/.*)?$/, ["apps:manage"]],
  [["GET", "POST", "PUT", "PATCH", "DELETE"], /^\/server(\/.*)?$/, ["server:read"]],
  [["GET", "POST", "PUT", "PATCH", "DELETE"], /^\/security(\/.*)?$/, ["security:manage"]],
  [["GET", "POST", "PUT", "PATCH", "DELETE"], /^\/cache(\/.*)?$/, ["cache:manage"]],
  [["GET", "POST", "PUT", "PATCH", "DELETE"], /^\/storage(\/.*)?$/, ["storage:manage"]],
  [["GET", "POST", "PUT", "PATCH", "DELETE"], /^\/ai(\/.*)?$/, ["ai:manage"]],
  [["GET", "PUT"], /^\/settings$/, ["settings:manage"]],

  // the super admin alone
  [["GET", "POST", "PATCH", "PUT", "DELETE"], /^\/(roles|team|audit)(\/.*)?$/, null],
];

/** Is there a row that names this request (as opposed to falling through to "closed")? A test uses it to make sure every route has been decided on. */
export function platformRuleIsExplicit(method, path) {
  const m = String(method).toUpperCase();
  return PLATFORM_RULES.some(([methods, pattern]) => [].concat(methods).includes(m) && pattern.test(path));
}

/** The row that decides a request: { features } (any-of) or { superAdminOnly: true }. */
export function platformRuleFor(method, path) {
  const m = String(method).toUpperCase();
  for (const [methods, pattern, features] of PLATFORM_RULES) {
    if (!([].concat(methods)).includes(m) || !pattern.test(path)) continue;
    return features === null ? { superAdminOnly: true } : { features };
  }
  return { superAdminOnly: true }; // nothing matched: closed
}

/** Express middleware for the platform router: signed in, then the row for this request. */
export function platformGate(req, _res, next) {
  requireUser(req);
  const rule = platformRuleFor(req.method, req.path);
  if (rule.superAdminOnly) requireSuperAdmin(req);
  else requirePlatform(req, ...rule.features);
  next();
}
