import { z } from "zod";

/**
 * The Rasoi Pulse marketing website — its pages, settings and enquiry form.
 *
 * One definition of each shape, used three ways: the API validates what the
 * console saves, the console builds its forms from SECTION_META, and the
 * website renders exactly these fields. A page is a stack of sections; each
 * section is one of SECTION_TYPES with its own fields.
 */

const str = (max, fallback = "") => z.string().trim().max(max).default(fallback);
const bool = (fallback = false) => z.boolean().default(fallback);

/** A button or link. `href` is a site path ("/contact"), an anchor ("#pricing") or a full URL. */
export const siteLinkSchema = z.object({ label: str(40), href: str(300) });
export const siteImageSchema = z.object({ url: str(600), alt: str(160) });

/** Icons a feature / use-case can show — the website and console map these names to the same glyphs. */
export const SITE_ICONS = [
  "qr-code",
  "concierge-bell",
  "smartphone",
  "printer",
  "coins",
  "ticket-percent",
  "message-circle",
  "store",
  "globe",
  "palette",
  "chart-line",
  "clock",
  "shield-check",
  "users",
  "zap",
  "utensils",
  "bike",
  "receipt",
  "coffee",
  "chef-hat",
  "soup",
  "headset",
  "rocket",
  "sparkles",
  "credit-card",
  "monitor",
  "wallet",
  "badge-percent",
  "layout-dashboard",
  "timer",
  "gift",
  "scan-line",
  "shopping-bag",
  "truck",
  "calendar-check",
];

/**
 * The product pictures the website draws itself (HTML, not images — sharp at
 * any size and nothing to download). A section can show one of these, or an
 * uploaded screenshot instead.
 */
export const PRODUCT_VISUALS = ["dashboard", "qr", "staff", "online", "kitchen", "loyalty"];
export const PRODUCT_VISUAL_LABELS = {
  dashboard: "Live orders screen",
  qr: "QR ordering on a phone",
  staff: "Staff taking an order",
  online: "Your ordering website",
  kitchen: "Kitchen ticket",
  loyalty: "Coins & coupons",
};
const iconSchema = z.enum(SITE_ICONS).default("zap");

const base = { id: z.string().min(1).max(40), anchor: str(40) };
const header = { eyebrow: str(60), heading: str(140), intro: str(400) };

export const SECTION_SCHEMAS = {
  hero: z.object({
    ...base,
    type: z.literal("hero"),
    eyebrow: str(60),
    heading: str(140),
    subheading: str(400),
    primary: siteLinkSchema.default({}),
    secondary: siteLinkSchema.default({}),
    image: siteImageSchema.default({}),
    stats: z.array(z.object({ value: str(20), label: str(60) })).max(4).default([]),
    /** a line of reassurance under the buttons — "Set up for you · No commission · Cancel anytime" */
    note: str(140),
  }),
  productTabs: z.object({
    ...base,
    type: z.literal("productTabs"),
    ...header,
    items: z
      .array(
        z.object({
          label: str(30),
          icon: iconSchema,
          heading: str(120),
          text: str(400),
          points: z.array(str(120)).max(6).default([]),
          visual: z.enum(PRODUCT_VISUALS).default("dashboard"),
          image: siteImageSchema.default({}),
          button: siteLinkSchema.default({}),
        }),
      )
      .max(6)
      .default([]),
  }),
  stats: z.object({
    ...base,
    type: z.literal("stats"),
    ...header,
    items: z.array(z.object({ value: str(20), label: str(80) })).max(6).default([]),
  }),
  features: z.object({
    ...base,
    type: z.literal("features"),
    ...header,
    items: z.array(z.object({ icon: iconSchema, title: str(80), text: str(300) })).max(12).default([]),
  }),
  audience: z.object({
    ...base,
    type: z.literal("audience"),
    ...header,
    items: z.array(z.object({ icon: iconSchema, title: str(80), text: str(300), image: siteImageSchema.default({}) })).max(8).default([]),
  }),
  useCases: z.object({
    ...base,
    type: z.literal("useCases"),
    ...header,
    items: z.array(z.object({ icon: iconSchema, when: str(80), text: str(300) })).max(8).default([]),
  }),
  logos: z.object({
    ...base,
    type: z.literal("logos"),
    ...header,
    items: z.array(z.object({ name: str(80), logo: str(600), href: str(300) })).max(24).default([]),
  }),
  testimonials: z.object({
    ...base,
    type: z.literal("testimonials"),
    ...header,
    items: z.array(z.object({ quote: str(600), name: str(80), role: str(80), business: str(80), photo: str(600) })).max(9).default([]),
  }),
  pricing: z.object({
    ...base,
    type: z.literal("pricing"),
    ...header,
    /** under the cards — e.g. "Prices exclude GST. Setup is included." */
    note: str(300),
    /** "Every plan includes" — shown under the cards */
    included: z.array(str(80)).max(8).default([]),
    /** a feature-by-feature table of the plans, under the cards */
    compare: bool(false),
  }),
  faq: z.object({
    ...base,
    type: z.literal("faq"),
    ...header,
    items: z.array(z.object({ q: str(200), a: str(1500) })).max(30).default([]),
  }),
  cta: z.object({
    ...base,
    type: z.literal("cta"),
    heading: str(140),
    text: str(300),
    button: siteLinkSchema.default({}),
  }),
  text: z.object({
    ...base,
    type: z.literal("text"),
    heading: str(140),
    /** Markdown: # headings, paragraphs, - lists, 1. lists, **bold**, *italic*, [links](/path). */
    body: str(40000),
  }),
  imageText: z.object({
    ...base,
    type: z.literal("imageText"),
    eyebrow: str(60),
    heading: str(140),
    body: str(4000),
    image: siteImageSchema.default({}),
    imageSide: z.enum(["left", "right"]).default("right"),
    button: siteLinkSchema.default({}),
  }),
  contact: z.object({
    ...base,
    type: z.literal("contact"),
    ...header,
    /** show phone / email / WhatsApp / address from the website settings beside the form */
    showDetails: bool(true),
  }),
};

export const SECTION_TYPES = Object.keys(SECTION_SCHEMAS);
export const siteSectionSchema = z.discriminatedUnion("type", Object.values(SECTION_SCHEMAS));

/** What the console shows when adding a section, and the empty section it starts from. */
export const SECTION_META = {
  hero: { label: "Hero", description: "The big opening: headline, buttons, the product picture and a few numbers." },
  productTabs: { label: "Product tabs", description: "One tab per product area — text, points and a product picture." },
  stats: { label: "Stats band", description: "A bold band of a few big numbers." },
  features: { label: "Features", description: "Why use us — a grid of icon, title and text." },
  audience: { label: "Who it's for", description: "The kinds of restaurants you serve." },
  useCases: { label: "When to use it", description: "The moments a restaurant needs you." },
  logos: { label: "Logos", description: "Stores that use Rasoi Pulse." },
  testimonials: { label: "Testimonials", description: "What owners say, with name and business." },
  pricing: { label: "Pricing", description: "Your plans that are set to show on the website, each with Talk to us." },
  faq: { label: "FAQ", description: "Questions and answers — also shown to Google as an FAQ." },
  cta: { label: "Call to action", description: "A closing heading, line and button." },
  text: { label: "Text", description: "Headings, paragraphs, lists and links — for About, Privacy, Terms." },
  imageText: { label: "Image + text", description: "A picture beside a block of text." },
  contact: { label: "Contact form", description: "The enquiry form, with your phone, email and address." },
};

export const newSection = (type, id) => SECTION_SCHEMAS[type].parse({ type, id });

/* ------------------------------------------------------------------- pages */

export const SITE_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** Paths the website itself owns — no page may take them. */
export const RESERVED_SITE_SLUGS = ["api", "app", "preview", "og", "sitemap", "robots", "_next", "uploads", "opengraph-image", "favicon"];
export const FOOTER_GROUPS = ["", "product", "company", "legal"];

export const sitePageSchema = z.object({
  /** "home" is the site's front page, served at "/" */
  slug: z.string().trim().toLowerCase().regex(SITE_SLUG_RE, "Use lowercase letters, numbers and dashes, like about-us").max(80),
  title: z.string().trim().min(1, "Give the page a title").max(120),
  status: z.enum(["draft", "published"]).default("draft"),
  seo: z
    .object({ title: str(70), description: str(170), ogImage: str(600), noindex: bool() })
    .default({}),
  nav: z.object({ show: bool(), label: str(30), order: z.number().int().min(0).max(99).default(50) }).default({}),
  footerGroup: z.enum(FOOTER_GROUPS).default(""),
  sections: z.array(siteSectionSchema).max(40).default([]),
});

/* ---------------------------------------------------------------- settings */

const hex = z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Use a colour like #C8372D");

export const siteSettingsSchema = z.object({
  brandName: str(60, "Rasoi Pulse"),
  tagline: str(140, "Restaurant ordering, from table to kitchen."),
  logoUrl: str(600),
  faviconUrl: str(600),
  brandColor: hex.default("#C8372D"),
  /** the site's public address, for canonical links and the sitemap — e.g. https://rasoipulse.com */
  siteUrl: str(200),
  contact: z
    .object({ email: str(120), phone: str(30), whatsapp: str(30), address: str(300), hours: str(120) })
    .default({}),
  social: z
    .object({ instagram: str(300), facebook: str(300), linkedin: str(300), x: str(300), youtube: str(300) })
    .default({}),
  seo: z
    .object({ titleTemplate: str(80, "%s · Rasoi Pulse"), description: str(170), ogImage: str(600) })
    .default({}),
  announcement: z.object({ show: bool(), text: str(140), href: str(300) }).default({}),
  footerNote: str(300),
});

/* ------------------------------------------------------------------- leads */

export const LEAD_STATUSES = ["new", "contacted", "won", "lost"];

export const leadInputSchema = z.object({
  name: z.string().trim().min(2, "Tell us your name").max(80),
  phone: z
    .string()
    .trim()
    .max(20)
    .refine((v) => v.replace(/\D/g, "").length >= 10, "Enter a phone number we can call"),
  email: z.union([z.string().trim().email("That email doesn't look right").max(120), z.literal("")]).default(""),
  businessName: str(120),
  city: str(80),
  outlets: str(20),
  plan: str(60),
  message: str(2000),
  sourcePage: str(200),
  utm: z.object({ source: str(80), medium: str(80), campaign: str(120) }).default({}),
  /** honeypot — a real visitor never fills this in */
  website: z.string().max(200).optional(),
});

/* --------------------------------------------- a plan, as the website shows it */

export const planMarketingSchema = z.object({
  show: bool(),
  /** the plan's price in rupees per month, before GST. 0 → there's no number to show (see `price`) */
  monthly: z.number().int().min(0).max(1_000_000).default(0),
  /** percent off when a store pays for the year up front. 0 → no yearly option is shown */
  yearlyDiscount: z.number().int().min(0).max(90).default(0),
  /** shown as written — "Custom" — only when there's no monthly price */
  price: str(30),
  period: str(20, "/month"),
  pitch: str(140),
  highlight: bool(),
  order: z.number().int().min(0).max(99).default(50),
});

/**
 * What a plan costs on the website, from its marketing settings. A monthly
 * price (₹, whole rupees) is the source of truth; the older free-text `price`
 * is only read when it is a plain rupee amount ("₹1,499"), so plans set up
 * before there was a number keep their price.
 *
 * The yearly price is the year's worth of months less the discount, in whole
 * rupees; `perMonth` is what that works out to each month.
 */
export function planPrices(m) {
  let monthly = m.monthly || 0;
  if (!monthly) {
    const plain = /^(?:₹|rs\.?|inr)?\s*([\d,]+)\s*$/i.exec(String(m.price ?? "").trim());
    if (plain) monthly = Number(plain[1].replace(/,/g, "")) || 0;
  }
  const discount = monthly && m.yearlyDiscount ? m.yearlyDiscount : 0;
  const total = discount ? Math.round((monthly * 12 * (100 - discount)) / 100) : 0;
  return {
    monthly,
    yearly: discount ? { total, perMonth: Math.round(total / 12), discount, saves: monthly * 12 - total } : null,
  };
}
