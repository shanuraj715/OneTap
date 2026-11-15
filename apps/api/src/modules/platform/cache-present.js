/**
 * Turns a cached value into something safe and sensible to show in the console.
 *
 * - Anything that looks like a secret (a password, token, key, credential …) is hidden — the viewer is for
 *   seeing what is remembered, never for reading secrets back out.
 * - Dates and ids become plain text, binary data becomes a note.
 * - Very long lists, long texts and deep nesting are cut short, so one huge menu can't freeze the browser or
 *   make a huge response. When that happens the caller is told (`trimmed`).
 *
 * Pure: no cache, no database — easy to test on its own.
 */

export const HIDDEN = "••• hidden";

const SECRET_WORDS = /pass(word|wd)|secret|token|api[-_]?key|private[-_]?key|credential|authorization|cookie|encrypted|signature/i;
// "otp" as a word of its own (otp, otpCode, customerOtp, customer_otp) — case matters here, so "hotpot" and "footprint" are left alone
const OTP_WORD = /(^|[^a-zA-Z])(otp|OTP)([^a-z]|$)|[a-z]Otp([^a-z]|$)/;

/** A field NAME that suggests the value is a secret. */
export const SECRET_KEY = { test: (name) => SECRET_WORDS.test(name) || OTP_WORD.test(name) };

/** How much to show, from "almost everything" down: each step is tried only when the one before is still too big to send. */
const TIERS = [
  { string: 4000, items: 1000, keys: 400, depth: 18 },
  { string: 800, items: 150, keys: 150, depth: 14 },
  { string: 300, items: 30, keys: 80, depth: 10 },
];
/** About the most characters worth sending to a browser to draw. */
export const MAX_SHOWN_CHARS = 1_500_000;

function convert(root, limits) {
  const state = { hidden: 0, trimmed: false };
  const seen = new WeakSet();

  const walk = (v, depth) => {
    if (v === null || v === undefined) return null;
    switch (typeof v) {
      case "string":
        if (v.length > limits.string) {
          state.trimmed = true;
          return `${v.slice(0, limits.string)}… (${v.length - limits.string} more characters)`;
        }
        return v;
      case "number":
        return Number.isFinite(v) ? v : String(v);
      case "boolean":
        return v;
      case "bigint":
        return String(v);
      case "function":
      case "symbol":
        return undefined;
    }
    if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString();
    if (v._bsontype === "ObjectId" || (typeof v.toHexString === "function" && v.constructor?.name === "ObjectId")) return String(v);
    if (typeof Buffer !== "undefined" && (Buffer.isBuffer(v) || v instanceof Uint8Array)) return `<binary data, ${v.length} bytes>`;
    if (seen.has(v)) return "[repeated reference]";
    if (depth >= limits.depth) {
      state.trimmed = true;
      return "… (nested too deeply to show)";
    }
    seen.add(v);
    try {
      if (v instanceof Set) return walk([...v], depth);
      if (v instanceof Map) return walk(Object.fromEntries(v), depth);
      if (Array.isArray(v)) {
        const out = v.slice(0, limits.items).map((x) => walk(x, depth + 1) ?? null);
        if (v.length > limits.items) {
          state.trimmed = true;
          out.push(`… ${v.length - limits.items} more ${v.length - limits.items === 1 ? "item" : "items"} not shown`);
        }
        return out;
      }
      const out = {};
      const keys = Object.keys(v);
      let shown = 0;
      for (const k of keys) {
        if (shown >= limits.keys) {
          state.trimmed = true;
          out["…"] = `${keys.length - limits.keys} more fields not shown`;
          break;
        }
        shown++;
        if (SECRET_KEY.test(k)) {
          out[k] = HIDDEN;
          state.hidden++;
          continue;
        }
        const w = walk(v[k], depth + 1);
        if (w !== undefined) out[k] = w;
      }
      return out;
    } finally {
      seen.delete(v); // a value may legitimately appear twice (siblings); only a loop back to an ancestor is a cycle
    }
  };

  return { value: walk(root, 0), hidden: state.hidden, trimmed: state.trimmed };
}

/**
 * @returns {{ value: any, hidden: number, trimmed: boolean, chars: number }}
 *   `hidden`  how many secret-looking fields were replaced
 *   `trimmed` true when something was cut short to keep the answer small
 *   `chars`   how long the result is as JSON text
 */
export function presentValue(root) {
  for (let i = 0; i < TIERS.length; i++) {
    const result = convert(root, TIERS[i]);
    const text = JSON.stringify(result.value) ?? "null";
    if (text.length <= MAX_SHOWN_CHARS) return { ...result, trimmed: result.trimmed || i > 0, chars: text.length };
  }
  return { value: "… (too large to show here)", hidden: 0, trimmed: true, chars: 30 };
}
