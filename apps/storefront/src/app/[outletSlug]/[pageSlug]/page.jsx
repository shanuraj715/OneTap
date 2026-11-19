import { cache } from "react";
import { notFound } from "next/navigation";
import { PageBlocks } from "@onetap/ui";
import { contactDetails } from "@onetap/config-schema";
import { StoreBottom, StoreTop } from "@/components/Chrome";
import { OutletUnavailable } from "@/components/OutletUnavailable";
import { ThemeStyle } from "@/components/ThemeStyle";
import { getOutletBySlug, getPageLinks, getStorePage, storeName } from "@/lib/outlet";

export const dynamic = "force-dynamic";

/** The outlet, its page and its page links — fetched once per request, whether the title or the body asks first. */
const load = cache(async (outletSlug, pageSlug) => {
  const outlet = await getOutletBySlug(outletSlug);
  if (!outlet) return { outlet: null };
  if (outlet.blocked) return { outlet, blocked: true };
  const [page, pages] = await Promise.all([getStorePage(outlet.id, pageSlug), getPageLinks(outlet.id)]);
  return { outlet, page, pages };
});

export async function generateMetadata({ params }) {
  const { outletSlug, pageSlug } = await params;
  const { outlet, page } = await load(outletSlug, pageSlug);
  if (!outlet || !page) return { title: "Page not found" };
  const name = storeName(outlet);
  return { title: `${page.title} — ${name}`, description: page.description || undefined };
}

/**
 * One of a store's own pages — About us, Contact, a policy… — at `/<outlet>/<page>`. Only published pages are
 * reachable; a draft, or an address with no page, is a plain 404. (The app's own addresses, like `/<outlet>/order`,
 * are separate routes that take priority, and pages can't be given those names.)
 */
export default async function StorePage({ params }) {
  const { outletSlug, pageSlug } = await params;
  const { outlet, blocked, page, pages } = await load(outletSlug, pageSlug);
  if (!outlet) notFound();
  if (blocked) return <OutletUnavailable outlet={outlet} />;
  if (!page) notFound();

  const { theme, typography, layout } = outlet.config;
  return (
    <>
      <ThemeStyle theme={theme} typography={typography} effect={outlet.config.effect} branding={outlet.config.branding} />
      <StoreTop outlet={outlet} outletSlug={outletSlug} pages={pages} />
      <main>
        <h1 className="ot-page-px" style={title}>{page.title}</h1>
        <PageBlocks blocks={page.blocks} contact={contactDetails(outlet.config)} layout={layout} />
      </main>
      <StoreBottom outlet={outlet} outletSlug={outletSlug} pages={pages} />
    </>
  );
}

const title = {
  maxWidth: 820,
  margin: "0 auto",
  padding: "40px 18px 14px",
  boxSizing: "border-box",
  fontFamily: "var(--font-heading)",
  fontSize: "clamp(1.9rem, 5vw, 2.7rem)",
  fontWeight: "var(--font-weight-heading)",
  letterSpacing: "var(--letter-spacing-heading)",
  lineHeight: 1.15,
  color: "var(--color-text)",
  textWrap: "balance",
};
