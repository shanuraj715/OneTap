import { pathFor, siteUrl } from "./site";

/**
 * Search and sharing metadata for one page: title (through the site's title
 * template), description, canonical URL, Open Graph + Twitter cards — with a
 * share image generated for the page when none was uploaded — and noindex
 * when the page asks for it.
 */
export function pageMetadata(page, settings, { preview = false } = {}) {
  const base = siteUrl(settings);
  const path = pathFor(page.slug);
  const title = page.seo.title || page.title;
  const description = page.seo.description || settings.seo.description || settings.tagline;
  const ogImage =
    page.seo.ogImage ||
    settings.seo.ogImage ||
    `/og?${new URLSearchParams({ title: page.slug === "home" ? settings.tagline : title, brand: settings.brandName, color: settings.brandColor })}`;

  return {
    // the home page's title stands on its own; every other page goes through the template ("Pricing · TablePe")
    title: page.slug === "home" ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    robots: preview || page.seo.noindex ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: {
      type: "website",
      url: `${base}${path}`,
      siteName: settings.brandName,
      title,
      description,
      locale: "en_IN",
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: { card: "summary_large_image", title, description, images: [ogImage] },
  };
}

/** Structured data Google reads: the organisation + site on the home page, an FAQ wherever one appears. */
export function jsonLdFor(page, settings) {
  const base = siteUrl(settings);
  const blocks = [];
  if (page.slug === "home") {
    const sameAs = Object.values(settings.social).filter(Boolean);
    blocks.push({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: settings.brandName,
      url: base,
      ...(settings.logoUrl ? { logo: settings.logoUrl } : {}),
      ...(sameAs.length ? { sameAs } : {}),
      ...(settings.contact.phone || settings.contact.email
        ? {
            contactPoint: {
              "@type": "ContactPoint",
              contactType: "sales",
              ...(settings.contact.phone ? { telephone: settings.contact.phone } : {}),
              ...(settings.contact.email ? { email: settings.contact.email } : {}),
              areaServed: "IN",
            },
          }
        : {}),
    });
    blocks.push({ "@context": "https://schema.org", "@type": "WebSite", name: settings.brandName, url: base });
  }
  const faqs = page.sections.filter((s) => s.type === "faq").flatMap((s) => s.items).filter((i) => i.q && i.a);
  if (faqs.length) {
    blocks.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((i) => ({ "@type": "Question", name: i.q, acceptedAnswer: { "@type": "Answer", text: i.a } })),
    });
  }
  return blocks;
}

/** JSON-LD as a script body — `<` escaped so content can never close the tag. */
export const ldJson = (obj) => JSON.stringify(obj).replace(/</g, "\\u003c");
