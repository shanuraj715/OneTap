import { z } from "zod";

/* ------------------------------------------------------------------- paper */

export const PAPER_WIDTHS = ["58mm", "80mm", "a5", "a4"]         ;
export const paperWidthSchema = z.enum(PAPER_WIDTHS);
                                                       

                            
                
                                                                                  
                      
                                                                                
               
                                                                                  
                
                                                                 
                      
                    
               
 

export const PAPER                                = {
  "58mm": {
    label: '58 mm roll (2")',
    printableMm: 48,
    dots: 384,
    chars: 32,
    continuous: true,
    hint: "Small thermal roll. 32 characters per line — long item names wrap.",
  },
  "80mm": {
    label: '80 mm roll (3")',
    printableMm: 72,
    dots: 576,
    chars: 48,
    continuous: true,
    hint: "The standard receipt and KOT roll. 48 characters per line.",
  },
  a5: {
    label: "A5 sheet",
    printableMm: 138,
    dots: 1104,
    chars: 64,
    continuous: false,
    heightMm: 210,
    hint: "Half-page sheet for a printed bill. Needs a normal inkjet or laser printer.",
  },
  a4: {
    label: "A4 sheet",
    printableMm: 190,
    dots: 1520,
    chars: 80,
    continuous: false,
    heightMm: 297,
    hint: "Full-page GST tax invoice. Needs a normal inkjet or laser printer.",
  },
};

export const isThermal = (w            )          => PAPER[w].continuous;

/* ---------------------------------------------------------------- stations */

/** Where a printer physically sits. Drives which documents get routed to it. */
export const PRINT_STATIONS = ["counter", "kitchen", "bar", "packing", "manager"]         ;
export const printStationSchema = z.enum(PRINT_STATIONS);
                                                           

export const STATION_LABELS                               = {
  counter: "Counter / cash desk",
  kitchen: "Kitchen",
  bar: "Bar / beverages",
  packing: "Packing & delivery",
  manager: "Manager / back office",
};

export const STATION_HINTS                               = {
  counter: "The printer at the billing desk. Customer receipts and bills print here.",
  kitchen: "The printer the cooks read. Gets the KOT — item names and quantities, never prices.",
  bar: "A second kitchen-style printer for drinks, so the bar doesn't wait on the food ticket.",
  packing: "For takeaway and delivery — the packing slip that goes on the bag.",
  manager: "Back-office printer for day-end and refund paperwork.",
};

/* --------------------------------------------------------------- documents */

export const PRINT_DOCS = ["kot", "receipt", "bill", "refund"]         ;
export const printDocSchema = z.enum(PRINT_DOCS);
                                                       

export const DOC_LABELS                               = {
  kot: "Kitchen ticket (KOT)",
  receipt: "Customer receipt",
  bill: "Tax invoice / bill",
  refund: "Refund slip",
};

export const DOC_HINTS                               = {
  kot: "What the kitchen cooks from. Big item names, no prices, no tax — deliberately.",
  receipt: "The slip handed to the customer with the food. Prices, tax split, FSSAI and GSTIN.",
  bill: "A fuller invoice, usually on A4/A5, for customers who need it for expenses.",
  refund: "Printed when an order is refunded, as the paper trail for the cash drawer.",
};

/** Which document a station prints by default when an order fires. */
export const STATION_DEFAULT_DOC                                     = {
  counter: "receipt",
  kitchen: "kot",
  bar: "kot",
  packing: "receipt",
  manager: "bill",
};

/* ----------------------------------------------------------------- targets */

/**
 * How the bytes actually reach the printer. A browser cannot open a raw socket,
 * so every silent path needs something on site — this is that choice, made
 * explicit and per-printer.
 */
export const PRINT_TARGETS = ["browser", "epos-lan", "cloud", "agent"]         ;
export const printTargetSchema = z.enum(PRINT_TARGETS);
                                                         

                             
                
                                                                
                  
                                                                        
                  
               
                 
 

export const TARGETS                                  = {
  browser: {
    label: "This browser (print dialog)",
    silent: false,
    escpos: false,
    hint: "Uses the printer already installed on this computer. Works with anything, needs no setup.",
    caveat: "Somebody has to click Print. No auto-cut and no cash-drawer kick.",
  },
  "epos-lan": {
    label: "EPSON ePOS over the local network",
    silent: true,
    escpos: true,
    hint: "Talks straight to a networked EPSON TM printer at its IP address. No extra hardware, no monthly fee.",
    caveat: "The printer and the browser must share a network, and an https admin page is blocked from calling a plain http printer.",
  },
  cloud: {
    label: "Cloud print service",
    silent: true,
    escpos: true,
    hint: "The server sends the job to PrintNode or a CloudPRNT printer. Most reliable — works even when no browser is open.",
    caveat: "A paid third-party account, or a CloudPRNT-capable printer.",
  },
  agent: {
    label: "TablePe print agent",
    silent: true,
    escpos: true,
    hint: "A small program on an always-on computer at the outlet, which collects jobs and prints them.",
    caveat: "The agent has to be installed and left running on a machine at the outlet.",
  },
};

/* -------------------------------------------------------------- connection */

/** Only the fields the chosen target actually uses are required. */
export const connectionSchema = z.object({
  /** epos-lan: printer IP or hostname on the LAN */
  host: z.string().max(120).default(""),
  port: z.number().int().min(1).max(65535).default(80),
  useTls: z.boolean().default(false),
  /** epos-lan: EPSON device id, "local_printer" on almost every TM model */
  deviceId: z.string().max(60).default("local_printer"),
  /** cloud: PrintNode printer id, or the CloudPRNT device serial */
  cloudPrinterId: z.string().max(120).default(""),
  /**
   * cloud: the service's API key. Encrypted at rest and never returned by the
   * API — reads get `cloudApiKeySet` instead.
   */
  cloudApiKey: z.string().max(400).default(""),
  /** agent: which agent claims this printer's jobs */
  agentId: z.string().max(120).default(""),
  /** agent + cloud: the OS queue name to print to */
  queueName: z.string().max(120).default(""),
});
                                                                 

/* -------------------------------------------------------------- job status */

export const PRINT_JOB_STATUSES = ["queued", "printing", "printed", "failed", "cancelled"]         ;
export const printJobStatusSchema = z.enum(PRINT_JOB_STATUSES);
                                                                 

export const JOB_STATUS_LABELS                                 = {
  queued: "Waiting",
  printing: "Printing",
  printed: "Printed",
  failed: "Failed",
  cancelled: "Cancelled",
};

/** Terminal states never get retried. */
export const isJobOpen = (s                )          => s === "queued" || s === "printing";

/**
 * Backoff between retries, in seconds. Out-of-paper is the common failure and a
 * human has to walk over and fix it, so the gaps widen fast rather than
 * hammering a printer nobody has reached yet.
 */
export const RETRY_BACKOFF_SEC = [10, 30, 120, 300, 900]         ;
export const DEFAULT_MAX_ATTEMPTS = 5;

export function nextRetryDelaySec(attempt        )         {
  const i = Math.max(0, Math.min(attempt, RETRY_BACKOFF_SEC.length - 1));
  return RETRY_BACKOFF_SEC[i] ?? RETRY_BACKOFF_SEC[RETRY_BACKOFF_SEC.length - 1] ;
}

/* ---------------------------------------------------------------- printers */

export const printerSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(60),
  station: printStationSchema,
  docType: printDocSchema,
  target: printTargetSchema,
  paperWidth: paperWidthSchema,
  templateId: z.string().nullable().default(null),
  connection: connectionSchema,
  /** order statuses that fire this printer automatically */
  autoPrintOn: z.array(z.string()).default([]),
  /** channels this printer cares about; empty means all of them */
  channels: z.array(z.string()).default([]),
  copies: z.number().int().min(1).max(5).default(1),
  cutAfter: z.boolean().default(true),
  openDrawer: z.boolean().default(false),
  isActive: z.boolean().default(true),
  /** last time a job on this printer succeeded — the "is it alive" signal */
  lastOkAt: z.string().nullable().default(null),
  lastErrorAt: z.string().nullable().default(null),
  lastError: z.string().nullable().default(null),
});
                                                    

/* --------------------------------------------------------------- templates */

/**
 * A template is an ordered list of blocks. Reordering, hiding and restyling
 * blocks covers what a restaurant actually wants to change without turning this
 * into a free-form layout engine we would have to render on a 32-column roll.
 */
export const PRINT_BLOCKS = [
  "logo",
  "name",
  "address",
  "contact",
  "legal",
  "docTitle",
  "meta",
  "customer",
  "items",
  "totals",
  "taxBreakup",
  "payment",
  "note",
  "qr",
  "message",
  "spacer",
]         ;
export const printBlockSchema = z.enum(PRINT_BLOCKS);
                                                          

export const BLOCK_LABELS                                = {
  logo: "Logo",
  name: "Restaurant name",
  address: "Address",
  contact: "Phone / website",
  legal: "FSSAI & GSTIN",
  docTitle: "Document title",
  meta: "Order number, time, table",
  customer: "Customer name & phone",
  items: "Items",
  totals: "Totals",
  taxBreakup: "CGST / SGST split",
  payment: "Payment method & status",
  note: "Order note",
  qr: "QR code",
  message: "Custom message",
  spacer: "Blank space",
};

export const BLOCK_HINTS                                = {
  logo: "Your logo, converted to black and white dots for a thermal printer.",
  name: "The outlet name, printed large at the top.",
  address: "Street address, printed small under the name.",
  contact: "Phone number and website, so the customer can reach you.",
  legal: "FSSAI licence number and GSTIN. Legally required on a tax invoice in India.",
  docTitle: "The words identifying the slip — 'KITCHEN ORDER' or 'TAX INVOICE'.",
  meta: "Order number, date and time, table number, channel.",
  customer: "Who ordered. Useful on takeaway bags, pointless on a dine-in KOT.",
  items: "The item lines. On a KOT this prints big with no prices.",
  totals: "Subtotal, service charge, rounding and the grand total.",
  taxBreakup: "CGST and SGST shown separately, as a GST invoice must.",
  payment: "How it was paid and whether the money has landed.",
  note: "Anything the customer typed — 'less spicy', 'no onion'.",
  qr: "A QR code on the slip. Point it at your feedback form or a UPI handle.",
  message: "A fixed line of your own text — 'Thank you, visit again'.",
  spacer: "Blank lines. Useful before the cut so the slip tears cleanly.",
};

export const ALIGNS = ["left", "center", "right"]         ;
export const alignSchema = z.enum(ALIGNS);
                                                 

export const SIZES = ["sm", "md", "lg", "xl"]         ;
export const sizeSchema = z.enum(SIZES);
                                               

export const SIZE_LABELS                            = {
  sm: "Small",
  md: "Normal",
  lg: "Large",
  xl: "Extra large",
};

export const blockConfigSchema = z.object({
  key: printBlockSchema,
  enabled: z.boolean().default(true),
  align: alignSchema.default("left"),
  size: sizeSchema.default("md"),
  bold: z.boolean().default(false),
  /** dividing rule printed under this block */
  rule: z.boolean().default(false),
  /** message + qr blocks carry their own content */
  text: z.string().max(400).default(""),
});
                                                            

export const COLOR_MODES = ["bw", "color"]         ;
export const colorModeSchema = z.enum(COLOR_MODES);
                                                     

export const COLOR_MODE_LABELS                            = {
  bw: "Black & white",
  color: "Colour",
};

export const printTemplateSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(60),
  docType: printDocSchema,
  paperWidth: paperWidthSchema,
  colorMode: colorModeSchema.default("bw"),
  /** absolute or data: URL. Used as-is for HTML and sheet printing. */
  logoUrl: z.string().max(2000).default(""),
  logoWidthPct: z.number().int().min(10).max(100).default(55),
  /** monochrome threshold used when converting the logo for thermal printing */
  logoThreshold: z.number().int().min(1).max(254).default(128),
  /**
   * The 1-bit version of the logo, sized to the printhead. A thermal printer
   * cannot take a JPEG — it takes dots. The admin does this conversion on a
   * canvas (where the threshold slider can show it live) and stores the result,
   * so the server never needs an image library.
   */
  logoRaster: z
    .object({
      width: z.number().int().min(8).max(2048),
      height: z.number().int().min(8).max(2048),
      /** base64 of packed rows, 1 = black dot, MSB first, rows padded to a byte */
      data: z.string().max(400_000),
    })
    .nullable()
    .default(null),
  blocks: z.array(blockConfigSchema).default([]),
  /** overrides the paper default when a printer runs a condensed font */
  charsPerLine: z.number().int().min(20).max(120).nullable().default(null),
  /** extra blank lines fed before the cut */
  feedLines: z.number().int().min(0).max(10).default(3),
  isDefault: z.boolean().default(false),
});
                                                                

export function charsFor(t                                                    )         {
  return t.charsPerLine ?? PAPER[t.paperWidth].chars;
}

/* -------------------------------------------------------- default templates */

const b = (
  key               ,
  extra                                    = {},
             ) => blockConfigSchema.parse({ key, ...extra });

/** The starting point for a new outlet — sensible, printable, and editable. */
export function defaultBlocks(docType              )                {
  if (docType === "kot") {
    return [
      b("docTitle", { align: "center", size: "lg", bold: true, text: "KITCHEN ORDER", rule: true }),
      b("meta", { align: "center", size: "md", bold: true, rule: true }),
      b("items", { size: "lg", bold: true }),
      b("note", { size: "md", bold: true, rule: true }),
      b("spacer"),
    ];
  }
  if (docType === "refund") {
    return [
      b("name", { align: "center", size: "lg", bold: true }),
      b("docTitle", { align: "center", size: "md", bold: true, text: "REFUND SLIP", rule: true }),
      b("meta"),
      b("customer"),
      b("items", { rule: true }),
      b("totals", { rule: true }),
      b("payment"),
      b("message", { align: "center", text: "Refund processed. Keep this slip." }),
      b("spacer"),
    ];
  }
  // receipt + bill share a shape; the bill just runs on a bigger sheet
  return [
    b("logo", { align: "center" }),
    b("name", { align: "center", size: "lg", bold: true }),
    b("address", { align: "center", size: "sm" }),
    b("contact", { align: "center", size: "sm" }),
    b("legal", { align: "center", size: "sm", rule: true }),
    b("docTitle", {
      align: "center",
      size: "md",
      bold: true,
      text: docType === "bill" ? "TAX INVOICE" : "RECEIPT",
    }),
    b("meta", { rule: true }),
    b("customer"),
    b("items", { rule: true }),
    b("totals"),
    b("taxBreakup", { size: "sm", rule: true }),
    b("payment"),
    b("note"),
    b("message", { align: "center", text: "Thank you. Please visit again!" }),
    b("qr", { align: "center" }),
    b("spacer"),
  ];
}

export function defaultTemplate(docType              , paperWidth             = "80mm")                {
  return printTemplateSchema.parse({
    id: `default-${docType}`,
    name: DOC_LABELS[docType],
    docType,
    paperWidth: docType === "bill" ? "a5" : paperWidth,
    blocks: defaultBlocks(docType),
    isDefault: true,
  });
}

/* --------------------------------------------------------------- job shape */

/** What the admin queue shows for one job. */
;                              
             
                         
                        
                    
                      
                        
                      
                         
                             
                       
                      
                           
                               
                     
                           
                 
                    
                           
 
