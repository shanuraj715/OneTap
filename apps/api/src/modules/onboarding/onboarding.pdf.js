import PDFDocument from "pdfkit";
import {
  BUSINESS_TYPES,
  CHECKLIST_FEATURES,
  FONT_FAMILIES,
  LOGO_STATES,
  ONBOARDING_PALETTES,
  ORDER_MODES,
  THEME_MODES,
  onboardingOutletSlug,
  onboardingSubdomain,
  planAllowances,
  planFit,
  wantedFeatures,
} from "@rasoipulse/config-schema";

/**
 * The onboarding form as a document, for the client to read and sign and for the file. One renderer serves both the PDF
 * download and the Print button, so paper and file are always the same. Built-in fonts: Latin text only, and "Rs" for rupees.
 * The owner's password is never part of the form and never printed.
 */
const MARGIN = 40;
const RED = "#b42318";
const INK = "#1a1a1a";
const MUTED = "#6b6b6b";
const LINE = "#d9d4cc";
const SHADE = "#f4f1ec";
const rs = (n) => (Number(n) > 0 ? `Rs ${new Intl.NumberFormat("en-IN").format(Number(n))}` : "Rs 0");
const niceDate = (d) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d ?? "")) return "";
  return new Date(`${d}T12:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
};
const mode = (id) => THEME_MODES.find((m) => m.id === id)?.label ?? id;

export function renderOnboardingPdf({ form, data, plan }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: MARGIN, bufferPages: true, info: { Title: `Rasoi Pulse onboarding — ${data.business.storeName || "new client"}`, Author: "Rasoi Pulse" } });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = doc.page.width - MARGIN * 2;
    const bottom = () => doc.page.height - 56;
    const ensure = (h) => {
      if (doc.y + h > bottom()) {
        doc.addPage();
        doc.y = MARGIN;
      }
    };

    // `room` is how much of the page a section needs to start on it — a section is kept whole rather than split across two pages
    const section = (title, room = 60) => {
      ensure(room);
      doc.moveDown(0.5);
      const y = doc.y;
      doc.rect(MARGIN, y, W, 20).fill(SHADE);
      doc.fillColor(RED).font("Helvetica-Bold").fontSize(11).text(title, MARGIN + 8, y + 5, { width: W - 16 });
      doc.y = y + 28;
      doc.x = MARGIN;
      doc.fillColor(INK).font("Helvetica").fontSize(10);
    };

    const field = (label, value, w = 150) => {
      const v = value === undefined || value === null || String(value).trim() === "" ? "—" : String(value);
      const h = Math.max(doc.font("Helvetica").fontSize(10).heightOfString(v, { width: W - w }), 12);
      ensure(h + 6);
      const y = doc.y;
      doc.font("Helvetica-Bold").fontSize(8).fillColor(MUTED).text(label.toUpperCase(), MARGIN, y + 2, { width: w - 8 });
      doc.font("Helvetica").fontSize(10).fillColor(v === "—" ? MUTED : INK).text(v, MARGIN + w, y, { width: W - w });
      doc.y = y + h + 5;
      doc.x = MARGIN;
    };

    const box = (x, y, on) => {
      doc.lineWidth(0.8).strokeColor(on ? RED : "#8a847a").rect(x, y, 10, 10).stroke();
      if (on) doc.lineWidth(1.6).strokeColor(RED).moveTo(x + 2, y + 5.5).lineTo(x + 4.4, y + 8).lineTo(x + 8.2, y + 2).stroke();
    };

    /** a wrapped list of ticked / unticked boxes; `note` is small text under a label */
    const checks = (items, columns = 2) => {
      const colW = W / columns;
      for (let i = 0; i < items.length; i += columns) {
        const row = items.slice(i, i + columns);
        const heights = row.map((it) => doc.font("Helvetica").fontSize(10).heightOfString(it.label, { width: colW - 20 }) + (it.note ? doc.fontSize(8).heightOfString(it.note, { width: colW - 20 }) + 1 : 0));
        const h = Math.max(...heights, 12);
        ensure(h + 6);
        const y = doc.y;
        row.forEach((it, c) => {
          const x = MARGIN + c * colW;
          box(x, y + 1, it.on);
          doc.font("Helvetica").fontSize(10).fillColor(it.on ? INK : MUTED).text(it.label, x + 16, y, { width: colW - 20 });
          if (it.note) doc.font("Helvetica-Oblique").fontSize(8).fillColor(it.noteColor ?? MUTED).text(it.note, x + 16, doc.y + 0.5, { width: colW - 20 });
        });
        doc.y = y + h + 6;
        doc.x = MARGIN;
      }
    };

    const swatch = (label, hex) => {
      ensure(18);
      const y = doc.y;
      doc.font("Helvetica-Bold").fontSize(8).fillColor(MUTED).text(label.toUpperCase(), MARGIN, y + 4, { width: 142 });
      doc.lineWidth(0.6).strokeColor(LINE).rect(MARGIN + 150, y, 26, 14).fillAndStroke(/^#[0-9a-fA-F]{6}$/.test(hex) ? hex : "#ffffff", LINE);
      doc.font("Helvetica").fontSize(10).fillColor(INK).text(hex, MARGIN + 184, y + 2, { width: 120 });
      doc.y = y + 20;
      doc.x = MARGIN;
    };

    // ---- the plan, as the form's own rules see it
    const allow = planAllowances(plan, data);
    const fit = planFit(data, allow);
    const wanted = wantedFeatures(data);
    const forced = new Set(fit.issues.filter((i) => i.forced).map((i) => i.key));

    // ---- header
    doc.fillColor(RED).font("Helvetica-Bold").fontSize(22).text("Rasoi Pulse", { continued: true }).fillColor(INK).text("  client onboarding form");
    doc.font("Helvetica").fontSize(11).fillColor(MUTED).text(`${data.business.storeName || "New client"}   ·   ${form.status === "published" ? "Published as a store" : "Draft"}`);
    doc.fontSize(9).text(`Made ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })} (India time)`);
    doc.moveDown(0.3);

    section("1. Plan");
    field("Selected plan", plan ? plan.name : "");
    if (allow) {
      field("Outlets allowed", Number.isFinite(allow.maxOutlets) ? String(allow.maxOutlets) : "Unlimited");
      field("People allowed", Number.isFinite(allow.maxUsers) ? `${allow.maxUsers} (owner included)` : "Unlimited");
      if (allow.custom) field("Custom plan", "No fixed limits — the limits above were set for this client.");
    }
    const beyond = fit.issues.filter((i) => i.forced);
    const open = fit.issues.filter((i) => !i.forced);
    if (beyond.length) field("Added for this client (not in the plan)", beyond.map((i) => i.message.split(" Untick")[0].split(" Remove")[0].split(" Choose")[0].split(" Reduce")[0]).join("\n"));
    if (open.length) field("NOT RESOLVED", open.map((i) => i.message).join("\n"));

    section("2. Meeting");
    field("Representative", data.meeting.repName);
    field("Meeting date", niceDate(data.meeting.date));
    field("Expected go-live", niceDate(data.meeting.goLive));
    field("Notes", data.meeting.notes);

    section("3. Business and owner", 230);
    field("Store name", data.business.storeName);
    field("Tagline", data.business.tagline);
    field("Type of business", BUSINESS_TYPES.includes(data.business.type) ? data.business.type : data.business.type);
    field("Owner", data.business.ownerName);
    field("Owner phone", data.business.ownerPhone);
    field("Owner email (sign-in)", data.business.ownerEmail);
    field("WhatsApp number", data.business.whatsapp);
    field("City", data.business.city);
    field("GSTIN", data.business.gstin);
    field("FSSAI licence", data.business.fssai);

    section("4. Features wanted", 190);
    checks(
      CHECKLIST_FEATURES.map((f) => {
        const on = data.features.includes(f.key) || Boolean(wanted[f.key]);
        const outside = allow && !allow.custom && !allow.features.includes(f.key);
        return { label: f.label, on, note: on && outside ? (forced.has(f.key) ? "added for this client" : "not in the plan") : undefined, noteColor: on && outside && !forced.has(f.key) ? RED : MUTED };
      }),
    );

    section(`5. Outlets (${data.outlets.length})`, 230); // never a heading alone at the foot of a page
    data.outlets.forEach((o, i) => {
      ensure(150);
      doc.font("Helvetica-Bold").fontSize(11).fillColor(INK).text(`Outlet ${i + 1}: ${o.name || "(no name yet)"}`, MARGIN, doc.y);
      doc.moveDown(0.3);
      field("Web address", onboardingOutletSlug(o) ? `/${onboardingOutletSlug(o)}` : "");
      field("Phone", o.phone);
      field("Address", o.address);
      field("Map location", o.point ? `${o.point.lat}, ${o.point.lng}${o.mapsLink ? `\n${o.mapsLink}` : ""}` : o.mapsLink || "");
      checks(
        ORDER_MODES.map((m) => {
          const outside = allow && !allow.custom && !allow.features.includes(m.feature);
          return { label: m.label, on: Boolean(o.modes[m.key]), note: o.modes[m.key] && outside ? (forced.has(m.feature) ? "added for this client" : "not in the plan") : undefined, noteColor: forced.has(m.feature) ? MUTED : RED };
        }),
        3,
      );
      if (o.modes.delivery) {
        field("Delivery distance", `${o.delivery.radiusKm} km`);
        field("Delivery fee", rs(o.delivery.fee));
        field("Free delivery above", o.delivery.freeAbove > 0 ? rs(o.delivery.freeAbove) : "no free delivery");
        field("Minimum order", o.delivery.minOrder > 0 ? rs(o.delivery.minOrder) : "none");
      }
      const h = o.hours.useCommon ? data.common.hours : o.hours;
      field("Opening hours", `${h.opensAt} – ${h.closesAt}${o.hours.useCommon ? "  (common hours)" : "  (this outlet's own)"}, last order ${h.lastOrderBufferMinutes} min before closing`);
      doc.moveTo(MARGIN, doc.y).lineTo(MARGIN + W, doc.y).lineWidth(0.5).strokeColor(LINE).stroke();
      doc.y += 8;
    });

    section("6. Common settings", 215);
    field("Common opening hours", `${data.common.hours.opensAt} – ${data.common.hours.closesAt}, last order ${data.common.hours.lastOrderBufferMinutes} min before closing`);
    field("Preparation time", `${data.common.prepMinutes} minutes`);
    checks([
      { label: "Cash at the counter", on: data.common.payments.cash },
      { label: "Online payments", on: data.common.payments.online },
    ]);
    field("Prices include GST", data.common.tax.pricesIncludeTax ? "Yes" : "No, GST is added");
    field("Default GST rate", `${data.common.tax.gstRatePct}%`);
    field("Service charge", `${data.common.tax.serviceChargePct}%`);

    section("7. Look and feel", 280);
    const palette = ONBOARDING_PALETTES.find((p) => p.id === data.look.paletteId);
    field("Colour scheme", palette ? palette.name : "Custom colours");
    swatch("Brand colour", data.look.primary);
    swatch("Page background", data.look.background);
    swatch("Cards and panels", data.look.surface);
    swatch("Text", data.look.text);
    field("Light / dark", mode(data.look.mode));
    field("Style", data.look.effect === "none" ? "Plain (no special effect)" : data.look.effect);
    field("Font", FONT_FAMILIES.find((f) => f.id === data.look.font)?.name ?? data.look.font);
    field("Logo", `${LOGO_STATES.find((l) => l.id === data.look.logo)?.label ?? ""}${data.look.logoLink ? `\n${data.look.logoLink}` : ""}`);
    field("Look they like", data.look.references);

    section("8. Addresses");
    field("Rasoi Pulse address", onboardingSubdomain(data) ? `${onboardingSubdomain(data)}  (the platform adds its domain)` : "");
    field("Own domain", data.address.ownDomain);

    section("9. Setting up", 175);
    field("Menu will come from", data.setup.menuSource);
    field("About how many items", data.setup.itemCount);
    field("Kitchen printers", data.setup.printers);
    field("Team besides the owner", String(data.setup.teamCount));
    field("Notes", data.setup.notes);

    ensure(120);
    section("10. Sign-off");
    const y = doc.y + 24;
    for (const [i, who] of ["Rasoi Pulse representative", "Client"].entries()) {
      const x = MARGIN + i * (W / 2 + 6);
      const w = W / 2 - 6;
      doc.lineWidth(0.7).strokeColor("#8a847a").moveTo(x, y).lineTo(x + w, y).stroke();
      doc.font("Helvetica").fontSize(8).fillColor(MUTED).text(`${who} — name and signature`, x, y + 3, { width: w });
      doc.lineWidth(0.7).moveTo(x, y + 36).lineTo(x + w * 0.5, y + 36).stroke();
      doc.text("Date", x, y + 39, { width: w });
    }
    doc.y = y + 60;

    // footers: "Rasoi Pulse client onboarding · Page 2 of 3".
    // The footer sits in the bottom margin. Text written below the bottom margin makes the library start a NEW page, so
    // each footer would add a blank page of its own (printing then shows empty pages with only a footer) — the bottom
    // margin is set to 0 while the footer is written, so it stays on the page it belongs to.
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(pages.start + i);
      const keep = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc.font("Helvetica").fontSize(8).fillColor(MUTED);
      doc.text(`Rasoi Pulse client onboarding · ${data.business.storeName || "new client"} · Page ${i + 1} of ${pages.count}`, MARGIN, doc.page.height - 36, { width: W, align: "center", lineBreak: false });
      doc.page.margins.bottom = keep;
    }
    doc.end();
  });
}
