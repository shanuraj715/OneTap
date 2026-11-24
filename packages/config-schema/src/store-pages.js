import { z } from "zod";
import { hrefSchema } from "./storefront.js";

/**
 * A store's own pages on its storefront — About us, Contact, Gallery, FAQ, policies, or anything the owner
 * adds. Every outlet has its own set (`/<outlet>/about`). A page is a stack of simple blocks, the same idea as
 * the Rasoi Pulse marketing site's pages but much smaller: text, a photo, a gallery, an FAQ, a "find us" card, a
 * button.
 */

/* ------------------------------------------------------------------ slugs */

/**
 * A page lives at `/<outletSlug>/<pageSlug>`, right next to the app's own routes (`/<outlet>/order`…). A page
 * can never take one of those names, or that route would stop working for the outlet.
 */
export const RESERVED_PAGE_SLUGS = ["order", "t", "p", "api", "preview", "menu", "cart", "checkout", "login", "signin", "signup", "account", "admin", "variants", "_next", "book"];

export const pageSlugSchema = z
  .string()
  .min(1)
  .max(60)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Lowercase letters, numbers and single hyphens only")
  .refine((s) => !RESERVED_PAGE_SLUGS.includes(s), "That address is used by the app itself — pick another");

/** A URL-safe address from a page title ("About Us!" → "about-us"). */
export const slugFromTitle = (title) =>
  String(title ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

/* ----------------------------------------------------------------- blocks */

const id = z.string().min(1).max(40);
const url = z.string().max(600).default("");

export const pageHeadingBlockSchema = z.object({
  id,
  type: z.literal("heading"),
  text: z.string().max(120).default(""),
  level: z.union([z.literal(2), z.literal(3)]).default(2),
  align: z.enum(["left", "center"]).default("left"),
});

export const pageTextBlockSchema = z.object({
  id,
  type: z.literal("text"),
  /** a small safe Markdown subset — see markdown.js */
  markdown: z.string().max(8000).default(""),
});

export const pageImageBlockSchema = z.object({
  id,
  type: z.literal("image"),
  url,
  alt: z.string().max(160).default(""),
  caption: z.string().max(200).default(""),
});

export const pageGalleryImageSchema = z.object({ url: z.string().min(1).max(600), caption: z.string().max(160).default("") });

export const pageGalleryBlockSchema = z.object({
  id,
  type: z.literal("gallery"),
  images: z.array(pageGalleryImageSchema).max(12).default([]),
  /** a grid of photos, or the store's carousel style */
  style: z.enum(["grid", "carousel"]).default("grid"),
});

export const pageImageTextBlockSchema = z.object({
  id,
  type: z.literal("imageText"),
  imageUrl: url,
  imageAlt: z.string().max(160).default(""),
  markdown: z.string().max(4000).default(""),
  imageSide: z.enum(["left", "right"]).default("left"),
});

export const pageFaqItemSchema = z.object({ q: z.string().max(200).default(""), a: z.string().max(2000).default("") });

export const pageFaqBlockSchema = z.object({
  id,
  type: z.literal("faq"),
  heading: z.string().max(80).default(""),
  items: z.array(pageFaqItemSchema).max(20).default([]),
});

/** "Find us": filled in from the outlet the visitor is on — its address, phone, email, hours and map link. */
export const pageContactBlockSchema = z.object({
  id,
  type: z.literal("contact"),
  heading: z.string().max(80).default("Find us"),
  showAddress: z.boolean().default(true),
  showPhone: z.boolean().default(true),
  showEmail: z.boolean().default(true),
  showHours: z.boolean().default(true),
  showMap: z.boolean().default(true),
});

export const pageCtaBlockSchema = z.object({
  id,
  type: z.literal("cta"),
  heading: z.string().max(100).default(""),
  text: z.string().max(300).default(""),
  buttonLabel: z.string().max(30).default(""),
  buttonHref: hrefSchema,
});

export const pageBlockSchema = z.discriminatedUnion("type", [
  pageHeadingBlockSchema,
  pageTextBlockSchema,
  pageImageBlockSchema,
  pageGalleryBlockSchema,
  pageImageTextBlockSchema,
  pageFaqBlockSchema,
  pageContactBlockSchema,
  pageCtaBlockSchema,
]);
/** @typedef {z.infer<typeof pageBlockSchema>} PageBlock */

export const PAGE_BLOCK_TYPES = ["heading", "text", "image", "imageText", "gallery", "faq", "contact", "cta"];

/** What the editor's "Add a block" list says about each kind. */
export const PAGE_BLOCK_META = {
  heading: { label: "Heading", description: "A title for the section below it" },
  text: { label: "Text", description: "Paragraphs, lists and links" },
  image: { label: "Photo", description: "One picture with an optional caption" },
  imageText: { label: "Photo + text", description: "A picture beside a few paragraphs" },
  gallery: { label: "Gallery", description: "Several photos as a grid or a carousel" },
  faq: { label: "Questions & answers", description: "Frequently asked questions" },
  contact: { label: "Find us", description: "Address, phone, hours and a map link, from the outlet itself" },
  cta: { label: "Button banner", description: "A short message with one button" },
};

export const MAX_PAGE_BLOCKS = 40;

/** A fresh, empty block of one kind, for the editor's "add" button. */
export function emptyPageBlock(type) {
  const blockId = `blk_${Math.random().toString(36).slice(2, 10)}`;
  const base = { id: blockId, type };
  const schema = { heading: pageHeadingBlockSchema, text: pageTextBlockSchema, image: pageImageBlockSchema, imageText: pageImageTextBlockSchema, gallery: pageGalleryBlockSchema, faq: pageFaqBlockSchema, contact: pageContactBlockSchema, cta: pageCtaBlockSchema }[type];
  return schema.parse(base);
}

/* ------------------------------------------------------------------ pages */

export const PAGE_STATUSES = ["draft", "published"];

export const storePageSchema = z.object({
  title: z.string().trim().min(1, "Give the page a title").max(80),
  slug: pageSlugSchema,
  status: z.enum(PAGE_STATUSES).default("draft"),
  /** one line for search engines and link previews */
  description: z.string().max(200).default(""),
  /** link it in the storefront header's menu / in the footer strip */
  showInHeader: z.boolean().default(false),
  showInFooter: z.boolean().default(true),
  blocks: z.array(pageBlockSchema).max(MAX_PAGE_BLOCKS).default([]),
});
/** @typedef {z.infer<typeof storePageSchema>} StorePageInput */

/* ----------------------------------------------------------- starter pages */

const bid = () => `blk_${Math.random().toString(36).slice(2, 10)}`;

const LEGAL_NOTE =
  "*This is a starting template, not legal advice. Please read it, change it to match how you really work, and have it checked before you rely on it.*";

/**
 * The pages a store can create in one click — editable and unpublished, so nothing goes live until the owner
 * has read it. Names are filled in with the outlet's own.
 * @param {{ name?: string }} [about]
 */
export function starterPages({ name } = {}) {
  const who = name?.trim() || "our restaurant";
  return [
    {
      slug: "about",
      title: "About us",
      description: `The story of ${who}.`,
      showInHeader: true,
      showInFooter: true,
      blocks: [
        { id: bid(), type: "heading", text: `Welcome to ${who}`, level: 2, align: "left" },
        {
          id: bid(),
          type: "text",
          markdown: `Tell people who you are. Where did ${who} start, what do you cook, and what makes it different from the place down the road?\n\n- Made fresh, every day\n- Ingredients you can trust\n- Served with a smile`,
        },
        { id: bid(), type: "imageText", imageUrl: "", imageAlt: "", markdown: "Add a photo of your kitchen, your team or your best dish here, with a few lines beside it.", imageSide: "left" },
        { id: bid(), type: "cta", heading: "Hungry?", text: "Have a look at the menu and order in a minute.", buttonLabel: "See the menu", buttonHref: "/" },
      ],
    },
    {
      slug: "contact",
      title: "Contact & hours",
      description: `Where to find ${who}, and when we are open.`,
      showInHeader: true,
      showInFooter: true,
      blocks: [{ id: bid(), type: "contact", heading: "Find us", showAddress: true, showPhone: true, showEmail: true, showHours: true, showMap: true }],
    },
    {
      slug: "gallery",
      title: "Gallery",
      description: `Photos from ${who}.`,
      showInHeader: false,
      showInFooter: true,
      blocks: [{ id: bid(), type: "gallery", images: [], style: "grid" }],
    },
    {
      slug: "faq",
      title: "FAQ",
      description: "Answers to the questions we hear most.",
      showInHeader: false,
      showInFooter: true,
      blocks: [
        {
          id: bid(),
          type: "faq",
          heading: "Good to know",
          items: [
            { q: "Do you deliver?", a: "Tell customers whether you deliver, how far, and what it costs." },
            { q: "How long does an order take?", a: "Say how long a typical order takes, and what makes it slower." },
            { q: "How can I pay?", a: "List the ways people can pay: cash, UPI, cards." },
          ],
        },
      ],
    },
    {
      slug: "privacy-policy",
      title: "Privacy policy",
      description: `How ${who} looks after your details.`,
      showInHeader: false,
      showInFooter: true,
      blocks: [
        {
          id: bid(),
          type: "text",
          markdown: `${LEGAL_NOTE}\n\n# What we collect\nWhen you order from ${who} we ask for your name, phone number and, for delivery, your address. We use them only to prepare and deliver your order and to tell you about it.\n\n# Who sees it\nOur staff see your order. Our payment provider processes your payment — we never see your card details. We do not sell your details.\n\n# Your choices\nYou can ask us to correct or delete your details at any time by contacting us.`,
        },
      ],
    },
    {
      slug: "terms",
      title: "Terms & conditions",
      description: `The terms for ordering from ${who}.`,
      showInHeader: false,
      showInFooter: true,
      blocks: [
        {
          id: bid(),
          type: "text",
          markdown: `${LEGAL_NOTE}\n\n# Ordering\nBy placing an order with ${who} you agree to these terms. Prices and availability can change; the price you see at checkout is the price you pay.\n\n# Payment\nWe accept the payment methods shown at checkout.\n\n# Delivery and pickup\nTimes we give are estimates. For pickup, please collect your order when it is ready.`,
        },
      ],
    },
    {
      slug: "refund-policy",
      title: "Refunds & cancellation",
      description: `What happens if something goes wrong with an order from ${who}.`,
      showInHeader: false,
      showInFooter: true,
      blocks: [
        {
          id: bid(),
          type: "text",
          markdown: `${LEGAL_NOTE}\n\n# Cancelling an order\nYou can cancel before the kitchen starts preparing it. Call us as soon as you can.\n\n# If something is wrong\nIf an item is missing, wrong or not as it should be, tell us within a few hours and we will make it right with a replacement or a refund.\n\n# How refunds are paid\nOnline payments are refunded to the original payment method.`,
        },
      ],
    },
  ];
}
