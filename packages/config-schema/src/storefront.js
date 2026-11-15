import { z } from "zod";

/**
 * What a store owner configures for the pieces that sit around the menu on the storefront: the message bar above
 * the header, the promo carousel, and the order-type switch. Which STYLE each one uses (a variant id from the
 * registry in @onetap/ui) lives in `layout` with every other look choice; what they SAY lives here.
 */

/* ----------------------------------------------------------------- links */

const SAFE_HREF = /^(https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i;

/**
 * Where a link is allowed to go: a web address, an email/phone link, a path on the same site (`/about`) or an
 * in-page anchor. Never `javascript:` or anything else — owners type these and visitors click them.
 */
export const isSafeHref = (href) => href === "" || SAFE_HREF.test(String(href ?? "").trim());

/** `href` to put on an `<a>`: the link if it is safe, otherwise nothing (the link is simply not rendered). */
export const safeHref = (href) => (isSafeHref(href) && String(href ?? "").trim() !== "" ? String(href).trim() : null);

export const hrefSchema = z
  .string()
  .max(300)
  .default("")
  .refine(isSafeHref, "Use a web address (https://…), a page like /about, or #section");

/* ------------------------------------------------------ announcement bar */

export const announcementMessageSchema = z.object({
  id: z.string().min(1).max(40),
  text: z.string().max(140).default(""),
  /** optional "learn more" link on the message */
  linkLabel: z.string().max(30).default(""),
  linkHref: hrefSchema,
});
/** @typedef {z.infer<typeof announcementMessageSchema>} AnnouncementMessage */

export const MAX_ANNOUNCEMENT_MESSAGES = 5;

/**
 * The message bar above the header. It is its own component (its look is `layout.announcementVariant`), not
 * part of any header: any header can sit under any bar.
 */
export const announcementSchema = z.object({
  enabled: z.boolean().default(false),
  messages: z.array(announcementMessageSchema).max(MAX_ANNOUNCEMENT_MESSAGES).default([]),
  /** show the outlet's phone number in the bar (styles that have room for it) */
  showPhone: z.boolean().default(false),
  /** let visitors close the bar; a changed message shows again */
  dismissible: z.boolean().default(true),
  /** seconds each message stays before the next one (rotating and ticker styles) */
  rotateSeconds: z.number().int().min(2).max(20).default(5),
});
/** @typedef {z.infer<typeof announcementSchema>} AnnouncementSettings */

/* ------------------------------------------------------------- carousel */

export const carouselSlideSchema = z.object({
  id: z.string().min(1).max(40),
  imageUrl: z.string().max(600).default(""),
  title: z.string().max(80).default(""),
  subtitle: z.string().max(160).default(""),
  /** optional button on the slide */
  ctaLabel: z.string().max(30).default(""),
  ctaHref: hrefSchema,
});
/** @typedef {z.infer<typeof carouselSlideSchema>} CarouselSlide */

export const MAX_CAROUSEL_SLIDES = 10;

export const CAROUSEL_HEIGHTS = ["compact", "regular", "tall"];
export const CAROUSEL_HEIGHT_LABELS = { compact: "Compact", regular: "Regular", tall: "Tall" };

/**
 * The promo carousel on the storefront (offers, new dishes, festivals). Its look is `layout.carouselVariant`.
 * Appears under the header on the menu page; a page can also hold one (see store-pages.js).
 */
export const carouselSchema = z.object({
  enabled: z.boolean().default(false),
  slides: z.array(carouselSlideSchema).max(MAX_CAROUSEL_SLIDES).default([]),
  autoplay: z.boolean().default(true),
  intervalSeconds: z.number().int().min(3).max(15).default(5),
  showArrows: z.boolean().default(true),
  showDots: z.boolean().default(true),
  height: z.enum(CAROUSEL_HEIGHTS).default("regular"),
});
/** @typedef {z.infer<typeof carouselSchema>} CarouselSettings */

/** A fresh, empty message / slide for the editor's "add" buttons. */
const newId = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
export const emptyAnnouncementMessage = () => announcementMessageSchema.parse({ id: newId("msg"), text: "" });
export const emptyCarouselSlide = () => carouselSlideSchema.parse({ id: newId("slide") });

/* ------------------------------------------------------------ order type */

/** How a visitor wants their order: remembered on their device and carried into checkout. */
export const ORDER_TYPES = ["takeaway", "delivery"];
export const ORDER_TYPE_LABELS = { takeaway: "Takeaway", delivery: "Delivery" };
export const ORDER_TYPE_STORAGE_KEY = "onetap.orderType";

/**
 * Which order types an outlet offers on the storefront (dine-in only ever comes from a table QR).
 * @param {{ takeaway?: boolean, delivery?: boolean }} ordering `features.ordering`
 */
export function offeredOrderTypes(ordering) {
  return ORDER_TYPES.filter((t) => Boolean(ordering?.[t]));
}

/** The type to start on: the visitor's remembered choice when the outlet still offers it, else the first it offers. */
export function startingOrderType(offered, remembered) {
  if (remembered && offered.includes(remembered)) return remembered;
  return offered[0] ?? null;
}

/* --------------------------------------------------------- contact details */

/** "11:00" / "23:30" → "11:00 am" / "11:30 pm". */
function clock12(hhmm) {
  const [h, m] = String(hhmm ?? "").split(":").map(Number);
  if (!Number.isFinite(h)) return "";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(Number.isFinite(m) ? m : 0).padStart(2, "0")} ${h >= 12 ? "pm" : "am"}`;
}

/**
 * What a "Find us" block shows for an outlet, worked out from its own settings: where it is, how to reach it, when
 * it is open (only when the owner has switched opening hours on), and a link that opens its map pin.
 * @param {{ identity?: any, operations?: any }} config an outlet's config
 */
export function contactDetails(config) {
  const identity = config?.identity ?? {};
  const hours = config?.operations?.hours;
  const point = identity.location?.point;
  const address = identity.address || identity.location?.formattedAddress || "";
  const query = point ? `${point.lat},${point.lng}` : address ? encodeURIComponent(address) : "";
  return {
    name: identity.name ?? "",
    address,
    phone: identity.phone ?? "",
    email: identity.email ?? "",
    hours: hours?.enabled ? `Open daily, ${clock12(hours.opensAt)} – ${clock12(hours.closesAt)}` : "",
    mapUrl: query ? `https://www.google.com/maps/search/?api=1&query=${query}` : "",
  };
}
