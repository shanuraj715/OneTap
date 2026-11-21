"use client";

import { createContext, useContext } from "react";

/**
 * Links that stay inside the app.
 *
 * The shared components (header, footer, message bar, promo carousel) are used by apps with different routers — Next.js on
 * the storefront, a plain page in the console's previews — so they can't import a router themselves. They draw their links
 * with <AppLink> instead: a normal <a> by default, and the storefront hands over Next's <Link> through <LinkProvider>, so
 * a click on "My orders" or "Book a table" moves to the next page WITHOUT reloading the whole app (no flash, no loading
 * spinner in the browser tab, the header and cart stay where they are).
 *
 * Only addresses inside the app ("/my-store/account") go through the router. "#menu" jumps, "tel:", "mailto:", "https://…"
 * and anything that opens in a new tab stay ordinary links.
 */
const LinkContext = createContext("a");

export const LinkProvider = LinkContext.Provider;

const inApp = (href) => typeof href === "string" && href.startsWith("/") && !href.startsWith("//");

export function AppLink({ href, target, ...rest }) {
  const Router = useContext(LinkContext);
  const Tag = inApp(href) && !target ? Router : "a";
  return <Tag href={href} target={target} {...rest} />;
}
