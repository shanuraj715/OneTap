// T09 — the store's own TablePe address (lifecycle.<base>), all in Chrome: remove it, try names, create it, open every outlet on it, rename.
import { BENCH } from "../bench/watch.mjs";
import * as ui from "../bench/ui.mjs";
import { MENUS, OUTLETS, OWNER, SUB_HOST, SUB_URL, W, requireWorld } from "./_world.mjs";

export const meta = {
  id: "t09-store-subdomain",
  title: "Store subdomain — remove, create lifecycle.<base>, open every outlet on it, unknown addresses, rename",
  area: "domains",
  fresh: false,
  summary: "Continues from t08, in Chrome. The platform removes the store's TablePe address (the customer then gets 'couldn't find a restaurant here'), tries names in the Domains tab (reserved, too short, bad characters, taken by another store, free), creates the address, and a customer's browser then opens the store's root and each outlet on it — each showing its own details and menu. A made-up outlet, a made-up subdomain and another store's outlet are all 'not found'. Renaming the address moves the store and the old address stops working.",
  expect: [
    "With no TablePe address the store can't be opened on lifecycle.<base> ('We couldn't find a restaurant here').",
    "A free name shows 'is free'; reserved names (www, admin…), names under 3 characters, bad characters and names used by another store show a reason.",
    "After 'Create address', the root page and /central, /second and /third open; each outlet shows its own name and menu.",
    "Renaming makes the new address work and the old one stop working; renaming back restores it.",
  ],
  expectNot: [
    "A reserved, malformed or already-used name must NOT be offered as free.",
    "An outlet that doesn't exist on the subdomain must NOT show a menu (it is a 'not found' page).",
    "A subdomain nobody owns must NOT render any store.",
    "Another store's outlet (Beta's /only) must NOT open on this store's address.",
    "One outlet's page must NOT show another outlet's menu items.",
    "The browser must NOT log JavaScript errors.",
  ],
};

export async function run(d, h) {
  await d.tab("dashboard", "Platform console · super admin");
  await ui.signIn(d, "super");
  await requireWorld(d);
  const allItems = Object.values(MENUS).flatMap(([, items]) => items.map((i) => i[0]));
  const customer = async (url) => { await d.tab("customer", "Customer · browser"); return ui.visit(d, url); };
  const platform = async () => { await d.tab("dashboard", "Platform console · super admin"); };

  await d.step("Before: the store has an address — then the platform removes it");
  const before = await customer(`${SUB_URL}/central`);
  d.check("the store opens on its address", before.status === 200 && before.text.includes(OUTLETS.central.title), `HTTP ${before.status}`);
  await platform();
  await ui.removeAddress(d, W.store);
  const gone = await customer(`${SUB_URL}/central`);
  d.never("the store still opens after its address was removed", gone.status === 200 && gone.text.includes(OUTLETS.central.title), `HTTP ${gone.status}`);
  d.check("…the customer sees 'We couldn't find a restaurant here'", gone.status === 404 && /couldn.t find a restaurant here/i.test(gone.text), gone.text.slice(0, 100));
  await d.shot("no-address");

  await d.step("In the Domains tab: which names may the store have?");
  await platform();
  const rules = [["www", /kept for TablePe/i, "a reserved name"], ["admin", /kept for TablePe/i, "a reserved name"], ["ab", /at least 3 characters/i, "too short"], ["Bad_Name", /lowercase letters, numbers and hyphens/i, "bad characters"], ["beta", /already used by another store/i, "used by another store"]];
  for (const [name, rx, why] of rules) {
    const page = await ui.tryAddressName(d, W.store, name);
    d.never(`"${name}" (${why}) is offered as free`, /is free/.test(page));
    d.check(`…and the form says why for "${name}"`, rx.test(page), page.match(rx)?.[0]);
  }
  const free = await ui.tryAddressName(d, W.store, W.label);
  d.check(`"${W.label}" shows as free: ${SUB_HOST} is free`, new RegExp(`${W.label}\\.localhost:3170 is free`).test(free));
  await d.shot("domains-names");

  await d.step("Create the address, then a customer opens the store on it");
  const made = await ui.setAddress(d, W.store, W.label);
  d.check(`the platform creates ${SUB_HOST}`, !made.disabled && made.text.includes(SUB_HOST), made.text.match(/localhost:3170[^]{0,40}/)?.[0]);
  const root = await customer(`${SUB_URL}/`);
  d.check("the address itself opens and lists every outlet to choose from", root.status === 200 && Object.values(OUTLETS).every((o) => root.text.includes(o.title)), `HTTP ${root.status}`);
  await d.shot("root");
  for (const [slug, o] of Object.entries(OUTLETS)) {
    const page = await customer(`${SUB_URL}/${slug}`);
    const mine = MENUS[slug][1].map((i) => i[0]);
    d.check(`/${slug} opens and shows ${o.title}`, page.status === 200 && page.text.includes(o.title), `HTTP ${page.status}`);
    d.check(`/${slug} shows its own menu (${mine.join(", ")})`, mine.every((n) => page.text.includes(n)));
    d.never(`/${slug} shows another outlet's menu items`, allItems.filter((n) => !mine.includes(n)).some((n) => page.text.includes(n)), allItems.filter((n) => !mine.includes(n) && page.text.includes(n)).join(", "));
  }
  const ghost = await customer(`${SUB_URL}/no-such-outlet`);
  d.never("an outlet that doesn't exist shows a menu", ghost.status !== 404 || allItems.some((n) => ghost.text.includes(n)), `HTTP ${ghost.status}`);
  d.check("…it says it couldn't find that page", /couldn.t find|not found/i.test(ghost.text), ghost.text.slice(0, 100));
  const beta = await customer(`${SUB_URL}/only`);
  d.never("another store's outlet (Beta's /only) opens on this store's address", beta.status === 200 && /Beta Bites/.test(beta.text), `HTTP ${beta.status}`);
  const nobody = await customer(`http://nobody-here.localhost:3170/`);
  d.never("a subdomain nobody owns shows a store", nobody.status !== 404 || /Lifecycle|Acme|Beta/.test(nobody.text), `HTTP ${nobody.status}`);
  d.check("…it says it couldn't find a restaurant there", /couldn.t find a restaurant/i.test(nobody.text));

  await d.step("Rename the address: the new one works, the old one stops");
  await platform();
  const NEW = "lifecycle-two";
  const ren = await ui.setAddress(d, W.store, NEW);
  d.check(`renamed to ${NEW}`, !ren.disabled && ren.text.includes(`${NEW}.localhost:3170`));
  const nu = await customer(`http://${NEW}.localhost:3170/central`);
  d.check("the new address opens the outlet", nu.status === 200 && nu.text.includes(OUTLETS.central.title), `HTTP ${nu.status}`);
  const old = await customer(`${SUB_URL}/central`);
  d.never("the old address still opens the store", old.status === 200 && old.text.includes(OUTLETS.central.title), `HTTP ${old.status}`);
  await platform();
  const back = await ui.setAddress(d, W.store, W.label);
  d.check(`set back to ${SUB_HOST} for the next tests`, !back.disabled && back.text.includes(SUB_HOST));
  const again = await customer(`${SUB_URL}/central`);
  d.check("…and it opens again", again.status === 200 && again.text.includes(OUTLETS.central.title));
  d.never("the browser logged JavaScript errors", d.problems.length > 0, d.problems.join(" | "));
}
