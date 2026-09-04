import { z } from "zod";

/**
 * Which component variant each layout slot uses. The values are ids from the
 * variant registry in @onetap/ui — swapping one changes the storefront's look
 * with no code change.
 */
/** One extra link in the header nav — admin-added, on top of the built-in
 *  "Menu" / "Order at table" / "Book a table" links the header always shows
 *  when relevant. `href` can be an in-page anchor ("#about") or a full URL. */
export const navLinkSchema = z.object({
  label: z.string().min(1).max(30),
  href: z.string().min(1).max(300),
});

export const layoutSchema = z.object({
  headerVariant: z.string().default("header.centered"),
  /** admin-added header links, shown after the built-in ones — see {@link navLinkSchema} */
  navLinks: z.array(navLinkSchema).max(8).default([]),
  footerVariant: z.string().default("footer.two-column"),
  itemCardVariant: z.string().default("card.row-compact"),
  buttonVariant: z.string().default("button.solid"),
  badgeVariant: z.string().default("badge.solid"),
  chipVariant: z.string().default("chip.solid"),
  alertVariant: z.string().default("alert.left-accent"),
  toastVariant: z.string().default("toast.solid"),
  modalVariant: z.string().default("modal.centered"),
  popoverVariant: z.string().default("popover.card"),
  accordionVariant: z.string().default("accordion.bordered"),
  faqVariant: z.string().default("faq.stacked"),
  contentCardVariant: z.string().default("content.image-top"),
  carouselVariant: z.string().default("carousel.slider"),
  popupCarouselVariant: z.string().default("carousel.slider"),
  dropdownVariant: z.string().default("dropdown.menu"),
  listGroupVariant: z.string().default("list.bordered"),
  paginationVariant: z.string().default("pagination.numbered"),
  progressVariant: z.string().default("progress.bar"),
});
                                                  
