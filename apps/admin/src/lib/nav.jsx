import { forwardRef } from "react";
import {
  Link as RouterLink,
  Navigate as RouterNavigate,
  NavLink as RouterNavLink,
  matchPath,
  useLocation as useRouterLocation,
  useNavigate as useRouterNavigate,
} from "react-router-dom";

export * from "react-router-dom";

/**
 * Where a store's dashboard lives for the platform's super admin.
 *
 * A store owner's dashboard is at the plain addresses (/menu, /orders…). When the super admin opens a STORE, every one of
 * its pages is under  /store/<store-name>/<store-id>/…  — /store/tablepe/6afd…/menu — so the address says which store
 * you are in, can be bookmarked or shared with another admin, and a reload stays in that store. The id is what counts;
 * the name is only there to read (a wrong or old name is corrected in the address bar).
 *
 * Everything else in the app keeps writing plain paths (<Link to="/menu">, navigate("/orders")): the wrappers below put
 * the store's prefix in front of any plain path while a store is open, and take it off again where the app reads the
 * current path. Platform-console paths (/platform/…) are never prefixed.
 */

const STORE_PATH = "/store/:storeSlug/:storeId/*";
const OBJECT_ID = /^[0-9a-f]{24}$/i;

/** "Gazab Momos — Main" → "gazab-momos-main" (never empty). */
export function storeSlug(name) {
  const slug = String(name ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "store";
}

/** The address of a page of a store, for the super admin: storeUrl({ id, name }, "/menu") → /store/tablepe/6afd…/menu */
export function storeUrl(store, path = "/") {
  const base = `/store/${storeSlug(store?.name)}/${store?.id}`;
  return path === "/" || path === "" ? base : `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Which store (and under which name in the address) a pathname is inside — null when it isn't a store address. */
export function storeFromPath(pathname) {
  const m = matchPath({ path: STORE_PATH, end: false }, pathname);
  if (!m || !OBJECT_ID.test(m.params.storeId ?? "")) return null;
  return { slug: m.params.storeSlug, id: m.params.storeId, prefix: `/store/${m.params.storeSlug}/${m.params.storeId}` };
}

/** The part of a pathname after the store prefix ("/menu"), or the pathname itself when there is none. */
export function pathInsideStore(pathname) {
  const s = storeFromPath(pathname);
  if (!s) return pathname;
  return pathname.slice(s.prefix.length) || "/";
}

/** Put the store's prefix in front of a plain absolute path. Anything else (relative, /platform, already a /store address, a URL) is left as it is. */
function prefixed(to, prefix) {
  if (!prefix) return to;
  const fix = (p) => (typeof p === "string" && p.startsWith("/") && !p.startsWith("//") && !p.startsWith("/platform") && !p.startsWith("/store/") ? `${prefix}${p === "/" ? "" : p}` : p);
  if (typeof to === "string") return fix(to);
  if (to && typeof to === "object" && typeof to.pathname === "string") return { ...to, pathname: fix(to.pathname) };
  return to;
}

/** The prefix of the store the current address is inside ("" when there is none). */
function usePrefix() {
  const { pathname } = useRouterLocation();
  return storeFromPath(pathname)?.prefix ?? "";
}

export const Link = forwardRef(function Link({ to, ...rest }, ref) {
  return <RouterLink ref={ref} to={prefixed(to, usePrefix())} {...rest} />;
});

export const NavLink = forwardRef(function NavLink({ to, ...rest }, ref) {
  return <RouterNavLink ref={ref} to={prefixed(to, usePrefix())} {...rest} />;
});

export function Navigate({ to, ...rest }) {
  return <RouterNavigate to={prefixed(to, usePrefix())} {...rest} />;
}

export function useNavigate() {
  const navigate = useRouterNavigate();
  const prefix = usePrefix();
  return (to, options) => (typeof to === "number" ? navigate(to) : navigate(prefixed(to, prefix), options));
}

/** Same as react-router's, but `pathname` is the page inside the store ("/menu"), as the rest of the app expects. */
export function useLocation() {
  const location = useRouterLocation();
  return { ...location, pathname: pathInsideStore(location.pathname) };
}
