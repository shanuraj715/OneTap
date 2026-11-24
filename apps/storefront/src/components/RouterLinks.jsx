"use client";

import Link from "next/link";
import { LinkProvider } from "@rasoipulse/ui";

/**
 * Hands Next's <Link> to the shared header, footer, message bar and carousels, so their links to pages of the store ("My
 * orders", "Book a table", About us…) move there inside the app instead of reloading the whole page.
 */
export function RouterLinks({ children }) {
  return <LinkProvider value={Link}>{children}</LinkProvider>;
}
