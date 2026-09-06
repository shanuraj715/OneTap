                                                      
                                                      
                                             
import * as cards from "./cards";
                                             
import * as footers from "./footers";
                                             
import * as headers from "./headers";
import * as accordions from "./variants/accordions";
import * as alerts from "./variants/alerts";
import * as badges from "./variants/badges";
import * as buttons from "./variants/buttons";
import * as carousels from "./variants/carousels";
import * as chips from "./variants/chips";
import * as contentCards from "./variants/contentCards";
import * as dropdowns from "./variants/dropdowns";
import * as faqs from "./variants/faqs";
import * as listGroups from "./variants/listGroups";
import * as modals from "./variants/modals";
import * as pagination from "./variants/pagination";
import * as popovers from "./variants/popovers";
import * as progress from "./variants/progress";
import * as toasts from "./variants/toasts";
import { DatePicker, DatePickerInput } from "./DatePicker";
import { StatCard } from "./StatCard";
import { AnalyticsChart } from "./AnalyticsChart";

/**
 * The variant registry.
 *
 * Every layout slot has N interchangeable implementations; an outlet picks one by
 * id in `config.layout`. Each variant has a GLOBALLY UNIQUE `id` (slot-prefixed,
 * stored in config) and a short `code` for quick human reference — say "C07" or
 * "card.image-overlay" and there is exactly one thing it can mean.
 *
 * Adding a variant is one entry here. Adding a whole family is one VariantSlot.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
                                       
             
               
               
                      
                              
 

                                                                     
                          
                   
 

                                 
                     
                   
                 
                   
                        
                 
                    
 

                              
                                                       
              
                
                      
                                                              
                  
                          
                                                                 
 

/* ------------------------------------------------------------------- helpers */

const v =     (id        , code        , name        , description        , Component                  )                 => ({
  id, code, name, description, Component,
});

/* -------------------------------------------------------------- sample data */

const QA = [
  { q: "Do you deliver?", a: "Yes — within 3 km of Laxmi Nagar. Order ahead for pickup any time we're open." },
  { q: "Are the momos vegetarian?", a: "Everything on the menu is pure veg, prepared in a veg-only kitchen." },
  { q: "How long does an order take?", a: "Steamed momos are usually ready in 10–12 minutes; kurkure and tandoori take a little longer." },
];
const LIST = [
  { title: "Steamed Momos", meta: "6 items" },
  { title: "Kurkure Momos", meta: "3 items" },
  { title: "Beverages", meta: "3 items" },
];
const SLIDES = [
  { title: "Veg Steamed Momos", subtitle: "Bestseller · from ₹60" },
  { title: "Kurkure Momos", subtitle: "Crisp outside, juicy inside" },
  { title: "Tandoori Momos", subtitle: "Char-grilled, smoky" },
  { title: "Sweet Lassi", subtitle: "Thick and cold" },
];
const OPTIONS = ["Most popular", "Price: low to high", "Price: high to low", "Newest"];

/* ------------------------------------------------------------------ headers */

export const headerVariants                             = [
  v("header.centered", "H1", "Centered", "Name centred with the nav underneath", headers.HeaderCentered),
  v("header.left-logo", "H2", "Left logo", "Name left, nav right, one row", headers.HeaderLeftLogo),
  v("header.split-nav", "H3", "Split nav", "Nav either side of a centred name, with an Order button", headers.HeaderSplitNav),
  v("header.minimal", "H4", "Minimal", "Name only, small caps", headers.HeaderMinimal),
  v("header.top-bar", "H5", "Top bar", "Accent info bar above the main row", headers.HeaderTopBar),
  v("header.banner", "H6", "Banner", "Full accent band behind a centred name", headers.HeaderBanner),
  v("header.two-row", "H7", "Two row", "Brand row above a separate nav bar", headers.HeaderTwoRow),
  v("header.boxed", "H8", "Boxed brand", "Brand in a solid block on the left", headers.HeaderBoxed),
];

/* ------------------------------------------------------------------ footers */

export const footerVariants                             = [
  v("footer.two-column", "F1", "Two column", "Contact left, licences right", footers.FooterTwoColumn),
  v("footer.centered", "F2", "Centered", "Everything stacked and centred", footers.FooterCentered),
  v("footer.columns", "F3", "Columns", "Four columns — about, visit, contact, legal", footers.FooterColumns),
  v("footer.minimal-bar", "F4", "Minimal bar", "One compact line", footers.FooterMinimalBar),
  v("footer.brand-block", "F5", "Brand block", "Oversized restaurant name above the details", footers.FooterBrandBlock),
  v("footer.inverted", "F6", "Inverted", "Dark bar, reversed out", footers.FooterInverted),
  v("footer.contact", "F7", "Contact grid", "Find us, hours, phone and licences side by side", footers.FooterContact),
  v("footer.newsletter", "F8", "Newsletter", "Email sign-up beside the details", footers.FooterNewsletter),
];

/* --------------------------------------------------------------- item cards */

export const itemCardVariants                    = [
  { ...v("card.row-compact", "C01", "Compact row", "No image — name, description, price", cards.RowCompact), layout: "grid", minWidth: 320 },
  { ...v("card.row-thumb-left", "C02", "Thumbnail left", "Small square photo beside the text", cards.RowThumbLeft), layout: "grid", minWidth: 340, defaultColumns: 3 },
  { ...v("card.row-thumb-right", "C03", "Thumbnail right", "Photo on the trailing edge", cards.RowThumbRight), layout: "grid", minWidth: 340 },
  { ...v("card.image-top", "C04", "Image top", "Photo above the text, with an Add button", cards.ImageTop), layout: "grid", minWidth: 240 },
  { ...v("card.image-top-badge", "C05", "Image + price badge", "Price badged onto the photo", cards.ImageTopBadge), layout: "grid", minWidth: 240 },
  { ...v("card.text-above-image", "C06", "Text above image", "Name and price first, photo underneath", cards.TextAboveImage), layout: "grid", minWidth: 260 },
  { ...v("card.image-overlay", "C07", "Image overlay", "Full-bleed photo with text over a gradient", cards.ImageOverlay), layout: "grid", minWidth: 260 },
  { ...v("card.portrait", "C08", "Portrait", "Tall photo, centred text", cards.Portrait), layout: "grid", minWidth: 210 },
  { ...v("card.circle", "C09", "Circle", "Round photo, centred text", cards.Circle), layout: "grid", minWidth: 190 },
  { ...v("card.menu-line", "C10", "Printed menu line", "Name … price with a dotted leader", cards.MenuLine), layout: "list", minWidth: 0 },
  { ...v("card.featured-wide", "C11", "Featured wide", "Full-width hero card, photo beside the text", cards.FeaturedWide), layout: "list", minWidth: 0, defaultColumns: 2 },
];

/**
 * The grid a section's item cards render in — `display`/`className` for the
 * container, computed once here rather than duplicated in MenuSections.jsx
 * and MenuList.jsx.
 *
 *  - `columns` (a section's explicit choice, 0 = unset) wins when given —
 *    a fixed, responsive N-up grid via the `.ot-grid-cols-N` classes in
 *    tokens.css (collapses toward 1 column on a narrow screen regardless
 *    of N; see the CSS for the exact breakpoints).
 *  - otherwise a variant's own `defaultColumns` (set for a couple of card
 *    styles — C02, C11 — that don't look right left to size themselves).
 *  - otherwise the variant's original behaviour: a "list" layout stacks in
 *    one column, a "grid" layout self-sizes via `minWidth` + `auto-fill`.
 *
 * @param {{ layout: "grid" | "list"; minWidth: number; defaultColumns?: number; id: string }} variant
 * @param {number} [columns] a section's explicit override, 0 or undefined = use the variant's own default
 * @returns {{ className?: string; style?: Record<string, unknown> }}
 */
export function gridPropsFor(variant, columns) {
  const explicit = columns || variant.defaultColumns;
  if (explicit) {
    return { className: `ot-grid ot-grid-cols-${Math.min(6, Math.max(1, explicit))}` };
  }
  if (variant.layout === "list") {
    return { style: { display: "flex", flexDirection: "column", gap: variant.id === "card.menu-line" ? 0 : 12 } };
  }
  return {
    style: { display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${variant.minWidth}px, 1fr))`, gap: 12 },
  };
}

/* ------------------------------------------------------------- new families */

export const buttonVariants = [
  v("button.solid", "BTN01", "Solid", "Filled with the brand colour", buttons.ButtonSolid),
  v("button.outline", "BTN02", "Outline", "Border only", buttons.ButtonOutline),
  v("button.soft", "BTN03", "Soft", "Tinted fill, no border", buttons.ButtonSoft),
  v("button.pill", "BTN04", "Pill", "Fully rounded", buttons.ButtonPill),
  v("button.square", "BTN05", "Square", "No corner radius", buttons.ButtonSquare),
  v("button.ghost", "BTN06", "Ghost", "Text only until hovered", buttons.ButtonGhost),
  v("button.link", "BTN07", "Link", "Underlined text", buttons.ButtonLink),
  v("button.elevated", "BTN08", "Elevated", "Soft coloured shadow", buttons.ButtonElevated),
  v("button.offset", "BTN09", "Offset", "Hard offset shadow", buttons.ButtonOffset),
  v("button.uppercase", "BTN10", "Uppercase", "Wide tracking, small caps", buttons.ButtonUppercase),
];

export const badgeVariants = [
  v("badge.solid", "BDG01", "Solid", "Filled with the status colour", badges.BadgeSolid),
  v("badge.soft", "BDG02", "Soft", "Tinted wash", badges.BadgeSoft),
  v("badge.outline", "BDG03", "Outline", "Border only", badges.BadgeOutline),
  v("badge.pill", "BDG04", "Pill", "Fully rounded", badges.BadgePill),
  v("badge.dot", "BDG05", "Status dot", "Leading dot before the label", badges.BadgeDot),
  v("badge.accent", "BDG06", "Accent bar", "Left accent rule", badges.BadgeAccent),
  v("badge.micro", "BDG07", "Micro label", "Uppercase text, no container", badges.BadgeMicro),
  v("badge.brand", "BDG08", "Brand", "Brand colour, square", badges.BadgeBrand),
];

export const chipVariants = [
  v("chip.solid", "CHP01", "Solid", "Fills with the brand colour when selected", chips.ChipSolid),
  v("chip.soft", "CHP02", "Soft", "Tinted when selected", chips.ChipSoft),
  v("chip.square", "CHP03", "Square", "Small corner radius", chips.ChipSquare),
  v("chip.tick", "CHP04", "Tick", "Shows a tick when selected", chips.ChipTick),
  v("chip.filled", "CHP05", "Filled", "Surface fill, no border", chips.ChipFilled),
  v("chip.underline", "CHP06", "Underline", "Rule instead of a container", chips.ChipUnderline),
  v("chip.compact", "CHP07", "Compact", "Dense filter style", chips.ChipCompact),
  v("chip.dot", "CHP08", "Dot", "Leading state dot", chips.ChipDot),
];

export const alertVariants = [
  v("alert.left-accent", "ALT01", "Left accent", "Accent bar over a wash", alerts.AlertLeftAccent),
  v("alert.soft", "ALT02", "Soft", "Tinted wash, no border", alerts.AlertSoft),
  v("alert.outline", "ALT03", "Outline", "Border only", alerts.AlertOutline),
  v("alert.icon", "ALT04", "Icon", "Round status icon on the left", alerts.AlertIcon),
  v("alert.banner", "ALT05", "Banner", "Solid status colour", alerts.AlertBanner),
  v("alert.top-rule", "ALT06", "Top rule", "Accent rule across the top", alerts.AlertTopRule),
  v("alert.inline", "ALT07", "Inline", "One compact line", alerts.AlertInline),
];

export const toastVariants = [
  v("toast.solid", "TST01", "Solid", "Filled with the status colour", toasts.ToastSolid),
  v("toast.card", "TST02", "Card", "Surface card with a status icon", toasts.ToastCard),
  v("toast.stripe", "TST03", "Stripe", "Left accent stripe", toasts.ToastStripe),
  v("toast.soft", "TST04", "Soft", "Tinted wash", toasts.ToastSoft),
  v("toast.pill", "TST05", "Pill", "Dark pill, single line", toasts.ToastPill),
  v("toast.timer", "TST06", "Timer", "Progress bar shows the dismiss countdown", toasts.ToastTimer),
  v("toast.minimal", "TST07", "Minimal", "Text and a rule, no chrome", toasts.ToastMinimal),
];

export const modalVariants = [
  v("modal.centered", "MDL01", "Centered", "Plain centred card", modals.ModalCentered),
  v("modal.header-bar", "MDL02", "Header bar", "Brand-coloured title bar", modals.ModalHeaderBar),
  v("modal.sheet", "MDL03", "Sheet", "Bottom sheet with a grab handle", modals.ModalSheet),
  v("modal.drawer", "MDL04", "Drawer", "Full-height side panel", modals.ModalDrawer),
  v("modal.confirm", "MDL05", "Confirm", "Compact, two equal buttons", modals.ModalConfirm),
  v("modal.accent", "MDL06", "Top accent", "Accent rule across the top", modals.ModalAccent),
  v("modal.divided", "MDL07", "Divided", "Separated header, body and footer", modals.ModalDivided),
  v("modal.elevated", "MDL08", "Elevated", "Borderless, deep shadow", modals.ModalElevated),
];

export const popoverVariants = [
  v("popover.card", "POP01", "Card", "Card below the trigger", popovers.PopoverCard),
  v("popover.tooltip", "POP02", "Tooltip", "Small dark bubble", popovers.PopoverTooltip),
  v("popover.arrow", "POP03", "Arrow", "Card with a pointer", popovers.PopoverArrow),
  v("popover.top", "POP04", "Above", "Opens upward", popovers.PopoverTop),
  v("popover.side", "POP05", "Side", "Opens to the right", popovers.PopoverSide),
  v("popover.brand", "POP06", "Brand", "Brand-coloured bubble", popovers.PopoverBrand),
  v("popover.flat", "POP07", "Flat", "Wide, square, no shadow", popovers.PopoverFlat),
];

export const accordionVariants = [
  v("accordion.bordered", "ACC01", "Bordered", "Box with divided rows", accordions.AccordionBordered),
  v("accordion.cards", "ACC02", "Cards", "Each row a separate card", accordions.AccordionCards),
  v("accordion.minimal", "ACC03", "Minimal", "Hairline rules only", accordions.AccordionMinimal),
  v("accordion.plus", "ACC04", "Plus / minus", "Plus marker instead of a chevron", accordions.AccordionPlus),
  v("accordion.filled", "ACC05", "Filled", "Open row gets a filled header", accordions.AccordionFilled),
  v("accordion.accent", "ACC06", "Accent", "Accent bar on the open row", accordions.AccordionAccent),
  v("accordion.numbered", "ACC07", "Numbered", "Numbered rows", accordions.AccordionNumbered),
  v("accordion.multi", "ACC08", "Multi-open", "Several rows open at once", accordions.AccordionMulti),
];

export const faqVariants = [
  v("faq.stacked", "FAQ01", "Stacked", "All answers visible", faqs.FaqStacked),
  v("faq.two-column", "FAQ02", "Two column", "Questions in two columns", faqs.FaqTwoColumn),
  v("faq.split", "FAQ03", "Split", "Heading left, questions right", faqs.FaqSplit),
  v("faq.cards", "FAQ04", "Cards", "Each Q&A in its own card", faqs.FaqCards),
  v("faq.collapsible", "FAQ05", "Collapsible", "One answer open at a time", faqs.FaqCollapsible),
  v("faq.numbered", "FAQ06", "Numbered", "Numbered question list", faqs.FaqNumbered),
  v("faq.centered", "FAQ07", "Centered", "Narrow, centred measure", faqs.FaqCentered),
];

export const contentCardVariants = [
  v("content.image-top", "CNT01", "Image top", "Photo above the text", contentCards.ContentImageTop),
  v("content.plain", "CNT02", "Plain", "No photo", contentCards.ContentPlain),
  v("content.horizontal", "CNT03", "Horizontal", "Photo beside the text", contentCards.ContentHorizontal),
  v("content.overlay", "CNT04", "Overlay", "Text over a full-bleed photo", contentCards.ContentOverlay),
  v("content.top-accent", "CNT05", "Top accent", "Accent rule across the top", contentCards.ContentTopAccent),
  v("content.offset", "CNT06", "Offset", "Hard offset shadow", contentCards.ContentOffset),
  v("content.elevated", "CNT07", "Elevated", "Borderless with a soft shadow", contentCards.ContentElevated),
  v("content.editorial", "CNT08", "Editorial", "Rule above, no container", contentCards.ContentEditorial),
];

export const carouselVariants = [
  v("carousel.slider", "CRS01", "Slider", "One slide, arrows and dots", carousels.CarouselSlider),
  v("carousel.strip", "CRS02", "Strip", "Horizontal scrolling row", carousels.CarouselStrip),
  v("carousel.peek", "CRS03", "Peek", "Next slide partly visible", carousels.CarouselPeek),
  v("carousel.thumbs", "CRS04", "Thumbnails", "Thumbnail strip below", carousels.CarouselThumbs),
  v("carousel.quotes", "CRS05", "Quotes", "Text-only rotator", carousels.CarouselQuotes),
  v("carousel.hero", "CRS06", "Hero", "Full-bleed with a counter", carousels.CarouselHero),
  v("carousel.stack", "CRS07", "Stack", "Stacked cards, tap to advance", carousels.CarouselStack),
];

export const dropdownVariants = [
  v("dropdown.menu", "DRP01", "Menu", "Standard bordered trigger", dropdowns.DropdownMenu),
  v("dropdown.pill", "DRP02", "Pill", "Rounded trigger", dropdowns.DropdownPill),
  v("dropdown.solid", "DRP03", "Solid", "Brand-coloured trigger", dropdowns.DropdownSolid),
  v("dropdown.underline", "DRP04", "Underline", "Rule instead of a box", dropdowns.DropdownUnderline),
  v("dropdown.flat", "DRP05", "Flat", "Square, no shadow", dropdowns.DropdownFlat),
  v("dropdown.soft", "DRP06", "Soft", "Tinted trigger", dropdowns.DropdownSoft),
  v("dropdown.select", "DRP07", "Select", "Wide, form-select style", dropdowns.DropdownSelect),
];

export const listGroupVariants = [
  v("list.bordered", "LST01", "Bordered", "Box with divided rows", listGroups.ListBordered),
  v("list.cards", "LST02", "Cards", "Each row a separate card", listGroups.ListCards),
  v("list.flush", "LST03", "Flush", "Hairline rules only", listGroups.ListFlush),
  v("list.numbered", "LST04", "Numbered", "Numbered rows", listGroups.ListNumbered),
  v("list.accent", "LST05", "Accent", "Leading accent bar", listGroups.ListAccent),
  v("list.stacked", "LST06", "Stacked", "Two lines per row", listGroups.ListStacked),
  v("list.striped", "LST07", "Striped", "Alternating row fill", listGroups.ListStriped),
  v("list.chevron", "LST08", "Chevron", "Trailing chevron, tappable", listGroups.ListChevron),
];

export const paginationVariants = [
  v("pagination.numbered", "PAG01", "Numbered", "Numbers with prev / next", pagination.PaginationNumbered),
  v("pagination.pills", "PAG02", "Pills", "Round page buttons", pagination.PaginationPills),
  v("pagination.joined", "PAG03", "Joined", "Single segmented control", pagination.PaginationJoined),
  v("pagination.prev-next", "PAG04", "Prev / next", "Two buttons and a counter", pagination.PaginationPrevNext),
  v("pagination.underline", "PAG05", "Underline", "Active page underlined", pagination.PaginationUnderline),
  v("pagination.dots", "PAG06", "Dots", "Dot indicators", pagination.PaginationDots),
  v("pagination.load-more", "PAG07", "Load more", "Single button, no page numbers", pagination.PaginationLoadMore),
];

export const progressVariants = [
  v("progress.bar", "PRG01", "Bar", "Rounded bar with a label", progress.ProgressBar),
  v("progress.thick", "PRG02", "Thick", "Value shown inside the bar", progress.ProgressThick),
  v("progress.line", "PRG03", "Line", "Hairline, square", progress.ProgressLine),
  v("progress.striped", "PRG04", "Striped", "Diagonal stripes", progress.ProgressStriped),
  v("progress.segments", "PRG05", "Segments", "Ten discrete blocks", progress.ProgressSegments),
  v("progress.ring", "PRG06", "Ring", "Circular dial", progress.ProgressRing),
  v("progress.steps", "PRG07", "Steps", "Numbered order stages", progress.ProgressSteps),
  v("progress.gradient", "PRG08", "Gradient", "Gradient fill", progress.ProgressGradient),
];

export const datePickerVariants = [
  v("datepicker.ring", "DP01", "Ring selection (Material)", "Circle outline on selected date with theme color accent", DatePicker),
  v("datepicker.filled", "DP02", "Filled selection", "Solid theme color fill on selected date", (props) => <DatePicker {...props} variant="filled" />),
  v("datepicker.input", "DP03", "Popover input", "Calendar input trigger that opens the picker on click", (props) => (
    <DatePickerInput {...props} label="Select date" />
  )),
  v("datepicker.themed-amber", "DP04", "Themed amber", "DatePicker styled with custom amber brand color", (props) => (
    <DatePicker {...props} themeColor="#d97706" />
  )),
  v("datepicker.themed-emerald", "DP05", "Themed emerald", "DatePicker styled with emerald green brand color", (props) => (
    <DatePicker {...props} themeColor="#10b981" />
  )),
];

export const statCardVariants = [
  v("stat.users", "MC01", "Users sparkline", "Positive trend with green sparkline and badge", () => (
    <StatCard title="Users" value="14k" change="+25%" subtitle="Last 30 days" tone="positive" />
  )),
  v("stat.conversions", "MC02", "Conversions sparkline", "Negative trend with red sparkline and badge", () => (
    <StatCard
      title="Conversions"
      value="325"
      change="-25%"
      subtitle="Last 30 days"
      tone="negative"
      data={[35, 30, 32, 31, 28, 33, 29, 31, 30, 24, 27, 26, 29, 28, 27, 26, 25]}
    />
  )),
  v("stat.events", "MC03", "Event count sparkline", "Neutral trend with slate sparkline and badge", () => (
    <StatCard
      title="Event count"
      value="200k"
      change="+5%"
      subtitle="Last 30 days"
      tone="neutral"
      data={[15, 18, 17, 19, 18, 22, 17, 18, 20, 18, 17, 19, 18, 20, 17, 18, 18]}
    />
  )),
];

export const analyticsChartVariants = [
  v("chart.sessions", "CHT01", "Sessions stacked area", "Multi-layer stacked area chart with axis labels and grid lines", AnalyticsChart),
];

/* -------------------------------------------------------------------- slots */

const headerProps = (ctx                )              => ({
  name: ctx.outletName,
  tagline: ctx.tagline,
  phone: ctx.phone,
  links: [
    { label: "Menu", href: "#" },
    { label: "Order at table", href: "#" },
    { label: "About", href: "#" },
  ],
});

const footerProps = (ctx                )              => ({
  name: ctx.outletName,
  address: ctx.address,
  phone: ctx.phone,
  fssaiLicense: ctx.fssaiLicense,
  gstin: ctx.gstin,
});

export const VARIANT_SLOTS                = [
  {
    key: "headerVariant",
    label: "Headers",
    description: "Top of every storefront page",
    flush: true,
    variants: headerVariants,
    preview: ({ Component: C }, ctx) => <C {...headerProps(ctx)} />,
  },
  {
    key: "itemCardVariant",
    label: "Menu item cards",
    description: "How each menu item is drawn",
    variants: itemCardVariants,
    preview: (meta, ctx) => {
      const m = meta                   ;
      const C = m.Component;
      const style =
        m.layout === "list"
          ? { display: "flex", flexDirection: "column"         , gap: m.id === "card.menu-line" ? 0 : 12 }
          : { display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${m.minWidth}px, 1fr))`, gap: 12 };
      return (
        <div style={style}>
          {ctx.items.map((item) => (
            <C key={item.id} item={item} />
          ))}
        </div>
      );
    },
  },
  {
    key: "buttonVariant",
    label: "Buttons",
    description: "Primary actions across the storefront",
    variants: buttonVariants,
    preview: ({ Component: C }) => (
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <C>Order takeaway</C>
        <C>Add to cart</C>
        <C disabled>Sold out</C>
      </div>
    ),
  },
  {
    key: "badgeVariant",
    label: "Badges",
    description: "Small status labels",
    variants: badgeVariants,
    preview: ({ Component: C }) => (
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <C tone="success">Available</C>
        <C tone="warning">Low stock</C>
        <C tone="danger">Sold out</C>
        <C tone="info">New</C>
      </div>
    ),
  },
  {
    key: "chipVariant",
    label: "Chips",
    description: "Filters and removable selections",
    variants: chipVariants,
    preview: ({ Component: C }) => (
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <C selected>Steamed</C>
        <C>Kurkure</C>
        <C>Tandoori</C>
        <C removable>Under ₹150</C>
      </div>
    ),
  },
  {
    key: "alertVariant",
    label: "Alerts",
    description: "Inline messages on a page",
    variants: alertVariants,
    preview: ({ Component: C }) => (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <C tone="success" title="Order confirmed">We&apos;ll have it ready in about 12 minutes.</C>
        <C tone="warning" title="Closing soon">Last orders at 9:45 pm.</C>
      </div>
    ),
  },
  {
    key: "toastVariant",
    label: "Toasts",
    description: "Transient confirmations",
    variants: toastVariants,
    preview: ({ Component: C }) => (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <C tone="success" title="Added to cart" message="Veg Steamed Momos (8 pcs)" />
        <C tone="danger" title="Couldn't place order" message="Check your connection and try again." />
      </div>
    ),
  },
  {
    key: "modalVariant",
    label: "Modals",
    description: "Dialog panels — shown here without their overlay",
    variants: modalVariants,
    preview: ({ Component: C }) => (
      <C title="Remove this item?">This will empty your cart of Veg Steamed Momos.</C>
    ),
  },
  {
    key: "popoverVariant",
    label: "Popovers",
    description: "Anchored bubbles — click the trigger",
    variants: popoverVariants,
    preview: ({ Component: C }) => (
      <div style={{ paddingBottom: 130 }}>
        <C label="Delivery info">Free delivery within 3 km. Orders under ₹200 add a ₹25 fee.</C>
      </div>
    ),
  },
  {
    key: "accordionVariant",
    label: "Accordions",
    description: "Collapsible rows",
    variants: accordionVariants,
    preview: ({ Component: C }) => <C items={QA} />,
  },
  {
    key: "faqVariant",
    label: "FAQ sections",
    description: "Whole page blocks, heading included",
    variants: faqVariants,
    preview: ({ Component: C }) => <C items={QA} />,
  },
  {
    key: "contentCardVariant",
    label: "Content cards",
    description: "For CMS pages — offers, stories, locations",
    variants: contentCardVariants,
    preview: ({ Component: C }) => (
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <C tag="Offer" title="Unlimited momos, ₹99" body="Every Tuesday, dine-in only, 3 pm to 6 pm." imageSeed="Unlimited momos" />
        <C tag="Story" title="Made fresh all day" body="Dough rolled every two hours, never held overnight." imageSeed="Fresh dough" />
      </div>
    ),
  },
  {
    key: "carouselVariant",
    label: "Carousels",
    description: "Rotating galleries and highlights",
    variants: carouselVariants,
    preview: ({ Component: C }) => (
      <div style={{ maxWidth: 460 }}>
        <C items={SLIDES} />
      </div>
    ),
  },
  {
    key: "popupCarouselVariant",
    label: "Popup item carousel",
    description: "Carousel style used in the item popup when an item has multiple photos",
    variants: carouselVariants,
    preview: ({ Component: C }) => (
      <div style={{ maxWidth: 420 }}>
        <C items={SLIDES} />
      </div>
    ),
  },
  {
    key: "dropdownVariant",
    label: "Dropdowns",
    description: "Sorting and selection menus — click to open",
    variants: dropdownVariants,
    preview: ({ Component: C }) => (
      <div style={{ paddingBottom: 190 }}>
        <C label="Sort by" options={OPTIONS} />
      </div>
    ),
  },
  {
    key: "listGroupVariant",
    label: "List groups",
    description: "Categories, order history, settings rows",
    variants: listGroupVariants,
    preview: ({ Component: C }) => (
      <div style={{ maxWidth: 400 }}>
        <C items={LIST} />
      </div>
    ),
  },
  {
    key: "paginationVariant",
    label: "Pagination",
    description: "Paging through long lists",
    variants: paginationVariants,
    preview: ({ Component: C }) => <C page={2} pages={5} />,
  },
  {
    key: "progressVariant",
    label: "Progress",
    description: "Order status and loading indicators",
    variants: progressVariants,
    preview: ({ Component: C }) => (
      <div style={{ maxWidth: 380, display: "flex", flexDirection: "column", gap: 14 }}>
        <C value={62} label="Order progress" />
      </div>
    ),
  },
  {
    key: "datePickerVariant",
    label: "Date Pickers",
    description: "Calendar date selection with month/year navigation, circular day ring, and theme color support",
    variants: datePickerVariants,
    preview: ({ Component: C }) => (
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
        <C />
      </div>
    ),
  },
  {
    key: "statCardVariant",
    label: "Metric Sparkline Cards",
    description: "Summary statistic cards with smooth SVG sparkline trends and change badges",
    variants: statCardVariants,
    preview: ({ Component: C }) => (
      <div style={{ maxWidth: 280 }}>
        <C />
      </div>
    ),
  },
  {
    key: "analyticsChartVariant",
    label: "Analytics Charts",
    description: "Stacked area visualizations with axes, ticks, and legend",
    variants: analyticsChartVariants,
    preview: ({ Component: C }) => (
      <div style={{ maxWidth: 660 }}>
        <C />
      </div>
    ),
  },
  {
    key: "footerVariant",
    label: "Footers",
    description: "Carries the FSSAI licence and GSTIN",
    flush: true,
    variants: footerVariants,
    preview: ({ Component: C }, ctx) => <C {...footerProps(ctx)} />,
  },
];

export const slotByKey = (key        ) => VARIANT_SLOTS.find((s) => s.key === key);

/** Every variant across every family. */
export const allVariants                = VARIANT_SLOTS.flatMap((s) => s.variants);

/**
 * Resolve by id, short code, or a legacy unprefixed id, falling back to the
 * first variant so a bad config can never blank the page.
 */
function pick                                        (list     , ref                    )    {
  if (!ref) return list[0] ;
  const needle = ref.toLowerCase();
  return (
    list.find((x) => x.id.toLowerCase() === needle) ??
    list.find((x) => x.code.toLowerCase() === needle) ??
    list.find((x) => x.id.split(".")[1]?.toLowerCase() === needle) ??
    list[0] 
  );
}

export const getHeaderVariant = (ref         ) => pick(headerVariants, ref);
export const getFooterVariant = (ref         ) => pick(footerVariants, ref);
export const getItemCardVariant = (ref         ) => pick(itemCardVariants, ref);
export const getCarouselVariant = (ref         ) => pick(carouselVariants, ref);
export const getVariant = (slotKey        , ref         ) => pick(slotByKey(slotKey)?.variants ?? allVariants, ref);
