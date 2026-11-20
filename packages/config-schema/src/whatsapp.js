import { z } from "zod";

/**
 * WhatsApp chat from the store dashboard, over the store's OWN linked WhatsApp numbers (scanned in like
 * WhatsApp Web — no paid API). Personal numbers get banned for spam-like behaviour, so everything that goes to a
 * number which has never written to the store ("cold") is paced hard; replies in a running conversation go at
 * a human pace.
 */

/* ------------------------------------------------------------------ pacing */

export const WA_PACING = {
  /** a number that has never written to the store: a manual first message, or a broadcast */
  cold: { minGapSec: 120, maxGapSec: 240, perDay: 15, quietFrom: 22, quietTo: 9 },
  /** order updates to someone who ordered but never chatted: expected by them, so their own (smaller) budget and no quiet hours */
  order: { minGapSec: 30, maxGapSec: 60, perDay: 40 },
  /**
   * a verification code (sign-up / sign-in): nobody can wait hours for one, so it skips the first-contact spacing,
   * the quiet hours and the daily first-contact budget — but it has its own per-day cap so a stranger hammering the
   * sign-in form can't turn the store's number into a spam cannon
   */
  code: { perDay: 300, typingMinMs: 300, typingMaxMs: 700 },
  /** a conversation that is already going: a short "typing…" pause before each message */
  warm: { typingMinMs: 1000, typingMaxMs: 3000, minGapMs: 1200 },
  /** India — quiet hours and "today" are counted in this time zone */
  timeZoneOffsetMinutes: 330,
};

/** How long after our own last message a manual follow-up to a not-yet-replied number still counts as the same conversation. */
export const WA_FOLLOW_UP_HOURS = 24;

export const WA_MAX_MEDIA_BYTES = 16 * 1024 * 1024;
export const WA_MEDIA_ACCEPT = "image/*,video/*,audio/*,application/pdf,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt";

/* ---------------------------------------------------------------- opt-out */

export const WA_OPT_OUT_FOOTER = "Reply STOP to stop offers.";
const OPT_OUT = ["stop", "stop offers", "unsubscribe", "stop all"];
const OPT_IN = ["start", "subscribe", "resume"];
export const isOptOutText = (t) => OPT_OUT.includes(String(t ?? "").trim().toLowerCase());
export const isOptInText = (t) => OPT_IN.includes(String(t ?? "").trim().toLowerCase());

/* ----------------------------------------------------------------- phones */

/**
 * A WhatsApp number as digits with the country code, no "+". A bare 10-digit number is taken as Indian.
 * Returns "" when it can't be a phone number.
 */
export function normalizeWaPhone(raw, defaultCountry = "91") {
  let d = String(raw ?? "").replace(/[^\d]/g, "");
  if (String(raw ?? "").trim().startsWith("00")) d = d.slice(2);
  d = d.replace(/^0+/, "");
  if (d.length === 10) d = defaultCountry + d;
  return d.length >= 11 && d.length <= 15 ? d : "";
}

/** "919876543210" → "+91 98765 43210" (Indian numbers), else "+<digits>". */
export function formatWaPhone(digits) {
  const d = String(digits ?? "");
  if (d.length === 12 && d.startsWith("91")) return `+91 ${d.slice(2, 7)} ${d.slice(7)}`;
  return d ? `+${d}` : "";
}

/* ----------------------------------------------------------------- access */

/** What a role can do with the store's WhatsApp chats. The owner always has "manage"; the platform super admin "read". */
export const WA_ACCESS_LEVELS = ["none", "read", "send"];
export const WA_ACCESS_LABELS = { none: "No access", read: "Read chats", send: "Read and reply", manage: "Everything" };
/** the roles an owner can give access to */
export const WA_DELEGABLE_ROLES = ["manager", "staff", "kitchen", "editor", "accountant"];
const levelRank = { none: 0, read: 1, send: 2, manage: 3 };
export const waLevelAtLeast = (level, needed) => (levelRank[level] ?? 0) >= (levelRank[needed] ?? 99);

export const waAccessSchema = z.object(Object.fromEntries(WA_DELEGABLE_ROLES.map((r) => [r, z.enum(WA_ACCESS_LEVELS).default("none")])));

/* -------------------------------------------------------------- messages */

export const WA_MESSAGE_TYPES = ["text", "image", "video", "audio", "document", "sticker", "other"];
export const WA_MESSAGE_STATUSES = ["queued", "sending", "sent", "delivered", "read", "failed", "received"];
export const WA_MESSAGE_SOURCES = ["chat", "order", "broadcast", "phone", "code"];

export const waMediaSchema = z.object({
  // our own uploads are kept without a domain ("/uploads/<key>"); anything else must be a full web address
  url: z.string().max(1000).refine((v) => v.startsWith("/uploads/") || z.string().url().safeParse(v).success, "Not a valid address"),
  key: z.string().max(300).default(""),
  mime: z.string().max(120),
  fileName: z.string().max(200).default(""),
  size: z.number().int().nonnegative().max(WA_MAX_MEDIA_BYTES).default(0),
});

export const waSendSchema = z
  .object({
    text: z.string().max(4000).default(""),
    media: waMediaSchema.nullable().default(null),
    /** send from this linked number instead of the chat's own (it then becomes the chat's number) */
    accountId: z.string().max(40).optional(),
  })
  .refine((m) => m.text.trim() || m.media, { message: "Write a message or attach a file" });

export const waBroadcastSchema = z
  .object({
    text: z.string().trim().min(1, "Write the message").max(3000),
    media: waMediaSchema.nullable().default(null),
  });

export const waMediaTypeOf = (mime) =>
  mime?.startsWith("image/") ? "image" : mime?.startsWith("video/") ? "video" : mime?.startsWith("audio/") ? "audio" : "document";

/* ------------------------------------------------------------ order updates */

/** Default text for an order update sent from a linked number. Free text — no Meta template needed. */
export const WA_ORDER_DEFAULT_BODY = "Hi {{customerName}}, your order #{{orderNumber}} at {{outletName}} is {{statusLabel}}. Total {{amount}}.";

/* -------------------------------------------------------------- time math */

/** Minutes past local midnight, and the local day ("2026-11-15"), for the pacing time zone. */
export function waLocalClock(date = new Date()) {
  const local = new Date(date.getTime() + WA_PACING.timeZoneOffsetMinutes * 60000);
  return { day: local.toISOString().slice(0, 10), minutes: local.getUTCHours() * 60 + local.getUTCMinutes() };
}

/** When a cold message may go out given quiet hours: `now` if outside them, else the next quietTo (+ a few random minutes). */
export function waAfterQuietHours(now = new Date(), jitter = Math.random()) {
  const { quietFrom, quietTo } = WA_PACING.cold;
  const { minutes } = waLocalClock(now);
  const inQuiet = minutes >= quietFrom * 60 || minutes < quietTo * 60;
  if (!inQuiet) return now;
  const untilOpen = minutes >= quietFrom * 60 ? 24 * 60 - minutes + quietTo * 60 : quietTo * 60 - minutes;
  return new Date(now.getTime() + (untilOpen + Math.round(jitter * 12)) * 60000);
}

/** The start of the next local day (for "today's cap is used up"). */
export function waNextLocalDay(now = new Date(), jitter = Math.random()) {
  const { minutes } = waLocalClock(now);
  const toMidnight = 24 * 60 - minutes;
  return waAfterQuietHours(new Date(now.getTime() + (toMidnight + 1) * 60000), jitter);
}

/* ---------------------------------------------------------------- colours */

/** Colours a linked number can wear (its chip in the chat list is filled with it). New numbers take the next unused one. */
export const WA_NUMBER_COLORS = ["#2E7D32", "#1565C0", "#C62828", "#6A1B9A", "#EF6C00", "#00838F", "#AD1457", "#4E342E", "#455A64", "#9E9D24"];
export const waColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Pick a colour");

/** Black or white — whichever reads better on `hex` (WCAG relative luminance). */
export function waTextOn(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex ?? ""));
  if (!m) return "#ffffff";
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return (1.05 / (lum + 0.05)) >= ((lum + 0.05) / 0.05) ? "#ffffff" : "#111111";
}

/* ---------------------------------------------------------------- deleting */

/** How long after sending a message can still be deleted for everyone (WhatsApp allows a little longer; this stays safely inside it). */
export const WA_REVOKE_HOURS = 48;

/* ------------------------------------------------------------- distribution */

/**
 * Spread chats evenly over the `share` numbers, also taking every chat off the `giveAway` numbers.
 * `chats` are { id, accountId, lastInboundAt, lastMessageAt }. Chats on other numbers are left alone; chats on no
 * number join in. Each sharing number ends with total/n (±1). Who moves first: people who never wrote to us, then
 * the ones quiet the longest — an active conversation stays where it is when it can. Returns [{ chatId, from, to }].
 *   balance 4 numbers:          share = [1, 2, 3, 4]
 *   empty 1 and 2 into 3 and 4: share = [3, 4], giveAway = [1, 2]
 */
export function planWaDistribution(chats, share, giveAway = []) {
  const ids = [...new Set(share.map(String))];
  const givers = [...new Set(giveAway.map(String))].filter((id) => !ids.includes(id));
  if (!ids.length || (ids.length < 2 && !givers.length)) return [];
  const pool = chats.filter((c) => !c.accountId || ids.includes(String(c.accountId)) || givers.includes(String(c.accountId)));
  const total = pool.length;
  const base = Math.floor(total / ids.length);
  const extra = total % ids.length;
  const byAccount = new Map(ids.map((id) => [id, []]));
  const unassigned = [];
  for (const c of pool) (c.accountId && byAccount.has(String(c.accountId)) ? byAccount.get(String(c.accountId)) : unassigned).push(c);
  // the numbers that already hold the most keep the "+1" slots, so as few chats as possible move
  const order = [...ids].sort((a, b) => byAccount.get(b).length - byAccount.get(a).length);
  const target = new Map(order.map((id, i) => [id, base + (i < extra ? 1 : 0)]));
  const movable = (c) => [c.lastInboundAt ? 1 : 0, c.lastMessageAt ? new Date(c.lastMessageAt).getTime() : 0];
  const byMoveFirst = (a, b) => { const [ra, ta] = movable(a); const [rb, tb] = movable(b); return ra - rb || ta - tb; };
  const spare = [...unassigned];
  for (const id of order) {
    const list = byAccount.get(id).sort(byMoveFirst);
    while (list.length > target.get(id)) spare.push(list.shift());
  }
  spare.sort(byMoveFirst);
  const moves = [];
  for (const id of order) {
    let have = byAccount.get(id).length;
    while (have < target.get(id) && spare.length) {
      const c = spare.shift();
      if (String(c.accountId ?? "") !== id) moves.push({ chatId: String(c.id), from: c.accountId ? String(c.accountId) : null, to: id });
      have++;
    }
  }
  return moves;
}
