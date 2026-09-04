import {
  charsFor,
  isThermal,
  PAPER,
                   
                    
                     
} from "@onetap/config-schema";

/* ------------------------------------------------------------------ inputs */

                               
               
                   
                 
                   
                        
                 
 

                             
               
                        
                                                     
                   
                    
                    
                
 

                              
                      
                  
                 
                  
                       
                                               
                
                      
           
                     
                    
                 
                 
                      
                          
                     
                       
    
                            
                                               
 

                              
                          
                       
                            
                      
                  
                  
     
                                                                                 
                                                                              
                                                                   
     
                     
 

/* ------------------------------------------------------------------- money */

/**
 * The rupee sign is not in the default ESC/POS code page — a thermal printer
 * renders it as garbage. Plain text gets "Rs.", HTML (and therefore anything
 * going through a real driver) gets the real symbol.
 */
function money(paise        , unicode         )         {
  const neg = paise < 0;
  const v = (Math.abs(paise) / 100).toFixed(2);
  return `${neg ? "-" : ""}${unicode ? "₹" : "Rs."}${v}`;
}

/* ------------------------------------------------- plain-text layout helpers */

const pad = (s        , n        ) => (s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length));

function center(s        , n        )         {
  if (s.length >= n) return s.slice(0, n);
  const left = Math.floor((n - s.length) / 2);
  return " ".repeat(left) + s;
}

function right(s        , n        )         {
  return s.length >= n ? s.slice(0, n) : " ".repeat(n - s.length) + s;
}

function align(s        , a                      , n        )         {
  if (a === "center") return center(s, n);
  if (a === "right") return right(s, n);
  return s.slice(0, n);
}

/** Name on the left, amount hard against the right edge. */
function row(left        , amount        , n        )         {
  const room = n - amount.length - 1;
  if (room <= 0) return right(amount, n);
  return `${pad(left.slice(0, room), room)} ${amount}`;
}

function wrap(text        , n        )           {
  const out           = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (!line.length) line = word.slice(0, n);
      else if (line.length + 1 + word.length <= n) line += ` ${word}`;
      else {
        out.push(line);
        line = word.slice(0, n);
      }
    }
    out.push(line);
  }
  return out;
}

/* ------------------------------------------------------------ block content */

;              
                     
               
                   
                        
 

const DOC_FALLBACK_TITLE                               = {
  kot: "KITCHEN ORDER",
  receipt: "RECEIPT",
  bill: "TAX INVOICE",
  refund: "REFUND SLIP",
};

const CHANNEL_LABEL                         = {
  takeaway: "Takeaway",
  counter: "Counter",
  "dine-in": "Dine-in",
  delivery: "Delivery",
};

function stamp(d      )         {
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * One block → its lines of text. Returning strings (not styled objects) keeps
 * the thermal path and the HTML path rendering the identical document.
 */
function blockLines(block             , ctx     )           {
  const { input, cols, unicode, docType } = ctx;
  const { outlet, order, template } = input;
  const showPrices = docType !== "kot";

  switch (block.key) {
    case "logo":
      // Rendered as an image in HTML and as a raster in ESC/POS; the text
      // fallback names it so a plain-text preview is still readable.
      return template.logoUrl ? ["[ logo ]"] : [];

    case "name":
      return [outlet.name];

    case "address":
      return outlet.address ? wrap(outlet.address, cols) : [];

    case "contact": {
      const parts = [outlet.phone, outlet.website].filter(Boolean)            ;
      return parts.length ? [parts.join("  ")] : [];
    }

    case "legal": {
      const out           = [];
      if (outlet.fssaiLicense) out.push(`FSSAI: ${outlet.fssaiLicense}`);
      if (outlet.gstin) out.push(`GSTIN: ${outlet.gstin}`);
      return out;
    }

    case "docTitle":
      return [block.text || DOC_FALLBACK_TITLE[docType]];

    case "meta": {
      if (!order) return [];
      const out = [`Order #${order.orderNumber}`];
      if (order.tableNumber) out.push(`Table ${order.tableNumber}`);
      out.push(CHANNEL_LABEL[order.channel] ?? order.channel);
      out.push(stamp(order.createdAt));
      if (input.isReprint) out.push("*** REPRINT ***");
      if ((input.copies ?? 1) > 1 && input.copyOf) out.push(`Copy ${input.copyOf} of ${input.copies}`);
      return out;
    }

    case "customer": {
      if (!order?.customer) return [];
      const { name, phone } = order.customer;
      const out           = [];
      if (name) out.push(`Customer: ${name}`);
      if (phone) out.push(`Phone: ${phone}`);
      return out;
    }

    case "items": {
      if (!order) return [];
      const out           = [];
      for (const line of order.lines) {
        const label = line.variantLabel ? `${line.name} (${line.variantLabel})` : line.name;

        if (showPrices) {
          // "2 x Steam Momo            Rs.240.00"
          const head = `${line.quantity} x ${label}`;
          const amount = money(line.lineTotal, unicode);
          const room = cols - amount.length - 1;
          const headLines = wrap(head, room);
          out.push(row(headLines[0] ?? "", amount, cols));
          for (const extra of headLines.slice(1)) out.push(`  ${extra}`);
        } else {
          // The kitchen reads quantity first and never needs a price.
          for (const l of wrap(`${line.quantity} x ${label}`, cols)) out.push(l);
        }

        for (const m of line.modifiers) {
          const suffix = showPrices && m.priceDelta ? ` (${money(m.priceDelta, unicode)})` : "";
          for (const l of wrap(`   + ${m.label}${suffix}`, cols)) out.push(l);
        }
        if (line.note) for (const l of wrap(`   ! ${line.note}`, cols)) out.push(l);
      }
      return out;
    }

    case "totals": {
      if (!order || !showPrices) return [];
      const t = order.totals;
      const out = [row("Subtotal", money(t.subtotal, unicode), cols)];
      if (t.serviceCharge) out.push(row("Service charge", money(t.serviceCharge, unicode), cols));
      if (!order.pricesIncludeTax && t.taxAmount) out.push(row("Tax", money(t.taxAmount, unicode), cols));
      if (t.roundOff) out.push(row("Round off", money(t.roundOff, unicode), cols));
      out.push(row("TOTAL", money(t.grandTotal, unicode), cols));
      return out;
    }

    case "taxBreakup": {
      if (!order || !showPrices || !order.totals.taxAmount) return [];
      const t = order.totals;
      return [
        order.pricesIncludeTax ? "Tax included in the prices above" : "Tax",
        row("  Taxable value", money(t.taxable, unicode), cols),
        row("  CGST", money(t.cgst, unicode), cols),
        row("  SGST", money(t.sgst, unicode), cols),
      ];
    }

    case "payment": {
      if (!order || !showPrices) return [];
      const gateway = order.payment.gateway === "cod" ? "Cash / on delivery" : order.payment.gateway;
      const paid = order.payment.status === "paid";
      return [row(gateway.toUpperCase(), paid ? "PAID" : order.payment.status.toUpperCase(), cols)];
    }

    case "note":
      return order?.note ? wrap(`Note: ${order.note}`, cols) : [];

    case "qr":
      // The QR itself is drawn by the HTML/ESC-POS layer; this is its caption.
      return block.text ? wrap(block.text, cols) : [];

    case "message":
      return block.text ? wrap(block.text, cols) : [];

    case "spacer":
      return [""];

    default:
      return [];
  }
}

/* ---------------------------------------------------------- block pipeline */

;                               
                     
                                                             
                  
 

/**
 * The one place blocks turn into content. Text, HTML and ESC/POS all consume
 * this, so a template renders the same document down every path.
 */
export function renderBlocks(input             , unicode         )                  {
  const cols = charsFor(input.template);
  const ctx      = { input, cols, unicode, docType: input.template.docType };
  const out                  = [];

  for (const block of input.template.blocks) {
    if (!block.enabled) continue;
    const lines = blockLines(block, ctx);
    if (!lines.length && block.key !== "spacer" && !(block.key === "qr" && block.text)) continue;
    out.push({ block, lines });
  }
  return out;
}

/* -------------------------------------------------------------- plain text */

export function renderText(input             )         {
  const cols = charsFor(input.template);
  const out           = [];

  for (const { block, lines } of renderBlocks(input, false)) {
    for (const l of lines) out.push(align(l, block.align, cols));
    if (block.rule) out.push("-".repeat(cols));
  }

  for (let i = 0; i < input.template.feedLines; i++) out.push("");
  return out.join("\n");
}

/* --------------------------------------------------------------------- HTML */

const esc = (s        )         =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const FONT_PX                                      = { sm: 10, md: 12, lg: 16, xl: 21 };
const SHEET_FONT_PX                                      = { sm: 11, md: 13, lg: 17, xl: 23 };

/**
 * A standalone printable document. This is what `window.print()` renders, what
 * the admin preview shows, and what a cloud service turns into a PDF — so the
 * page box is sized to the real paper, not to the screen.
 */
export function renderHtml(input             )         {
  const { template, outlet } = input;
  const paper = PAPER[template.paperWidth];
  const cols = charsFor(template);
  const thermal = isThermal(template.paperWidth);
  const color = template.colorMode === "color";
  const ctx      = { input, cols, unicode: true, docType: template.docType };
  const sizes = thermal ? FONT_PX : SHEET_FONT_PX;

  const body           = [];

  for (const block of template.blocks) {
    if (!block.enabled) continue;

    if (block.key === "logo" && template.logoUrl) {
      body.push(
        `<div class="b" style="text-align:${block.align}">` +
          `<img class="logo" src="${esc(template.logoUrl)}" alt="" style="width:${template.logoWidthPct}%">` +
          `</div>`,
      );
      if (block.rule) body.push(`<hr>`);
      continue;
    }

    if (block.key === "qr" && block.text) {
      if (input.qrDataUrl) {
        const px = thermal ? 150 : 200;
        body.push(
          `<div class="b" style="text-align:${block.align}">` +
            `<img class="qr" src="${input.qrDataUrl}" alt="" width="${px}" height="${px}">` +
            `</div>`,
        );
      }
      if (block.rule) body.push(`<hr>`);
      continue;
    }

    const lines = blockLines(block, ctx);
    if (!lines.length && block.key !== "spacer") continue;

    const style = [
      `text-align:${block.align}`,
      `font-size:${sizes[block.size]}px`,
      block.bold ? "font-weight:700" : "",
      block.size === "lg" || block.size === "xl" ? "line-height:1.25" : "",
    ]
      .filter(Boolean)
      .join(";");

    // Pre-formatted so the column arithmetic above survives into the print.
    body.push(`<pre class="b" style="${style}">${lines.map(esc).join("\n") || "&nbsp;"}</pre>`);
    if (block.rule) body.push(`<hr>`);
  }

  const pageCss = thermal
    ? `@page { size: ${paper.printableMm}mm auto; margin: 0; }`
    : `@page { size: ${template.paperWidth.toUpperCase()}; margin: 12mm; }`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(outlet.name)} — ${esc(template.name)}</title>
<style>
  ${pageCss}
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body {
    width: ${paper.printableMm}mm;
    ${thermal ? "" : "width: auto;"}
    margin: 0 auto;
    padding: ${thermal ? "4mm 2mm" : "0"};
    color: ${color ? "#111" : "#000"};
    font-family: ${thermal ? `"Courier New", ui-monospace, monospace` : `"Helvetica Neue", Arial, sans-serif`};
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  pre.b {
    margin: 0 0 2px;
    font-family: inherit;
    white-space: pre-wrap;
    word-break: break-word;
  }
  hr { border: 0; border-top: 1px dashed #000; margin: 4px 0; }
  img.logo {
    display: inline-block;
    max-width: 100%;
    ${color ? "" : "filter: grayscale(1) contrast(2.2);"}
  }
  img.qr { display: inline-block; image-rendering: pixelated; }
  @media screen {
    body { box-shadow: 0 1px 12px rgba(0,0,0,0.18); ${thermal ? "" : "max-width: 210mm; padding: 12mm;"} }
  }
</style>
</head>
<body>
${body.join("\n")}
</body>
</html>`;
}

/** Everything the admin preview needs in one call. */
export function renderAll(input             )                                               {
  return { text: renderText(input), html: renderHtml(input), cols: charsFor(input.template) };
}
