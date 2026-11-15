const STOREFRONT_URL = import.meta.env.VITE_STOREFRONT_URL ?? "http://localhost:3070";

/**
 * An address on the current outlet's own website — dominos.com/laxmi-nagar (or …/laxmi-nagar/about) in
 * production. In development (or before a store has a public domain) it's the platform storefront.
 *
 *   storefrontHref(outlet)           the outlet's menu page
 *   storefrontHref(outlet, "about")  one of its own pages
 */
export function storefrontHref(outlet, subpath = "") {
  const host = outlet?.canonicalHostname || "";
  const path = `${outlet?.slug ? `/${outlet.slug}` : ""}${subpath ? `/${subpath}` : ""}`;
  const isPublic = host.includes(".") && !/^(localhost|127\.|\[::1\])/.test(host) && !/\.(test|local)(:\d+)?$/.test(host);
  if (!import.meta.env.DEV && isPublic) return `https://${host}${path}`;
  return `${STOREFRONT_URL.replace(/\/$/, "")}${path}`;
}
