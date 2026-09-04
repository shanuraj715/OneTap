import { z } from "zod";

/**
 * Which component variant each layout slot uses. The values are ids from the
 * variant registry in @onetap/ui — swapping one changes the storefront's look
 * with no code change.
 */
export const layoutSchema = z.object({
  headerVariant: z.string().default("header.centered"),
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
  dropdownVariant: z.string().default("dropdown.menu"),
  listGroupVariant: z.string().default("list.bordered"),
  paginationVariant: z.string().default("pagination.numbered"),
  progressVariant: z.string().default("progress.bar"),
});
export type Layout = z.infer<typeof layoutSchema>;
