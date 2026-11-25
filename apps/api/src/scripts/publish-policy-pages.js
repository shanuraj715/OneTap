/**
 * Publishes the pages a payment gateway (Razorpay, PayU…) wants to see on a store's website before it activates the
 * account: About us, Contact us, Pricing, Privacy policy, Terms & conditions, Refunds & cancellation, and
 * Delivery & pickup — on EVERY outlet of the store, linked in the footer, so they show on whichever outlet page a
 * reviewer opens (and on the store's outlet picker).
 *
 *   node src/scripts/publish-policy-pages.js <brand-slug>              show what would be created (changes nothing)
 *   node src/scripts/publish-policy-pages.js <brand-slug> --apply      create + publish the pages that are missing
 *   node src/scripts/publish-policy-pages.js <brand-slug> --apply --overwrite   also replace pages with the same address
 *
 * The text is written from the outlet's own settings (name, phone, email, address, hours, delivery, GST), so it says
 * what is true for that outlet. It is a sensible plain-language starting point, NOT legal advice: the owner should
 * read it once and edit anything that is not how they really work (Pages in the dashboard).
 * Pages that already exist are left exactly as they are unless --overwrite is given.
 */
import { formatClock, parseHHMM, storePageSchema } from "@rasoipulse/config-schema";
import { BrandModel, connectDb, OutletModel, StorePageModel } from "@rasoipulse/db";
import { env } from "../env.js";

const bid = () => `blk_${Math.random().toString(36).slice(2, 10)}`;
const rupees = (paise) => `₹${(Number(paise) / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const clock = (hhmm) => formatClock(parseHHMM(hhmm) ?? 0);

/** One outlet's pages, in the order they should appear in the footer. */
export function policyPages({ store, outlet, outlets }) {
  const c = outlet.config ?? {};
  const id = c.identity ?? {};
  const ops = c.operations ?? {};
  const limits = ops.limits ?? {};
  const hours = ops.hours ?? {};
  const tax = c.tax ?? {};
  const name = id.name && id.name !== "Rasoi Pulse Restaurant" ? id.name : outlet.name;
  const phone = id.phone || "";
  const email = id.email || "";
  const where = id.address ? `${name}, ${id.address}` : name;
  const open = hours.enabled ? `${clock(hours.opensAt)} to ${clock(hours.closesAt)}, every day` : "";
  const delivers = outlets.filter((o) => o.config?.features?.ordering?.delivery);
  const deliveryHere = Boolean(c.features?.ordering?.delivery);
  const contactLine = [phone && `phone **${phone}**`, email && `email **${email}**`].filter(Boolean).join(" or ");
  const reach = contactLine ? `Please contact us — ${contactLine}.` : "Please contact the outlet directly.";
  const text = (markdown) => ({ id: bid(), type: "text", markdown });
  const heading = (t) => ({ id: bid(), type: "heading", text: t, level: 2, align: "left" });

  const outletList = outlets
    .map((o) => {
      const oi = o.config?.identity ?? {};
      return `- **${oi.name && oi.name !== "Rasoi Pulse Restaurant" ? oi.name : o.name}** — ${oi.address || o.name}${oi.phone ? ` · ${oi.phone}` : ""}`;
    })
    .join("\n");

  const gst = tax.pricesIncludeTax === false ? "GST is added at checkout and shown on your bill." : "All prices include GST; the tax is shown on your bill.";
  const feeText = limits.deliveryFee > 0 ? `The delivery fee is ${rupees(limits.deliveryFee)}${limits.freeDeliveryAbove > 0 ? `, and delivery is free on orders above ${rupees(limits.freeDeliveryAbove)}` : ""}.` : "Delivery is currently free of charge.";
  const minText = limits.minOrderValue > 0 ? `The minimum order value is ${rupees(limits.minOrderValue)}.` : "There is no minimum order value.";

  return [
    {
      slug: "about",
      title: "About us",
      description: `About ${store}.`,
      showInHeader: true,
      showInFooter: true,
      blocks: [
        heading(`Welcome to ${store}`),
        text(
          `${store} is a restaurant serving freshly prepared food, made to order. You can order from our website for **takeaway**${delivers.length ? ", **home delivery**" : ""} or **dine-in** — scan the QR code on your table and order from your seat.\n\n# Our outlets\n${outletList}\n\n# Why order here\n- Food is prepared only after you order, so it reaches you fresh\n- Clear prices in rupees, with no hidden charges\n- Pay at the counter, or online by UPI, card, netbanking or wallet\n- A real person to talk to if something is not right — ${reach}`,
        ),
        { id: bid(), type: "cta", heading: "Hungry?", text: "Have a look at the menu and order in a minute.", buttonLabel: "See the menu", buttonHref: `/${outlet.slug}#menu` },
      ],
    },
    {
      slug: "contact",
      title: "Contact us",
      description: `How to reach ${store}.`,
      showInHeader: true,
      showInFooter: true,
      blocks: [
        heading("Contact us"),
        text(`**${store}**\n\n${where}\n\n${contactLine ? `Reach us on ${contactLine}.` : ""}${open ? `\n\nOpen ${open}.` : ""}\n\nFor an order that is already placed, please have your order number ready when you contact us.\n\n# All our outlets\n${outletList}`),
        { id: bid(), type: "contact", heading: "Find this outlet", showAddress: true, showPhone: true, showEmail: true, showHours: true, showMap: true },
      ],
    },
    {
      slug: "pricing",
      title: "Pricing",
      description: `How prices work at ${store}.`,
      showInHeader: false,
      showInFooter: true,
      blocks: [
        heading("Pricing"),
        text(
          `Every dish and its price is listed on our [menu](/${outlet.slug}#menu). Prices are in Indian Rupees (₹). ${gst}\n\n# What you pay\n- **Items** — the price shown on the menu for the size and add-ons you choose\n- **Delivery** — ${deliveryHere ? `${feeText} We deliver within about ${limits.deliveryRadiusKm ?? 5} km of the outlet.` : "this outlet does not offer delivery; takeaway and dine-in have no delivery charge."}\n- **Minimum order** — ${minText}\n- **Discounts** — coupons and loyalty coins reduce your total at checkout, and the discount is shown before you pay\n\nThe total shown at checkout is the amount you pay. We do not add any charge that is not shown there. Prices and availability can change; an order is charged at the price shown when you place it.\n\n# How to pay\nPay at the counter (cash or UPI), or online with UPI, debit or credit card, netbanking or wallet. Online payments are processed securely by our payment partner, Razorpay.`,
        ),
      ],
    },
    {
      slug: "privacy-policy",
      title: "Privacy policy",
      description: `How ${store} looks after your details.`,
      showInHeader: false,
      showInFooter: true,
      blocks: [
        heading("Privacy policy"),
        text(
          `This policy explains what ${store} collects when you use our website to order, and what we do with it.\n\n# What we collect\n- **Your name and mobile number** — to sign you in with a one-time code and to run your order\n- **Your age and gender** — asked once when you sign up, to know our customers better\n- **Your delivery address and location** — only for delivery orders, to check that we deliver there and to reach you\n- **Your orders** — what you ordered, when, and how you paid\n- **Your email** — only if you give it to us\n\n# How we use it\nTo prepare and deliver your order, to verify you by SMS or WhatsApp, to send you updates about your order, to give you coupons and loyalty coins, and — only if you have not asked us to stop — to tell you about offers. You can ask us to stop marketing messages at any time.\n\n# Payments\nOnline payments are handled by Razorpay. **We never see or store your card, UPI PIN or netbanking details.**\n\n# Who sees your details\nOur staff see your order so they can prepare it. Service providers who help us run the website, send messages and process payments get only what they need to do that. **We do not sell your personal details.**\n\n# Cookies and storage\nWe use a sign-in cookie to keep you signed in, and your browser's storage to remember your cart.\n\n# Keeping your data\nWe keep your details while your account is active and as long as the law requires for billing and tax records.\n\n# Your choices\nYou can ask us to see, correct or delete your details by contacting us. ${reach}\n\n# Changes\nWe may update this policy; the latest version is always on this page.`,
        ),
      ],
    },
    {
      slug: "terms",
      title: "Terms & conditions",
      description: `The terms for ordering from ${store}.`,
      showInHeader: false,
      showInFooter: true,
      blocks: [
        heading("Terms & conditions"),
        text(
          `By placing an order with ${store} you agree to these terms.\n\n# Ordering\nYou can order for takeaway${delivers.length ? ", delivery" : ""} or dine-in where the outlet offers it. You must sign in with your mobile number first. An order is confirmed when the outlet accepts it. If a dish becomes unavailable we will tell you and offer a replacement or a refund.\n\n# Prices and payment\nPrices are in Indian Rupees and ${tax.pricesIncludeTax === false ? "GST is added at checkout" : "include GST"}. The amount shown at checkout is the amount you pay. You can pay at the counter or online (UPI, card, netbanking, wallet). ${deliveryHere ? "Delivery orders are paid online." : ""}\n\n# Opening hours\n${open ? `This outlet is open ${open}, and online orders stop shortly before closing. ` : ""}Orders cannot be placed when the outlet is closed.\n\n# Delivery and pickup\nSee our [delivery & pickup policy](/${outlet.slug}/shipping-policy). Times we give are estimates.\n\n# Cancellations and refunds\nSee our [refunds & cancellation policy](/${outlet.slug}/refund-policy).\n\n# Coupons and loyalty coins\nA coupon works only as described on it, and only within its dates and limits. Loyalty coins have no cash value; they can only be used to reduce the price of a later order, as shown at checkout.\n\n# Allergies and dietary needs\nOur kitchen handles many ingredients. If you have an allergy, please tell us before you order; we cannot guarantee that any dish is free of an allergen.\n\n# Using the website\nPlease give correct details and do not misuse the website, place false orders or try to interfere with it. We may refuse or cancel an order that looks fraudulent.\n\n# Our responsibility\nWe prepare every order with care. To the extent the law allows, our responsibility for any order is limited to its value.\n\n# Governing law\nThese terms are governed by the laws of India.\n\n# Contact\n${reach}`,
        ),
      ],
    },
    {
      slug: "refund-policy",
      title: "Refunds & cancellation",
      description: `What happens if you cancel, or something goes wrong with an order from ${store}.`,
      showInHeader: false,
      showInFooter: true,
      blocks: [
        heading("Refunds & cancellation"),
        text(
          `# Cancelling an order\nYou can cancel an order **before the kitchen starts preparing it**. Contact the outlet straight away — ${reach} Because food is made fresh, an order that is already being prepared cannot be cancelled.\n\n# If something is wrong\nIf an item is missing, wrong, or not as it should be, tell us **within 2 hours** of receiving the order with your order number. We will make it right with a replacement or a refund of the affected items.\n\n# If we cancel\nIf we cannot make your order (for example a dish has run out), we will tell you and refund the full amount you paid.\n\n# How refunds are paid\n- **Online payments** are refunded to the same payment method (UPI, card, netbanking or wallet) within **5–7 working days**, depending on your bank\n- **Cash orders** are refunded in cash at the outlet, or by UPI if you prefer\n\n# Payment taken but no order\nIf money was deducted but your order was not placed, it is returned automatically to your account, normally within 5–7 working days. If you do not receive it, contact us with the payment details.\n\n# Contact\n${reach}`,
        ),
      ],
    },
    {
      slug: "shipping-policy",
      title: "Delivery & pickup",
      description: `How ${store} orders reach you.`,
      showInHeader: false,
      showInFooter: true,
      blocks: [
        heading("Delivery & pickup"),
        text(
          `# Takeaway\nOrder online, and collect it from **${where}** when it is ready — the estimated time is shown when you order. Please bring your order number.\n\n# Dine-in\nScan the QR code on your table, order from your seat, and your food is brought to the table.\n\n# Home delivery\n${deliveryHere ? `This outlet delivers within about **${limits.deliveryRadiusKm ?? 5} km**. Enter your address at checkout and we tell you straight away whether we can deliver to it, how long it will take, and what it costs. ${feeText} Estimated delivery time depends on the distance and how busy the kitchen is${limits.deliveryMinEtaMinutes ? `, and is never less than ${limits.deliveryMinEtaMinutes} minutes` : ""}. Delivery orders are paid online.` : `This outlet does not deliver${delivers.length ? `; delivery is available from: ${delivers.map((o) => o.config?.identity?.name || o.name).join(", ")}` : ""}.`}\n\n# Late or missing deliveries\nIf your order is late, contact us and we will find it. ${reach}\n\nWe deliver only inside the area shown at checkout; we do not ship outside it.`,
        ),
      ],
    },
  ];
}

async function main() {
  const [slug, ...flags] = process.argv.slice(2);
  if (!slug) throw new Error("Usage: node src/scripts/publish-policy-pages.js <brand-slug> [--apply] [--overwrite]");
  const apply = flags.includes("--apply");
  const overwrite = flags.includes("--overwrite");
  await connectDb({ uri: env.MONGODB_URI, dbName: env.MONGODB_DB });
  const brand = await BrandModel.findOne({ slug: String(slug).toLowerCase() }).lean();
  if (!brand) throw new Error(`No store with the address name "${slug}"`);
  const brandId = String(brand._id);
  const outlets = await OutletModel.find({ brandId }, null, { allowGlobalQuery: true }).sort({ createdAt: 1 }).lean();
  console.log(`${apply ? "APPLYING" : "DRY RUN"} — ${brand.name}: ${outlets.length} outlet(s)`);

  for (const outlet of outlets) {
    const outletId = String(outlet._id);
    const have = new Map((await StorePageModel.find({ brandId, outletId }, null, { allowGlobalQuery: true }).select("slug").lean()).map((p) => [p.slug, p._id]));
    const last = await StorePageModel.findOne({ brandId, outletId }, null, { allowGlobalQuery: true }).sort({ sortOrder: -1 }).select("sortOrder").lean();
    let order = (last?.sortOrder ?? -1) + 1;
    for (const page of policyPages({ store: brand.name, outlet, outlets })) {
      const exists = have.has(page.slug);
      if (exists && !overwrite) {
        console.log(`  ${outlet.slug}/${page.slug}: already there — left alone`);
        continue;
      }
      const data = storePageSchema.parse({ ...page, status: "published" });
      if (!apply) {
        console.log(`  ${outlet.slug}/${page.slug}: would ${exists ? "replace" : "create"} (${JSON.stringify(data.blocks).length} chars)`);
        continue;
      }
      if (exists) await StorePageModel.updateOne({ _id: have.get(page.slug), brandId }, { $set: { ...data, updatedBy: "policy-pages-script" } });
      else await StorePageModel.create({ ...data, brandId, outletId, sortOrder: order++, updatedBy: "policy-pages-script" });
      console.log(`  ${outlet.slug}/${page.slug}: ${exists ? "replaced" : "created"} and published`);
    }
  }
  console.log(apply ? "Done. Pages appear within the cache lifetime, or at once after Platform → Cache → Expire." : "Nothing was changed. Add --apply to create the pages.");
  process.exit(0);
}

// run only when executed directly, so the page text can be imported by a test
if (process.argv[1] && process.argv[1].endsWith("publish-policy-pages.js")) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
