// T38 — AI dish pictures with Gemini: several API keys, super-admin only, what is saved (no browser, no real Google).
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t38-ai-images-api",
  title: "AI dish pictures — several Gemini keys used in turn, only the super admin can use them, and what is made is saved to the dish",
  area: "menu",
  browser: false,
  fresh: false,
  summary: "Runs suites/ai-images.mjs: its own in-memory API plus a STAND-IN for Google's server (nothing real is called or billed). Only the platform's super admin can see or add keys or make a picture — a store owner, the kitchen and someone signed out get 401/403 and Google is never called. Keys are added with a name, kept encrypted (only a masked hint comes back), refused if duplicated, and can be tested for free (a model-list call, key in a header never the address), paused, renamed and removed. A request is checked before anything is spent (shape offered, 1–4 pictures, room left on the dish: at most six). The pictures are made at the same time, each on a different key and from a different angle, asked for in the chosen shape and model, described from the dish (name, vegetarian, section) or from the text the super admin typed; each is compressed to WebP, stored in the store's own folder without a domain, and added after the dish's existing pictures. Successive single requests rotate across keys (the one used longest ago first) and paused keys are never used. A key that has used up its quota rests 10 minutes and one Google refuses rests a day — the picture is still made on another key, the next request skips the resting key, and with every key resting the answer says so and Google isn't called. A safety refusal or a words-only answer is explained and punishes no key; one picture failing keeps the others. If the newer Google interface answers 'not found' the older one is used.",
  expect: [
    "Only the super admin can manage keys or make pictures; others are refused and Google is not called.",
    "Keys are encrypted at rest, only a masked hint is shown, duplicates are refused, and a key can be tested, paused, renamed and removed.",
    "Several pictures are made at once on different keys, in the chosen shape and model, and are saved (WebP, domain-free, in the store's folder) after the dish's existing pictures.",
    "Requests rotate over the keys; a key over its quota or refused by Google is set aside and the picture is made on another key; with every key resting the answer says so.",
    "Requests that can't work (bad shape, 0 or 5 pictures, no room, another outlet's dish) are refused before anything is spent.",
  ],
  expectNot: [
    "A store owner or anyone else must NOT be able to see a key, add one or make a picture.",
    "An API key must NOT appear in any response, in a URL, or in plain text in the database.",
    "A resting or paused key must NOT be called.",
    "A refusal from Google's safety filter must NOT rest a key or save anything.",
    "A dish must NOT get more than six pictures.",
  ],
};

export const run = (d) => runSuite(d, "ai-images.mjs");
