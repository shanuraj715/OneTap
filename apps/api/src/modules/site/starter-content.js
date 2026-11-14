/**
 * The TablePe website's starter content — settings and pages written about
 * what the product actually does, ready to edit in the console. Used by
 * scripts/seed-website.js (and tests). No made-up customer quotes: the
 * Testimonials section is left for real ones.
 */

let n = 0;
const id = (p) => `${p}-${(++n).toString(36)}`;

export const starterSettings = {
  brandName: "TablePe",
  tagline: "Restaurant ordering, from table to kitchen.",
  brandColor: "#C8372D",
  seo: {
    titleTemplate: "%s · TablePe",
    description: "QR table ordering, staff ordering on phones, your own online ordering site and kitchen printing for restaurants. One live order screen, no commission.",
  },
  announcement: { show: false, text: "", href: "" },
  footerNote: "Made in India for restaurants that run on speed.",
};

const FAQ_CORE = [
  {
    q: "Can I buy a plan online?",
    a: "No — every store is set up by our team: your menu, tables, QR cards, printers, payments and your own web address. Tell us about your restaurant and we'll recommend the right plan and get you live.",
  },
  {
    q: "Do you take a commission on my orders?",
    a: "No. You pay a fixed plan price. Online payments go through your own Razorpay account and settle straight to you — we never hold your money.",
  },
  {
    q: "Do my customers need to download an app?",
    a: "No. They scan the QR on the table, or open your website, and order in the browser on their phone. Nothing to install.",
  },
  {
    q: "Can my staff take orders on their own phones?",
    a: "Yes. Waiters pick the table, add dishes with their sizes and add-ons, enter the customer's mobile number and send it straight to the kitchen — from any phone, tablet or laptop.",
  },
  {
    q: "Can I use my own domain?",
    a: "On our higher plans, yes — your ordering site runs on your own domain, like yourrestaurant.com. Every plan gets its own web address on TablePe, in your colours and fonts, so customers order from you — not from a marketplace.",
  },
  {
    q: "Does it print kitchen tickets?",
    a: "Yes. When you accept an order, the kitchen ticket and the bill print on the printers you choose. We check your printers during setup.",
  },
];

const FAQ_MORE = [
  {
    q: "How long does setup take?",
    a: "Typically a few days, depending on how big your menu is and how many outlets you have. We do the setup with you.",
  },
  {
    q: "Can I run more than one outlet?",
    a: "Yes, on plans with multiple outlets. Each outlet has its own menu, tables and orders; your look and your customers' coins are shared across all of them.",
  },
  {
    q: "How does delivery work?",
    a: "You set your delivery radius and fee. Customers outside the radius can't place a delivery order, and delivery orders are paid online before they reach your kitchen.",
  },
  {
    q: "Is my data safe?",
    a: "Payment gateway keys are encrypted before they're stored, and card details never reach our servers — your gateway's own checkout collects them.",
  },
  {
    q: "Can I change my plan later?",
    a: "Yes. Contact us and we'll move you to the plan that fits — your menu, orders and customers stay exactly as they are.",
  },
];

const home = {
  slug: "home",
  title: "Restaurant ordering, from table to kitchen",
  status: "published",
  system: true,
  seo: {
    title: "TablePe — QR ordering & online orders for restaurants",
    description: "QR table ordering, staff ordering on phones, your own ordering website and kitchen printing — one live order screen for every outlet. No commission.",
  },
  nav: { show: false, label: "", order: 0 },
  sections: [
    {
      id: id("hero"),
      type: "hero",
      eyebrow: "The ordering platform for restaurants",
      heading: "Orders from the table, the floor and the web — straight to your kitchen.",
      subheading:
        "Guests scan and order from their seat. Waiters take orders on their phones. Regulars order from your own website. Every order lands on one live screen and prints in the kitchen — with no commission on any of it.",
      primary: { label: "Book a free demo", href: "/contact" },
      secondary: { label: "See pricing", href: "/pricing" },
      note: "Set up for you · No commission · No app for your guests",
      stats: [
        { value: "0%", label: "commission on your orders" },
        { value: "3 ways", label: "QR, staff phones, your website" },
        { value: "1 screen", label: "for every order, every outlet" },
      ],
    },
    {
      id: id("logos"),
      type: "logos",
      eyebrow: "Trusted by",
      heading: "Restaurants already ordering with TablePe",
      items: [{ name: "Gazab Momos", logo: "", href: "" }],
    },
    {
      id: id("product"),
      type: "productTabs",
      anchor: "product",
      eyebrow: "The product",
      heading: "One platform. Every way your guests order.",
      intro: "From the QR on the table to the ticket in the kitchen — and the coins that bring guests back.",
      items: [
        {
          label: "QR ordering",
          icon: "qr-code",
          heading: "Guests order from their table",
          text: "Every table gets its own QR. Guests scan, browse your menu with photos and order — no app, no waiting for a waiter.",
          points: [
            "No app to download — it opens in the phone's browser",
            "Orders come to you to approve before the kitchen sees them",
            "The table is held for the party until their bill is settled",
            "Their bill keeps running across every round",
          ],
          visual: "qr",
          button: { label: "Talk to us", href: "/contact" },
        },
        {
          label: "Staff ordering",
          icon: "concierge-bell",
          heading: "Every waiter becomes an order-taker",
          text: "Staff take orders on their own phones: pick the table, add dishes with sizes, add-ons and kitchen notes, and send it straight to the kitchen.",
          points: [
            "Works on any phone, tablet or laptop",
            "Returning guests recognised by their mobile number",
            "Kitchen notes like “less spicy” go on the ticket",
            "Move a party to another table with their whole bill",
          ],
          visual: "staff",
        },
        {
          label: "Your website",
          icon: "globe",
          heading: "Takeaway and delivery on your own website",
          text: "Your own ordering site at its own web address, in your colours and fonts. Customers order from you — not from a marketplace that takes a cut.",
          points: [
            "Your address, your brand, your customer list",
            "Delivery radius and fees you set",
            "Online payments settle straight to your own account",
            "Dozens of layouts and styles to choose from",
          ],
          visual: "online",
        },
        {
          label: "Kitchen",
          icon: "printer",
          heading: "Tickets that print themselves",
          text: "Accept an order and the kitchen ticket and the bill print on the printers you choose — with every size, add-on and note on them.",
          points: ["Kitchen tickets (KOT) and bills, automatically", "Reprint a lost ticket in one tap", "Different printers for kitchen and counter"],
          visual: "kitchen",
        },
        {
          label: "Live orders",
          icon: "layout-dashboard",
          heading: "Every order on one live screen",
          text: "QR, staff and online orders land on one screen the moment they're placed, with timers that flag anything running late.",
          points: ["New orders appear without refreshing", "Timers and alerts for late orders", "Every outlet from one dashboard"],
          visual: "dashboard",
        },
        {
          label: "Loyalty",
          icon: "coins",
          heading: "Bring regulars back",
          text: "Guests earn coins on every order and spend them next time. Add coupons and WhatsApp or SMS updates, and you have a loyalty programme without another app.",
          points: ["Coins earned on what guests actually pay", "Coupons with limits and dates", "Order updates on WhatsApp or SMS"],
          visual: "loyalty",
        },
      ],
    },
    {
      id: id("stats"),
      type: "stats",
      heading: "Built for the rush. Priced for the long run.",
      items: [
        { value: "0%", label: "commission on any order" },
        { value: "3 ways", label: "to order: QR, waiter phones and your website" },
        { value: "1 screen", label: "for every order from every outlet" },
        { value: "Done for you", label: "setup: menu, tables, QR cards and printers" },
      ],
    },
    {
      id: id("features"),
      type: "features",
      anchor: "why",
      eyebrow: "Why TablePe",
      heading: "Everything between \"I'll have the momos\" and the kitchen ticket.",
      intro: "One system for taking, tracking, printing and rewarding every order — built around how a busy restaurant actually works.",
      items: [
        { icon: "qr-code", title: "QR table ordering", text: "Guests scan the code on their table and order from their seat. The table is held for their party, and their bill keeps running until they pay." },
        { icon: "concierge-bell", title: "Take orders on any phone", text: "Waiters pick the table, add dishes with sizes, add-ons and kitchen notes, and send it to the kitchen. Returning customers are recognised by their number." },
        { icon: "globe", title: "Your own ordering website", text: "Takeaway and delivery on your own web address, in your colours and fonts — customers order from you, not from a marketplace." },
        { icon: "printer", title: "Kitchen tickets that print themselves", text: "Accept an order and the kitchen ticket and bill print where you've set them to. No shouting across the pass." },
        { icon: "coins", title: "Coins that bring regulars back", text: "Customers earn coins on what they pay and spend them on their next visit — your loyalty programme, with no extra app." },
        { icon: "message-circle", title: "WhatsApp & SMS updates", text: "Customers hear when their order is accepted and ready, from your own WhatsApp or SMS account." },
        { icon: "ticket-percent", title: "Coupons", text: "Discount codes with minimum order values, limits and dates — checked automatically at checkout." },
        { icon: "store", title: "Every outlet, one dashboard", text: "Run several outlets with their own menus and tables, and one look and one customer list across all of them." },
        { icon: "palette", title: "Your brand, not ours", text: "Pick from dozens of layouts, themes and visual styles for your ordering site — and design your own printable table QR cards." },
      ],
    },
    {
      id: id("audience"),
      type: "audience",
      anchor: "who",
      eyebrow: "Who it's for",
      heading: "Made for restaurants where every minute at the counter counts.",
      items: [
        { icon: "coffee", title: "Cafés & quick-service", text: "Cut the queue: guests order and pay from the table, and the counter only hands food over." },
        { icon: "soup", title: "Street-food & momo chains", text: "High volume, small menus, many outlets — one menu editor and one order screen for all of them." },
        { icon: "bike", title: "Cloud kitchens", text: "Your own takeaway and delivery site with delivery radius, fees and online payment — no marketplace commission." },
        { icon: "utensils", title: "Family & casual dining", text: "Table service on staff phones, running bills per table, and kitchen tickets that print on their own." },
      ],
    },
    {
      id: id("usecases"),
      type: "useCases",
      anchor: "when",
      eyebrow: "When to use TablePe",
      heading: "The moments TablePe pays for itself.",
      items: [
        { icon: "clock", when: "When the queue is out the door", text: "Let guests order from their table while your counter staff hand out food instead of taking orders." },
        { icon: "receipt", when: "When orders go missing between floor and kitchen", text: "Every order is on one live screen with timers, and its kitchen ticket prints the moment it's accepted." },
        { icon: "bike", when: "When marketplace commissions eat your margin", text: "Send regulars to your own ordering site and keep the full value of every order." },
        { icon: "store", when: "When you open your second outlet", text: "Add the outlet, copy your menu across, and run both from the same dashboard." },
        { icon: "users", when: "When Friday night stretches your staff", text: "Every waiter becomes an order-taker with their own phone — no queue at the till." },
        { icon: "coins", when: "When you want regulars to come back", text: "Coins on every order give customers a reason to return — and you see who your regulars are." },
      ],
    },
    {
      id: id("pricing"),
      type: "pricing",
      anchor: "pricing",
      eyebrow: "Pricing",
      heading: "Simple plans. Set up for you.",
      intro: "Every plan is set up by our team — menu, tables, QR cards, printers and your web address. No commission on orders.",
      note: "",
    },
    { id: id("faq"), type: "faq", eyebrow: "FAQ", heading: "Questions restaurants ask us", items: FAQ_CORE },
    {
      id: id("demo"),
      type: "contact",
      anchor: "demo",
      eyebrow: "Book a free demo",
      heading: "See TablePe with your own menu",
      intro: "Tell us about your restaurant. We'll call you, show you TablePe with your menu and recommend a plan — there's nothing to buy online.",
      showDetails: true,
    },
  ],
};

const pricing = {
  slug: "pricing",
  title: "Pricing",
  status: "published",
  seo: {
    title: "Pricing",
    description: "TablePe plans for single restaurants and multi-outlet brands. Every plan includes setup by our team and no commission on your orders.",
  },
  nav: { show: true, label: "Pricing", order: 10 },
  footerGroup: "product",
  sections: [
    {
      id: id("pricing"),
      type: "pricing",
      eyebrow: "Pricing",
      heading: "Plans that grow with your restaurant",
      intro: "Every plan is set up by our team. Pick a plan and talk to us — we'll confirm what fits and get you live.",
      included: [
        "Setup by our team: menu, tables, QR cards and printers",
        "Your own ordering website (own domain on higher plans)",
        "Unlimited menu items and orders",
        "No commission on any order",
        "Live orders screen with timers",
        "New features as TablePe improves",
      ],
      compare: true,
      note: "Prices shown exclude GST. Online payment and SMS/WhatsApp message charges are billed by those providers, not by us.",
    },
    { id: id("faq"), type: "faq", eyebrow: "Questions", heading: "About plans and setup", items: [FAQ_CORE[0], FAQ_CORE[1], FAQ_MORE[0], FAQ_MORE[4]] },
    { id: id("cta"), type: "cta", heading: "Not sure which plan?", text: "Tell us how many outlets and staff you have — we'll recommend one.", button: { label: "Talk to us", href: "/contact" } },
  ],
};

const faq = {
  slug: "faq",
  title: "Frequently asked questions",
  status: "published",
  seo: { title: "FAQ", description: "Answers about TablePe: setup, commission, QR ordering, staff ordering, your own domain, printing, delivery and data safety." },
  nav: { show: true, label: "FAQ", order: 20 },
  footerGroup: "product",
  sections: [
    { id: id("faq"), type: "faq", eyebrow: "FAQ", heading: "Everything restaurants ask us", intro: "Can't find your answer? Talk to us — a person will reply.", items: [...FAQ_CORE, ...FAQ_MORE] },
    { id: id("cta"), type: "cta", heading: "Still have a question?", text: "We're happy to walk you through TablePe with your own menu.", button: { label: "Contact us", href: "/contact" } },
  ],
};

const about = {
  slug: "about",
  title: "About TablePe",
  status: "published",
  seo: { title: "About us", description: "TablePe builds the ordering platform for restaurants — QR table ordering, staff ordering, online ordering and kitchen printing, without commission." },
  nav: { show: true, label: "About", order: 30 },
  footerGroup: "company",
  sections: [
    {
      id: id("story"),
      type: "imageText",
      eyebrow: "About us",
      heading: "We build for the rush.",
      body:
        "TablePe started on the floor of a busy momo shop, where orders were shouted, tickets were lost and the queue never ended. We built the tools that restaurant needed — QR ordering at the table, orders on staff phones, a kitchen screen and printed tickets — and kept going until it ran a whole chain.\n\nToday TablePe is a complete ordering platform any restaurant can run on its own brand, at its own web address.",
      imageSide: "right",
    },
    {
      id: id("text"),
      type: "text",
      heading: "What we believe",
      body:
        "## Restaurants should own their customers\nYour customers order from your website, earn your coins and get messages from your WhatsApp — not a marketplace's.\n\n## Software should keep up with the kitchen\nEvery screen is built for speed: one tap to add a dish, one screen for every order, tickets that print themselves.\n\n## Setup is our job\nWe set every store up ourselves — menu, tables, printers, payments and web address — so you're taking orders from day one.",
    },
    { id: id("cta"), type: "cta", heading: "Let's set up your restaurant", text: "Tell us about your outlets and we'll take it from there.", button: { label: "Talk to us", href: "/contact" } },
  ],
};

const contact = {
  slug: "contact",
  title: "Contact us",
  status: "published",
  system: true,
  seo: { title: "Contact us", description: "Talk to TablePe about setting up QR ordering, staff ordering and your own online ordering site for your restaurant." },
  nav: { show: true, label: "Contact", order: 40 },
  footerGroup: "company",
  sections: [
    {
      id: id("contact"),
      type: "contact",
      eyebrow: "Contact us",
      heading: "Let's set up your restaurant",
      intro: "Tell us a little about your restaurant. We'll call you back, show you TablePe with your own menu and recommend a plan — there's nothing to buy online.",
      showDetails: true,
    },
  ],
};

const COMPANY = "[Company legal name]";
const ADDRESS = "[Registered address]";
const EMAIL = "[privacy@yourdomain.com]";

const privacy = {
  slug: "privacy-policy",
  title: "Privacy Policy",
  status: "published",
  system: true,
  seo: { title: "Privacy Policy", description: "How TablePe collects, uses and protects personal data." },
  nav: { show: false, label: "", order: 90 },
  footerGroup: "legal",
  sections: [
    {
      id: id("text"),
      type: "text",
      heading: "",
      body: `*Last updated: [date]*

This Privacy Policy explains how ${COMPANY} ("TablePe", "we", "us") collects, uses and protects personal data when you visit our website, enquire about our services, or use TablePe as a restaurant or as a restaurant's customer.

# Who we are
TablePe provides ordering software to restaurants. For data about a restaurant's own customers (for example, a diner's name and mobile number), the restaurant decides how that data is used and we process it on the restaurant's behalf.

# Data we collect
- **Enquiries:** your name, phone number, email, business name, city, number of outlets and your message, when you fill in our contact form.
- **Restaurant accounts:** names, email addresses and roles of the restaurant's staff who sign in.
- **Diners:** name, mobile number, email (optional), orders, and loyalty coin balance, collected when ordering from a restaurant on TablePe.
- **Technical data:** IP address, browser type and pages visited, used to keep the service secure and working.

# How we use it
- To reply to your enquiry and set up your restaurant.
- To provide the service: taking and processing orders, printing tickets, sending order updates.
- To keep the service secure and prevent abuse.
- To meet legal and tax obligations.

We do not sell personal data.

# Sharing
We share data only with service providers who help us run TablePe (for example hosting, SMS or WhatsApp delivery, and payment gateways chosen by the restaurant), and only as needed to provide the service, or when the law requires it.

# Payments
Card and UPI details are entered into the payment gateway's own checkout and never reach our servers. Payment gateway keys a restaurant gives us are stored encrypted.

# How long we keep data
We keep data for as long as needed to provide the service and to meet legal obligations, then delete or anonymise it.

# Your rights
You can ask to access, correct or delete your personal data, or withdraw consent, by writing to ${EMAIL}. If you're a diner, you can also contact the restaurant you ordered from.

# Security
We use encryption, access controls and secure hosting to protect data. No system is perfectly secure, but we work to protect your data and will act quickly if something goes wrong.

# Changes
We may update this policy. The date at the top shows when it last changed.

# Contact
${COMPANY}, ${ADDRESS}. Email: ${EMAIL}.`,
    },
  ],
};

const terms = {
  slug: "terms",
  title: "Terms and Conditions",
  status: "published",
  system: true,
  seo: { title: "Terms and Conditions", description: "The terms under which TablePe provides its restaurant ordering service." },
  nav: { show: false, label: "", order: 91 },
  footerGroup: "legal",
  sections: [
    {
      id: id("text"),
      type: "text",
      heading: "",
      body: `*Last updated: [date]*

These Terms govern the use of TablePe, provided by ${COMPANY} ("TablePe", "we", "us"). By using our website or service you agree to them.

# The service
TablePe provides software for restaurants to take orders by QR code, through staff devices and through their own website, and to manage menus, tables, printing, payments and loyalty coins.

# Plans and setup
Plans are not sold online. Each restaurant's plan, price and setup are agreed directly with us. Features and limits depend on the plan agreed.

# Fees and payment
Plan fees are invoiced as agreed with you. Fees exclude applicable taxes unless stated. We do not take a commission on your orders. Payment gateway charges are billed by your payment gateway.

# Your responsibilities
- Keep your account credentials secure.
- Make sure your menu, prices, taxes and any legally required details (such as FSSAI and GSTIN) are accurate.
- Use TablePe lawfully and handle your customers' data in line with applicable law.

# Your content and data
You own your menu, content and your customers' data. You give us permission to use it only to provide the service to you.

# Availability
We work to keep TablePe available and secure, but we can't promise it will be uninterrupted. We may carry out maintenance, ideally outside your busy hours.

# Suspension and ending
Either side may end the service as agreed in your plan. We may suspend access for non-payment, misuse or if required by law. You can ask for an export of your data before your account is closed.

# Liability
To the extent allowed by law, we are not liable for indirect or consequential losses, and our total liability is limited to the fees you paid us in the three months before the claim.

# Changes to these terms
We may update these Terms. We'll tell you about significant changes before they take effect.

# Governing law
These Terms are governed by the laws of India, and the courts at [city] have jurisdiction.

# Contact
${COMPANY}, ${ADDRESS}. Email: ${EMAIL}.`,
    },
  ],
};

export const starterPages = [home, pricing, faq, about, contact, privacy, terms];
