import { createHmac } from "node:crypto";
import {
  FEATURES,
  LEAD_STATUSES,
  RESERVED_SITE_SLUGS,
  leadInputSchema,
  planLimitsSchema,
  entitlementsSchema,
  planMarketingSchema,
  planPrices,
  siteSectionSchema,
  sitePageSchema,
  siteSettingsSchema,
} from "@onetap/config-schema";
import { LeadModel, PlanModel, SitePageModel, SiteSettingsModel } from "@onetap/db";
import { env } from "../../env.js";
import { safeEqual } from "../../lib/crypto.js";
import { logger } from "../../logger.js";
import { HttpError } from "../../middleware/error.js";
import { putImage } from "../storage/storage.service.js";
import * as guard from "./guard.js";
import { tooMany } from "./guard.js";
import { notifyWebsite } from "./revalidate.js";

/**
 * The TablePe marketing website's content: settings, pages built from
 * sections, the public view of plans, and enquiries from its contact form.
 * Everything public is published-only; everything else is the platform
 * super admin's (routes enforce that).
 */

/* ---------------------------------------------------------------- settings */

export async function getSiteSettings() {
  const doc = await SiteSettingsModel.findOne({ key: "site" }).lean();
  return siteSettingsSchema.parse(doc?.data ?? {});
}

export async function saveSiteSettings(input) {
  const data = siteSettingsSchema.parse(input);
  await SiteSettingsModel.updateOne({ key: "site" }, { $set: { data } }, { upsert: true });
  notifyWebsite();
  return data;
}

/* ------------------------------------------------------------------- pages */

/**
 * A stored page, cleaned up for reading: each section is re-parsed so a
 * section saved by an older version (or hand-edited in the DB) gets today's
 * defaults — and one that no longer fits is dropped rather than breaking the
 * page.
 */
function shapePage(doc) {
  const sections = [];
  for (const s of doc.sections ?? []) {
    const parsed = siteSectionSchema.safeParse(s);
    if (parsed.success) sections.push(parsed.data);
    else logger.warn({ slug: doc.slug, type: s?.type }, "site section skipped — it no longer matches its schema");
  }
  const page = sitePageSchema.parse({ slug: doc.slug, title: doc.title, status: doc.status, seo: doc.seo, nav: doc.nav, footerGroup: doc.footerGroup ?? "", sections: [] });
  return {
    id: String(doc._id),
    ...page,
    sections,
    system: Boolean(doc.system),
    publishedAt: doc.publishedAt ?? null,
    updatedAt: doc.updatedAt,
  };
}

const pageSummary = (doc) => {
  const p = shapePage(doc);
  return { id: p.id, slug: p.slug, title: p.title, status: p.status, nav: p.nav, footerGroup: p.footerGroup, system: p.system, sections: p.sections.length, seo: p.seo, updatedAt: p.updatedAt, publishedAt: p.publishedAt };
};

export async function listPages() {
  const docs = await SitePageModel.find({}).sort({ "nav.order": 1, createdAt: 1 }).lean();
  return docs.map(pageSummary);
}

export async function getPage(id) {
  const doc = await SitePageModel.findById(id).lean();
  if (!doc) throw new HttpError(404, "Page not found");
  return shapePage(doc);
}

function validatePageInput(input) {
  const data = sitePageSchema.parse(input);
  if (RESERVED_SITE_SLUGS.includes(data.slug)) throw new HttpError(400, `"/${data.slug}" is used by the website itself — pick another address.`);
  const ids = new Set();
  for (const s of data.sections) {
    if (ids.has(s.id)) throw new HttpError(400, "Two sections share an id — reload the editor and try again.");
    ids.add(s.id);
  }
  return data;
}

async function assertSlugFree(slug, exceptId) {
  const clash = await SitePageModel.findOne({ slug, ...(exceptId ? { _id: { $ne: exceptId } } : {}) }).lean();
  if (clash) throw new HttpError(409, `Another page already uses /${slug === "home" ? "" : slug}.`);
}

export async function createPage(input, userId) {
  const data = validatePageInput(input);
  await assertSlugFree(data.slug);
  const doc = await SitePageModel.create({ ...data, publishedAt: data.status === "published" ? new Date() : null, updatedBy: userId });
  notifyWebsite();
  return shapePage(doc.toObject());
}

export async function updatePage(id, input, userId) {
  const doc = await SitePageModel.findById(id);
  if (!doc) throw new HttpError(404, "Page not found");
  const data = validatePageInput(input);
  // a built-in page keeps its address — the site's links depend on it
  if (doc.system && data.slug !== doc.slug) throw new HttpError(400, `This built-in page always lives at /${doc.slug === "home" ? "" : doc.slug}.`);
  if (data.slug !== doc.slug) await assertSlugFree(data.slug, id);
  const publishing = data.status === "published" && doc.status !== "published";
  Object.assign(doc, data, { updatedBy: userId });
  if (publishing) doc.publishedAt = new Date();
  doc.markModified("sections");
  doc.markModified("seo");
  doc.markModified("nav");
  await doc.save();
  notifyWebsite();
  return shapePage(doc.toObject());
}

export async function duplicatePage(id, userId) {
  const src = await SitePageModel.findById(id).lean();
  if (!src) throw new HttpError(404, "Page not found");
  let slug = `${src.slug === "home" ? "home" : src.slug}-copy`;
  for (let n = 2; await SitePageModel.exists({ slug }); n++) slug = `${src.slug}-copy-${n}`;
  const doc = await SitePageModel.create({
    slug,
    title: `${src.title} (copy)`,
    status: "draft",
    seo: { ...(src.seo ?? {}), noindex: false },
    nav: { ...(src.nav ?? {}), show: false },
    footerGroup: "",
    sections: src.sections,
    updatedBy: userId,
  });
  return shapePage(doc.toObject());
}

export async function deletePage(id) {
  const doc = await SitePageModel.findById(id).lean();
  if (!doc) throw new HttpError(404, "Page not found");
  if (doc.system) throw new HttpError(409, "Built-in pages can be edited but not deleted.");
  await SitePageModel.deleteOne({ _id: id });
  notifyWebsite();
}

/* ------------------------------------------------------------ public reads */

/** Published pages, for the website's menus and sitemap. */
export async function listPublishedPages() {
  const docs = await SitePageModel.find({ status: "published" }).sort({ "nav.order": 1, createdAt: 1 }).lean();
  return docs.map((d) => {
    const p = shapePage(d);
    return { slug: p.slug, title: p.title, nav: p.nav, footerGroup: p.footerGroup, noindex: p.seo.noindex, updatedAt: p.updatedAt };
  });
}

export async function getPublishedPage(slug) {
  const doc = await SitePageModel.findOne({ slug: String(slug).toLowerCase(), status: "published" }).lean();
  if (!doc) throw new HttpError(404, "Page not found");
  const { id, status, system, ...page } = shapePage(doc);
  return page;
}

/* --------------------------------------------------------- draft previews */

const PREVIEW_MINUTES = 30;
const previewSig = (id, exp) => createHmac("sha256", env.ENCRYPTION_KEY).update(`site-preview|${id}|${exp}`).digest("base64url");

/** A short-lived link to a page as it is now, published or not — for "Preview" in the console. */
export async function previewLink(id) {
  const page = await SitePageModel.exists({ _id: id });
  if (!page) throw new HttpError(404, "Page not found");
  const exp = Date.now() + PREVIEW_MINUTES * 60 * 1000;
  const token = `${exp}.${previewSig(String(id), exp)}`;
  const settings = await getSiteSettings();
  const base = (env.NODE_ENV === "production" && settings.siteUrl ? settings.siteUrl : env.WEBSITE_URL).replace(/\/$/, "");
  return { url: `${base}/preview/${id}?t=${encodeURIComponent(token)}`, expiresAt: new Date(exp) };
}

export async function getPreviewPage(id, token) {
  const [exp, sig] = String(token ?? "").split(".");
  if (!exp || !sig || Number(exp) < Date.now() || !safeEqual(previewSig(String(id), exp), sig)) {
    throw new HttpError(403, "This preview link has expired — open Preview again from the console.");
  }
  const doc = await SitePageModel.findById(id).lean().catch(() => null);
  if (!doc) throw new HttpError(404, "Page not found");
  const { id: _id, system, ...page } = shapePage(doc);
  return page;
}

/* ----------------------------------------------------------------- pricing */

/** A custom plan's card: nothing is fixed, so it says what the restaurant gets to choose. */
const CUSTOM_LINES = [
  "Only the features you pick",
  "As many outlets and staff logins as you need",
  "Storefront looks and table-card styles you choose",
  "Priced on what you pick",
];

/** Plain-English lines for a plan's card, from its real limits and features. */
function planLines(plan) {
  if (plan.custom) return CUSTOM_LINES;
  const limits = planLimitsSchema.parse(plan.limits ?? {});
  const ent = entitlementsSchema.parse(plan.entitlements ?? {});
  const lines = [];
  lines.push(limits.multiOutlet ? (limits.maxOutlets === null ? "Unlimited outlets" : `Up to ${limits.maxOutlets} outlets`) : "1 outlet");
  lines.push(limits.maxUsers === null ? "Unlimited staff logins" : `Up to ${limits.maxUsers} staff logins`);
  for (const f of FEATURES) if (ent.features.includes(f.key)) lines.push(f.label);
  if (ent.effects.filter((e) => e !== "none").length) lines.push(`${ent.effects.filter((e) => e !== "none").length} storefront styles`);
  return lines;
}

/** One plan's row values for the comparison table: limits in words, and which features it has. */
function planCompare(plan) {
  if (plan.custom) return { custom: true, outlets: "As you need", staff: "As you need", styles: 0, features: [] };
  const limits = planLimitsSchema.parse(plan.limits ?? {});
  const ent = entitlementsSchema.parse(plan.entitlements ?? {});
  return {
    outlets: limits.multiOutlet ? (limits.maxOutlets === null ? "Unlimited" : `Up to ${limits.maxOutlets}`) : "1",
    staff: limits.maxUsers === null ? "Unlimited" : `Up to ${limits.maxUsers}`,
    styles: ent.effects.filter((e) => e !== "none").length,
    features: ent.features,
  };
}

/** The plans set to show on the website, in their display order. */
export async function publicPricing() {
  const plans = await PlanModel.find({ archived: { $ne: true } }).lean();
  return plans
    .map((p) => ({ p, m: planMarketingSchema.parse(p.marketing ?? {}) }))
    .filter(({ m }) => m.show)
    .sort((a, b) => a.m.order - b.m.order)
    .map(({ p, m }) => {
      const prices = planPrices(m);
      return {
        id: String(p._id),
        name: p.name,
        description: p.description ?? "",
        // rupees per month before GST; 0 means there's no number — `price` is then shown as written
        monthly: prices.monthly,
        // paying for the year up front: { total, perMonth, discount, saves }, or null when there's no discount
        yearly: prices.yearly,
        price: prices.monthly ? "" : m.price,
        period: m.period,
        pitch: m.pitch,
        highlight: m.highlight,
        custom: Boolean(p.custom),
        lines: planLines(p),
        // for the "compare plans" table
        compare: planCompare(p),
      };
    });
}

/* ------------------------------------------------------------------- leads */

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const BUSY = "We're getting a lot of enquiries right now — please try again in a little while, or call us.";
const ALREADY = "We've already got your details — we'll be in touch soon.";

/**
 * An enquiry from the contact form. Everything that can refuse it is in
 * guard.js (read its header for the why); the order here is cheapest first,
 * so spam is turned away before it costs a database query.
 */
export async function createLead(input, { ip }) {
  if (!input || typeof input !== "object") throw new HttpError(400, "Something went wrong — please try again.");
  const visitor = `ip:${ip}`;
  // every attempt counts — good or bad — so a script can't hammer the form
  if (tooMany(visitor, 12, 10 * 60 * 1000)) throw new HttpError(429, ALREADY);
  // a bot filled the hidden field — say thanks, store nothing
  if (input.website) return { ok: true };

  const data = leadInputSchema.parse(input);
  const challengeId = guard.checkChallenge(input.challenge);
  await guard.checkTurnstile(input.turnstile, ip);
  const { website, ...lead } = data;
  if (guard.looksLikeSpam(lead)) return { ok: true };

  // what has actually been stored recently — survives restarts, and caps how much can ever be written
  const ipHash = guard.hashIp(ip);
  const phoneKey = guard.phoneKey(lead.phone);
  const since = (ms) => ({ createdAt: { $gt: new Date(Date.now() - ms) } });
  const [ipHour, ipDay, phoneHour, phoneDay, siteHour, siteDay, replay] = await Promise.all([
    LeadModel.countDocuments({ ipHash, ...since(HOUR) }),
    LeadModel.countDocuments({ ipHash, ...since(DAY) }),
    LeadModel.countDocuments({ phoneKey, ...since(HOUR) }),
    LeadModel.countDocuments({ phoneKey, ...since(DAY) }),
    LeadModel.countDocuments(since(HOUR)),
    LeadModel.countDocuments(since(DAY)),
    LeadModel.exists({ challengeId }),
  ]);
  const L = guard.LIMITS;
  if (replay) throw new HttpError(400, "This form was already sent — reload the page to send another.");
  if (ipHour >= L.hour.ip || ipDay >= L.day.ip || phoneHour >= L.hour.phone || phoneDay >= L.day.phone) throw new HttpError(429, ALREADY);
  if (siteHour >= L.hour.site || siteDay >= L.day.site) throw new HttpError(429, BUSY);

  try {
    await LeadModel.create({ ...lead, ipHash, phoneKey, challengeId });
  } catch (err) {
    // two sends of one token racing each other: the unique index lets only one through
    if (err?.code === 11000) throw new HttpError(400, "This form was already sent — reload the page to send another.");
    throw err;
  }
  return { ok: true };
}

const shapeLead = (l) => ({
  id: String(l._id),
  name: l.name,
  phone: l.phone,
  email: l.email,
  businessName: l.businessName,
  city: l.city,
  outlets: l.outlets,
  plan: l.plan,
  message: l.message,
  sourcePage: l.sourcePage,
  utm: l.utm ?? {},
  status: l.status,
  notes: l.notes ?? [],
  createdAt: l.createdAt,
  updatedAt: l.updatedAt,
});

export async function listLeads({ status } = {}) {
  const filter = status && LEAD_STATUSES.includes(status) ? { status } : {};
  const [leads, counts] = await Promise.all([
    LeadModel.find(filter).sort({ createdAt: -1 }).limit(500).lean(),
    LeadModel.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
  ]);
  return { leads: leads.map(shapeLead), counts: Object.fromEntries(LEAD_STATUSES.map((s) => [s, counts.find((c) => c._id === s)?.n ?? 0])) };
}

export async function updateLead(id, { status, note }, userName) {
  const lead = await LeadModel.findById(id);
  if (!lead) throw new HttpError(404, "Enquiry not found");
  if (status) {
    if (!LEAD_STATUSES.includes(status)) throw new HttpError(400, "Unknown status");
    lead.status = status;
  }
  if (note?.trim()) lead.notes.push({ text: note.trim().slice(0, 2000), by: userName ?? "" });
  await lead.save();
  return shapeLead(lead.toObject());
}

/* ----------------------------------------------------------------- uploads */

/** An image for the website (logo, hero, team photo…). Stored like any other upload, under "platform". */
export async function uploadSiteImage(body) {
  return putImage({ brandId: "platform", outletId: "website" }, { body, kind: "website" });
}
