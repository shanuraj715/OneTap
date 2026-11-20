/**
 * AI picture generation (Gemini). Shared by the server (which builds the request) and the dashboard (which shows
 * the choices and the default description), so what the super admin sees is what is sent.
 */

/**
 * The Gemini models that make pictures ("Nano Banana"). Names as they appear in Google's image generation guide;
 * a different id can be typed in the console if Google adds a newer one.
 */
export const AI_IMAGE_MODELS = [
  { id: "gemini-nano-banana-2.1", label: "Nano Banana 2.1", note: "Google's recommended model for new projects" },
  { id: "gemini-3.1-flash-lite-image", label: "Nano Banana 2 Lite", note: "the fastest and cheapest" },
  { id: "gemini-3.1-flash-image", label: "Nano Banana 2", note: "the previous generation" },
  { id: "gemini-3-pro-image", label: "Nano Banana Pro", note: "best quality, for complex pictures" },
  { id: "gemini-2.5-flash-image", label: "Nano Banana (legacy)", note: "older — Google suggests moving off it" },
];
export const DEFAULT_AI_IMAGE_MODEL = "gemini-nano-banana-2.1";

/** The shapes offered when making a dish picture, with where each one suits the storefront's cards. */
export const AI_ASPECT_RATIOS = [
  { id: "1:1", label: "Square", use: "list photos and round cards" },
  { id: "4:3", label: "Standard", use: "most menu cards" },
  { id: "3:2", label: "Photo", use: "wide menu cards" },
  { id: "16:9", label: "Wide", use: "banners and big cards" },
  { id: "3:4", label: "Tall", use: "tall cards" },
];
export const AI_ASPECT_RATIO_IDS = AI_ASPECT_RATIOS.map((r) => r.id);

/** At most this many pictures per request (each one is a separate, paid call to Google). */
export const AI_MAX_IMAGES_AT_ONCE = 4;
export const AI_MAX_PROMPT_LENGTH = 1200;

/** When several pictures are made, each is asked for from a different angle so they are not near-copies. */
const ANGLES = [
  "Shot from a 45-degree angle, close up.",
  "Shot from directly above, as a flat lay.",
  "A close side view, with a little steam rising.",
  "A wider shot with the dish on a table and a softly blurred background.",
];

const KINDS = { veg: "a vegetarian dish", "non-veg": "a non-vegetarian dish", egg: "a dish made with egg" };

/** The default description of a dish's picture, from what the menu already says about it. The super admin can edit it. */
export function buildItemImagePrompt({ name, description = "", foodType = "veg", category = "" }) {
  const dish = String(name ?? "").trim() || "a dish";
  const about = String(description ?? "").trim();
  return (
    `A professional restaurant menu photograph of ${dish}` +
    `${about ? ` (${about.replace(/[.\s]+$/, "")})` : ""}. ` +
    `${KINDS[foodType] ? `It is ${KINDS[foodType]}` : "It is a dish"}${category ? `, from the "${category}" section of the menu` : ""}. ` +
    `Freshly cooked and plated the way a good restaurant would serve it, in suitable tableware on a clean surface, ` +
    `appetising natural colours, soft natural light, sharp focus on the food, shallow depth of field. ` +
    `No people, no hands, no text, no logos, no watermarks, no menu boards.`
  );
}

/** The angle sentence for picture number `index` of a batch (0-based); "" when only one picture is made. */
export function angleFor(index, total) {
  return total > 1 ? ANGLES[index % ANGLES.length] : "";
}
