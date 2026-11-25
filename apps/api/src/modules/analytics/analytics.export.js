import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { computeProfitLoss, dayEnd, dayKey, dayStart, daysBetween, EXPORT_SECTIONS } from "@rasoipulse/config-schema";
import { OrderModel } from "@rasoipulse/db";
import * as svc from "./analytics.service.js";

/**
 * Reports as files. One function gathers the numbers into plain TABLES (a section = title + columns + rows), and four
 * small writers turn the same tables into Excel, CSV, PDF or JSON — so a figure is the same whichever file you open.
 * Money in the tables is in rupees (the files are for people and spreadsheets), everywhere else it's paise.
 */

const rupees = (paise) => Math.round((paise ?? 0)) / 100;
const CHANNEL = { takeaway: "Takeaway", delivery: "Delivery", "dine-in": "Dine-in" };
const GATEWAY = { cod: "Cash at the counter", razorpay: "Online (Razorpay)", mock: "Test gateway" };
const pct = (v) => (v === null || v === undefined ? null : Math.round(v * 1000) / 1000);
const hourLabel = (h) => `${String(h).padStart(2, "0")}:00–${String((h + 1) % 24).padStart(2, "0")}:00`;

/** Gather every section a report might hold; the caller picks which to write. */
export async function buildReport(ctx, input, outlets, { canFinance }) {
  const range = { from: input.from, to: input.to };
  const ids = input.outletIds;
  const wanted = new Set(input.sections.length ? input.sections : EXPORT_SECTIONS.filter((s) => !s.finance && s.id !== "orders").map((s) => s.id));
  if (!input.sections.length && !canFinance) wanted.delete("gst"); // the GST report is a money figure
  if (input.format === "csv") { wanted.clear(); wanted.add(input.section); }
  const ov = await svc.overview(ctx, range, ids, { granularity: "day" });
  const k = ov.kpis;
  const p = ov.previousKpis;
  const sections = [];
  const add = (id, title, columns, rows) => { if (wanted.has(id)) sections.push({ id, title, columns, rows }); };
  const scopeLabel = ids.length ? outlets.filter((o) => ids.includes(o.id)).map((o) => o.title).join(", ") : "Whole store";

  add("summary", "Summary", [
    { key: "measure", label: "Measure", kind: "text" },
    { key: "value", label: "This period", kind: "auto" },
    { key: "previous", label: "Previous period", kind: "auto" },
  ], [
    { measure: "Sales (incl. GST)", value: rupees(k.sales), previous: rupees(p.sales), fmt: "money" },
    { measure: "Net sales (excl. GST)", value: rupees(k.net), previous: rupees(p.net), fmt: "money" },
    { measure: "GST collected", value: rupees(k.tax), previous: rupees(p.tax), fmt: "money" },
    { measure: "Orders", value: k.orders, previous: p.orders, fmt: "int" },
    { measure: "Average order value", value: rupees(k.aov), previous: rupees(p.aov), fmt: "money" },
    { measure: "Items sold", value: k.items, previous: p.items, fmt: "int" },
    { measure: "Customers served", value: k.customers, previous: p.customers, fmt: "int" },
    { measure: "Discounts given", value: rupees(k.discount), previous: rupees(p.discount), fmt: "money" },
    { measure: "Coin discounts", value: rupees(k.coins), previous: rupees(p.coins), fmt: "money" },
    { measure: "Delivery fees", value: rupees(k.delivery), previous: rupees(p.delivery), fmt: "money" },
    { measure: "Cancelled orders", value: ov.cancellations.cancelled, previous: ov.previousCancellations.cancelled, fmt: "int" },
    { measure: "Cancellation rate", value: pct(ov.cancellations.rate), previous: pct(ov.previousCancellations.rate), fmt: "pct" },
    { measure: "New customers", value: ov.newVsRepeat.newCustomers, previous: null, fmt: "int" },
    { measure: "Returning customers", value: ov.newVsRepeat.repeatCustomers, previous: null, fmt: "int" },
  ]);

  add("daily", "Sales by day", [
    { key: "day", label: "Day", kind: "text" }, { key: "orders", label: "Orders", kind: "int" },
    { key: "sales", label: "Sales (incl. GST)", kind: "money" }, { key: "net", label: "Net sales", kind: "money" },
  ], ov.series.map((r) => ({ day: r.key, orders: r.orders, sales: rupees(r.sales), net: rupees(r.net) })));

  add("hourly", "Sales by hour", [
    { key: "hour", label: "Hour", kind: "text" }, { key: "orders", label: "Orders", kind: "int" }, { key: "sales", label: "Sales", kind: "money" },
  ], ov.hourly.map((r) => ({ hour: hourLabel(r.hour), orders: r.orders, sales: rupees(r.sales) })));

  add("channels", "Order types", [
    { key: "channel", label: "Order type", kind: "text" }, { key: "orders", label: "Orders", kind: "int" }, { key: "sales", label: "Sales", kind: "money" }, { key: "share", label: "Share", kind: "pct" },
  ], ov.channels.map((r) => ({ channel: CHANNEL[r.id] ?? r.id, orders: r.orders, sales: rupees(r.sales), share: k.sales ? pct(r.sales / k.sales) : 0 })));

  add("payments", "Payment methods", [
    { key: "method", label: "Method", kind: "text" }, { key: "orders", label: "Orders", kind: "int" }, { key: "sales", label: "Sales", kind: "money" }, { key: "share", label: "Share", kind: "pct" },
  ], ov.payments.map((r) => ({ method: GATEWAY[r.id] ?? r.id, orders: r.orders, sales: rupees(r.sales), share: k.sales ? pct(r.sales / k.sales) : 0 })));

  if (wanted.has("items")) {
    const it = await svc.itemsReport(ctx, range, ids);
    add("items", "Items sold", [
      { key: "rank", label: "#", kind: "int" }, { key: "name", label: "Item", kind: "text" }, { key: "qty", label: "Quantity", kind: "int" },
      { key: "revenue", label: "Revenue", kind: "money" }, { key: "orders", label: "In orders", kind: "int" }, { key: "perDay", label: "Per day", kind: "dec" }, { key: "share", label: "Share of items", kind: "pct" },
    ], it.items.map((r) => ({ rank: r.rank, name: r.name, qty: r.qty, revenue: rupees(r.revenue), orders: r.orders, perDay: r.perDay, share: pct(r.qtyShare) })));
  }

  if (wanted.has("gst")) {
    const g = await svc.gstReport(ctx, range, ids);
    const rows = g.days.map((r) => ({ day: r.day, orders: r.orders, taxable: rupees(r.taxable), cgst: rupees(r.cgst), sgst: rupees(r.sgst), tax: rupees(r.tax), service: rupees(r.service), total: rupees(r.total) }));
    rows.push({ day: "Total", orders: g.totals.orders, taxable: rupees(g.totals.taxable), cgst: rupees(g.totals.cgst), sgst: rupees(g.totals.sgst), tax: rupees(g.totals.tax), service: rupees(g.totals.service), total: rupees(g.totals.total) });
    add("gst", "GST", [
      { key: "day", label: "Day", kind: "text" }, { key: "orders", label: "Orders", kind: "int" }, { key: "taxable", label: "Taxable value", kind: "money" },
      { key: "cgst", label: "CGST", kind: "money" }, { key: "sgst", label: "SGST", kind: "money" }, { key: "tax", label: "Total GST", kind: "money" },
      { key: "service", label: "Service charge", kind: "money" }, { key: "total", label: "Invoice total", kind: "money" },
    ], rows);
  }

  if (wanted.has("outlets")) {
    const c = await svc.compareOutlets(ctx, range, ids, outlets);
    add("outlets", "Outlets compared", [
      { key: "outlet", label: "Outlet", kind: "text" }, { key: "orders", label: "Orders", kind: "int" }, { key: "sales", label: "Sales", kind: "money" },
      { key: "net", label: "Net sales", kind: "money" }, { key: "aov", label: "Average order", kind: "money" }, { key: "customers", label: "Customers", kind: "int" }, { key: "cancelled", label: "Cancelled", kind: "int" },
    ], c.outlets.map((o) => ({ outlet: o.name, orders: o.kpis.orders, sales: rupees(o.kpis.sales), net: rupees(o.kpis.net), aov: rupees(o.kpis.aov), customers: o.kpis.customers, cancelled: o.cancelled.cancelled })));
  }

  if (wanted.has("customers")) {
    const c = await svc.customersReport(ctx, range, ids);
    add("customers", "Top customers", [
      { key: "name", label: "Customer", kind: "text" }, { key: "phone", label: "Phone", kind: "text" }, { key: "orders", label: "Orders", kind: "int" },
      { key: "spend", label: "Spent", kind: "money" }, { key: "last", label: "Last order", kind: "text" },
    ], c.top.map((r) => ({ name: r.name, phone: r.phone, orders: r.orders, spend: rupees(r.spend), last: dayKey(r.last) })));
  }

  if (wanted.has("orders")) {
    const match = { brandId: ctx.brandId, createdAt: { $gte: dayStart(range.from), $lt: dayEnd(range.to) }, ...(ids.length ? { outletId: { $in: ids } } : {}) };
    const orders = await OrderModel.find(match).sort({ createdAt: 1 }).limit(50_000).select("createdAt outletId orderNumber channel status payment customer lines totals couponCode").lean();
    const name = new Map(outlets.map((o) => [o.id, o.title]));
    add("orders", "Every order", [
      { key: "when", label: "Date & time", kind: "text" }, { key: "outlet", label: "Outlet", kind: "text" }, { key: "number", label: "Order #", kind: "text" },
      { key: "type", label: "Type", kind: "text" }, { key: "status", label: "Status", kind: "text" }, { key: "payment", label: "Payment", kind: "text" },
      { key: "customer", label: "Customer", kind: "text" }, { key: "items", label: "Items", kind: "text" }, { key: "coupon", label: "Coupon", kind: "text" },
      { key: "subtotal", label: "Subtotal", kind: "money" }, { key: "discount", label: "Discount", kind: "money" }, { key: "tax", label: "GST", kind: "money" }, { key: "total", label: "Total", kind: "money" },
    ], orders.map((o) => ({
      when: new Date(o.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: false }),
      outlet: name.get(o.outletId) ?? "", number: o.orderNumber, type: CHANNEL[o.channel] ?? o.channel, status: o.status,
      payment: `${GATEWAY[o.payment?.gateway] ?? o.payment?.gateway ?? ""} · ${o.payment?.status ?? ""}`,
      customer: [o.customer?.name, o.customer?.phone].filter(Boolean).join(" "),
      items: (o.lines ?? []).map((l) => `${l.quantity}× ${l.name}${l.variantLabel ? ` (${l.variantLabel})` : ""}`).join("; "),
      coupon: o.couponCode ?? "", subtotal: rupees(o.totals?.subtotal), discount: rupees(o.totals?.discount), tax: rupees(o.totals?.taxAmount), total: rupees(o.totals?.grandTotal),
    })));
  }

  if (wanted.has("pnl") && canFinance && input.pnl) {
    const r = computeProfitLoss({ netSalesPaise: k.net, foodCostPct: input.pnl.foodCostPct, expenses: input.pnl.expenses, range });
    const rows = [
      { line: "Net sales (excl. GST)", amount: round2(r.sales) },
      { line: `Food cost (${input.pnl.foodCostPct}% of sales)`, amount: -round2(r.foodCost) },
      { line: "Gross profit", amount: round2(r.grossProfit) },
      ...r.lines.map((l) => ({ line: l.label, amount: -round2(l.cost) })),
      { line: "Total expenses", amount: -round2(r.totalExpenses) },
      { line: "NET PROFIT", amount: round2(r.net) },
      { line: "Profit margin", amount: r.marginPct === null ? null : round2(r.marginPct), fmt: "pctPoints" },
      { line: "Break-even sales for this period", amount: r.breakEvenSales === null ? null : round2(r.breakEvenSales) },
    ];
    add("pnl", "Profit & loss", [{ key: "line", label: "", kind: "text" }, { key: "amount", label: "Amount (₹)", kind: "auto" }], rows);
  }

  return { title: "Rasoi Pulse report", range, days: daysBetween(range.from, range.to), scopeLabel, generated: new Date(), sections, kpis: k };
}
const round2 = (n) => Math.round(n * 100) / 100;

/* ------------------------------------------------------------------ writers */

const csvCell = (v) => {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export function toCsv(section) {
  const head = section.columns.map((c) => csvCell(c.label)).join(",");
  const lines = section.rows.map((r) => section.columns.map((c) => csvCell(r[c.key])).join(","));
  return "﻿" + [head, ...lines].join("\r\n") + "\r\n"; // the BOM makes Excel read ₹ and Hindi names correctly
}

const FMT = { money: '"₹"#,##0.00', int: "#,##0", dec: "#,##0.0", pct: "0.0%", pctPoints: '0.0"%"' };
export async function toXlsx(report) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Rasoi Pulse";
  wb.created = report.generated;
  for (const s of report.sections) {
    const ws = wb.addWorksheet(s.title.replace(/[\\/?*[\]:]/g, " ").slice(0, 31), { views: [{ state: "frozen", ySplit: 1 }] });
    ws.columns = s.columns.map((c) => ({ header: c.label, key: c.key, width: Math.max(12, Math.min(48, c.label.length + 6)) }));
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFB42318" } };
    for (const r of s.rows) ws.addRow(r);
    s.columns.forEach((c, i) => {
      const col = ws.getColumn(i + 1);
      if (c.kind !== "text" && c.kind !== "auto") col.numFmt = FMT[c.kind];
      if (c.kind === "text") { const longest = Math.max(c.label.length, ...s.rows.slice(0, 200).map((r) => String(r[c.key] ?? "").length)); col.width = Math.max(col.width, Math.min(60, longest + 2)); }
    });
    // rows whose format is given per row (the summary and the profit & loss)
    s.rows.forEach((r, i) => {
      const f = r.fmt ? FMT[r.fmt] : null;
      if (f) s.columns.forEach((c, ci) => { if (c.kind === "auto") ws.getRow(i + 2).getCell(ci + 1).numFmt = f; });
      else if (s.id === "pnl") ws.getRow(i + 2).getCell(2).numFmt = '#,##0.00;[Red]-#,##0.00';
    });
    if (s.id === "pnl") s.rows.forEach((r, i) => { if (/NET PROFIT|Gross profit/.test(r.line)) ws.getRow(i + 2).font = { bold: true }; });
  }
  if (!report.sections.length) wb.addWorksheet("Report").addRow(["Nothing selected"]);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const money = (n) => `Rs ${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Math.round(n))}`;
export function toPdf(report) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40, info: { Title: `Rasoi Pulse report ${report.range.from} to ${report.range.to}`, Author: "Rasoi Pulse" } });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    const W = doc.page.width - 80;
    const red = "#b42318";
    doc.fillColor(red).fontSize(22).text("Rasoi Pulse", { continued: true }).fillColor("#111").fontSize(22).text("  report");
    doc.fontSize(11).fillColor("#555").text(`${report.range.from}  to  ${report.range.to}  (${report.days} day${report.days === 1 ? "" : "s"})`);
    doc.text(`${report.scopeLabel}  ·  made ${report.generated.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`);
    doc.moveDown(0.8);

    const cell = (v, c) => {
      if (v === null || v === undefined) return "";
      if (c.kind === "money") return money(v);
      if (c.kind === "pct") return `${(v * 100).toFixed(1)}%`;
      if (c.kind === "dec") return Number(v).toFixed(1);
      if (c.kind === "int") return new Intl.NumberFormat("en-IN").format(v);
      return String(v);
    };
    // one cell as text; "auto" columns (the summary and the profit & loss) carry their format on the row
    const rowFmt = (r, c, v) => {
      if (c.kind !== "auto") return cell(v, c);
      if (v === null || v === undefined) return "";
      if (r.fmt === "money") return money(v);
      if (r.fmt === "int") return new Intl.NumberFormat("en-IN").format(v);
      if (r.fmt === "pct") return `${(v * 100).toFixed(1)}%`;
      if (r.fmt === "pctPoints") return `${Number(v).toFixed(1)}%`;
      return typeof v === "number" ? (v < 0 ? `- ${money(-v)}` : money(v)) : String(v);
    };

    const table = (section, maxRows = 40) => {
      if (doc.y > doc.page.height - 140) doc.addPage();
      doc.fillColor("#111").fontSize(13).text(section.title);
      doc.moveDown(0.3);
      const cols = section.columns;
      const weights = cols.map((c) => (c.kind === "text" ? 2.2 : 1));
      const total = weights.reduce((a, b) => a + b, 0);
      const widths = weights.map((w) => (w / total) * W);
      const line = (cells, bold, shade) => {
        if (doc.y > doc.page.height - 70) doc.addPage();
        const y = doc.y;
        if (shade) doc.rect(40, y - 2, W, 15).fill(shade).fillColor("#111");
        let x = 40;
        cells.forEach((t, i) => { doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(8.5).fillColor("#111").text(String(t).slice(0, 60), x + 2, y, { width: widths[i] - 4, align: cols[i].kind === "text" ? "left" : "right", lineBreak: false }); x += widths[i]; });
        doc.y = y + 15;
      };
      line(cols.map((c) => c.label), true, "#f3f3f3");
      section.rows.slice(0, maxRows).forEach((r, i) => line(cols.map((c) => rowFmt(r, c, r[c.key])), /NET PROFIT|^Total$/.test(String(r.line ?? r.day ?? "")), i % 2 ? "#fafafa" : null));
      if (section.rows.length > maxRows) doc.font("Helvetica-Oblique").fontSize(8).fillColor("#777").text(`…and ${section.rows.length - maxRows} more rows (the Excel and CSV files have all of them).`);
      doc.font("Helvetica").moveDown(0.8);
    };

    const bySection = Object.fromEntries(report.sections.map((s) => [s.id, s]));
    if (bySection.summary) table(bySection.summary);
    // a bar chart of sales by day, drawn straight onto the page
    if (bySection.daily && bySection.daily.rows.length > 1) {
      doc.fillColor("#111").fontSize(13).text("Sales by day");
      const rows = bySection.daily.rows.length > 62 ? [] : bySection.daily.rows;
      if (rows.length) {
        const top = doc.y + 6, h = 110, max = Math.max(...rows.map((r) => r.sales), 1), bw = W / rows.length;
        rows.forEach((r, i) => { const bh = (r.sales / max) * h; doc.rect(40 + i * bw + 1, top + h - bh, Math.max(1, bw - 2), bh).fill(red); });
        doc.fillColor("#777").fontSize(8).text(`${rows[0].day}`, 40, top + h + 4).text(`${rows[rows.length - 1].day}`, 40, top + h + 4, { width: W, align: "right" });
        doc.text(`Busiest day: ${money(max)}`, 40, top + h + 4, { width: W, align: "center" });
        doc.y = top + h + 26;
      }
    }
    for (const id of ["channels", "payments", "outlets", "items", "gst", "customers", "pnl"]) if (bySection[id]) table(bySection[id], id === "items" ? 25 : 40);
    if (bySection.hourly) table(bySection.hourly, 24);
    if (bySection.daily && bySection.daily.rows.length <= 40) table(bySection.daily, 40);
    doc.end();
  });
}

export const toJson = (report) => JSON.stringify({ title: report.title, range: report.range, scope: report.scopeLabel, generated: report.generated, sections: Object.fromEntries(report.sections.map((s) => [s.id, { title: s.title, columns: s.columns.map((c) => c.label), rows: s.rows }])) }, null, 2);

