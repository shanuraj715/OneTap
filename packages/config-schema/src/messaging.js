import { z } from "zod";

/**
 * "Message sending": which of the store's ways of sending a message each KIND of message goes out on.
 *
 * A store can have up to three ways to send:
 *   linked    its own WhatsApp number(s), scanned in like WhatsApp Web (plan feature "WhatsApp chat")
 *   whatsapp  WhatsApp Business through Meta's Cloud API — template messages only (plan feature "WhatsApp & SMS alerts")
 *   sms       its own SMS gateway (plan feature "WhatsApp & SMS alerts")
 *
 * Today one kind of message is mapped here — the verification code a customer types to sign up or sign in (and
 * the code staff ask for before spending a customer's coins). Order updates and marketing already pick their own
 * channel where they are set up, so they are not repeated here.
 *
 * Kept in one place so the API (which validates and sends) and the dashboard (which shows and edits) agree.
 */

/** the three ways a message can leave the store */
export const MESSAGE_METHODS = ["linked", "whatsapp", "sms"];

/** what a code can be mapped to — "screen" is no sending at all: the code is shown on the sign-in screen (testing only) */
export const CODE_METHODS = ["screen", ...MESSAGE_METHODS];

export const MESSAGE_METHOD_LABELS = {
  linked: "Your linked WhatsApp number",
  whatsapp: "WhatsApp Business (Meta)",
  sms: "SMS",
  screen: "Don't send (show the code on screen)",
};

/** the plan feature each method needs (the dashboard greys a method out, and the API refuses it, without it) */
export const MESSAGE_METHOD_FEATURE = {
  linked: "whatsappChat",
  whatsapp: "notifications",
  sms: "notifications",
};

/**
 * The words that can go inside a code message as {{name}} — one list for the API (fills them in, refuses a misspelt one)
 * and the dashboard (the "Variables" pop-up, the preview). `example` is what the preview and the pop-up show.
 * The code message may run over several lines; the line breaks are sent as they are typed.
 */
export const CODE_MESSAGE_VARIABLES = [
  { key: "code", label: "Verification code", description: "The 6-digit code the customer types. The message must contain it.", example: "482915", required: true },
  { key: "store", label: "Store name", description: "Your store's name.", example: "Acme Momos" },
  { key: "outlet", label: "Outlet name", description: "The outlet the customer is ordering from.", example: "Main Street" },
  { key: "name", label: "Customer's first name", description: "From their account or what they typed on the sign-in form. Says “there” when we don't know it yet, so “Hi {{name}}” always reads well.", example: "Asha" },
  { key: "phone", label: "Customer's mobile number", description: "The number the code is being sent to.", example: "98765 43210" },
  { key: "minutes", label: "Minutes the code stays valid", description: "How long the customer has to type it.", example: "10" },
  { key: "date", label: "Today's date", description: "In Indian time.", example: "19 Nov 2026" },
  { key: "time", label: "Time now", description: "In Indian time.", example: "4:35 pm" },
  { key: "store_phone", label: "Store's phone number", description: "The phone number in the outlet's settings (empty if none is set).", example: "+91 98765 43210" },
];
export const CODE_MESSAGE_VARIABLE_KEYS = CODE_MESSAGE_VARIABLES.map((v) => v.key);

/** a {{variable}} in a message — spaces inside the braces are fine: {{ code }} */
const VARIABLE_PATTERN = /\{\{\s*([A-Za-z_]+)\s*\}\}/g;

/** every variable a message uses, lower-cased, in order */
export const variablesIn = (text) => [...String(text ?? "").matchAll(VARIABLE_PATTERN)].map((m) => m[1].toLowerCase());

/** the words sent with a code over linked WhatsApp when the store hasn't written its own */
export const DEFAULT_WA_CODE_TEMPLATE = "{{code}} is your {{store}} verification code. It is valid for {{minutes}} minutes — please don't share it with anyone.";

/** what the store's WhatsApp inbox shows in place of a code once it has gone out (a code is never kept in the chat history) */
export const WA_CODE_REDACTED = "🔒 Verification code";

export const whatsappCodeTemplateSchema = z.object({
  /** the name of the approved Meta template; its first {{1}} is filled with the code */
  name: z.string().trim().max(120).default(""),
  language: z.string().trim().min(2).max(10).default("en"),
  /** an "Authentication" template made with a Copy code button needs the code again in that button */
  copyButton: z.boolean().default(false),
});

export const codeMappingSchema = z
  .object({
    method: z.enum(CODE_METHODS),
    /** free text sent over linked WhatsApp, as many lines as the store likes; empty = DEFAULT_WA_CODE_TEMPLATE. Must contain {{code}} */
    linkedMessage: z.string().max(1000).default(""),
    whatsappTemplate: whatsappCodeTemplateSchema.default({}),
  })
  .superRefine((v, ctx) => {
    const used = variablesIn(v.linkedMessage);
    if (v.linkedMessage.trim() && !used.includes("code")) {
      ctx.addIssue({ code: "custom", path: ["linkedMessage"], message: "The message must contain {{code}} — that is where the code goes." });
    }
    const unknown = [...new Set(used.filter((k) => !CODE_MESSAGE_VARIABLE_KEYS.includes(k)))];
    if (unknown.length) {
      ctx.addIssue({ code: "custom", path: ["linkedMessage"], message: `${unknown.map((k) => `{{${k}}}`).join(", ")} ${unknown.length === 1 ? "isn't a variable" : "aren't variables"} — pick from the Variables list (or check the spelling).` });
    }
    if (v.method === "whatsapp" && !v.whatsappTemplate.name) {
      ctx.addIssue({ code: "custom", path: ["whatsappTemplate", "name"], message: "Enter the name of your approved WhatsApp template." });
    }
  });

export const messagingSchema = z.object({ codes: codeMappingSchema });

/**
 * Fill the variables of a code message. `values` maps a variable's key to its text. Variables nobody has a value for
 * are left as they are (so a typo is visible, not silently blank); `fallback` is used when the template is empty.
 */
export const renderCodeMessage = (template, values, fallback = DEFAULT_WA_CODE_TEMPLATE) =>
  String(template?.trim() ? template : fallback).replace(VARIABLE_PATTERN, (whole, key) => {
    const v = values?.[String(key).toLowerCase()];
    return v === undefined || v === null ? whole : String(v);
  });

/** what the dashboard preview fills in: the examples, with the store's real names where they are known */
export const sampleCodeValues = (overrides = {}) => ({
  ...Object.fromEntries(CODE_MESSAGE_VARIABLES.map((v) => [v.key, v.example])),
  ...Object.fromEntries(Object.entries(overrides).filter(([, v]) => v)),
});
