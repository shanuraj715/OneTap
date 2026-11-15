// T12 — the platform deletes the whole store, then its subdomain is checked. All in Chrome.
import * as ui from "../bench/ui.mjs";
import { BENCH, MENUS, OUTLETS, OWNER, SUB_HOST, SUB_URL, W, requireWorld } from "./_world.mjs";

export const meta = {
  id: "t12-store-delete",
  title: "Delete the store — typed-name confirmation, then the subdomain, the owner and the other stores",
  area: "domains",
  fresh: false,
  summary: "Continues from t11, in Chrome. The platform console asks for the store's exact name before it will delete (a wrong name leaves the button greyed out), then deletes the store. The store's subdomain stops working (root and every outlet say 'couldn't find a restaurant here'), the owner can no longer sign in, the address name becomes free again, and the other stores are untouched.",
  expect: [
    "The delete dialog says what will be removed and keeps its button disabled until the store's exact name is typed.",
    "After deleting, the store is gone from the Stores list.",
    "The subdomain root and every outlet path are 404 'couldn't find a restaurant here'.",
    "The owner's sign-in is refused.",
    "The subdomain name is free for another store again.",
    "Every other store keeps working (storefronts open, still listed).",
  ],
  expectNot: [
    "A wrong or partial name must NOT delete anything.",
    "The deleted store's address must NOT show any store, menu or outlet.",
    "The deleted store's owner must NOT be able to sign in.",
    "Deleting one store must NOT touch another store.",
    "The browser must NOT log JavaScript errors.",
  ],
};

export async function run(d, h) {
  const customer = async (url) => { await d.tab("customer", "Customer · browser"); return ui.visit(d, url); };
  await d.tab("dashboard", "Platform console · super admin");
  await ui.signIn(d, "super");
  await requireWorld(d);

  await d.step("A wrong confirmation name must not delete anything");
  for (const typed of ["lifecycle foods", "Lifecycle"]) {
    const r = await ui.deleteStore(d, W.store, typed);
    d.never(`the delete button works with "${typed}" typed`, r.enabled);
  }
  const stillThere = await customer(`${SUB_URL}/central`);
  d.check("the store still opens on its subdomain", stillThere.status === 200 && stillThere.text.includes(OUTLETS.central.title), `HTTP ${stillThere.status}`);
  await d.tab("dashboard", "Platform console · super admin");
  await ui.openPlatform(d, "/stores");
  d.check("…and is still listed", (await ui.text(d)).includes(W.store));

  await d.step("Delete the store with its exact name");
  const del = await ui.deleteStore(d, W.store);
  d.check("the delete button is enabled only for the exact name, and the store is deleted", del.enabled);
  await d.shot("store-deleted");
  await ui.openPlatform(d, "/stores");
  const list = await ui.text(d);
  d.never("the deleted store is still in the Stores list", list.includes(W.store));
  d.check("the other stores are still listed", ["Acme Momos", "Beta Bites", "Pro Direct Co", "Custom Kitchen"].every((n) => list.includes(n)));

  await d.step("Check the subdomain after the store is gone");
  const gone = await ui.until(async () => (await customer(`${SUB_URL}/`)).status === 404);
  d.check("the address root is a 404", gone);
  const rt = await ui.text(d);
  d.check("…saying it couldn't find a restaurant here", /couldn.t find a restaurant/i.test(rt), rt.slice(0, 100));
  d.never("the address still shows the store or its outlets", /Lifecycle/.test(rt));
  await d.shot("subdomain-after-store-delete");
  for (const slug of ["central", "second", "third"]) {
    const page = await customer(`${SUB_URL}/${slug}`);
    d.never(`/${slug} still opens on the deleted store's address`, page.status === 200 || Object.values(MENUS).some(([, items]) => items.some(([n]) => page.text.includes(n))), `HTTP ${page.status}`);
  }

  await d.step("The owner and the address name");
  await d.tab("dashboard", "Store dashboard · the deleted store's owner");
  const stuck = await ui.signInFails(d, W.ownerEmail, W.ownerPassword);
  d.never("the deleted store's owner can still sign in", !stuck);
  await ui.signIn(d, "super");
  const free = await ui.tryAddressName(d, "Pro Direct Co", W.label);
  d.check(`"${W.label}" is available for another store again (${SUB_HOST} is free)`, new RegExp(`${W.label}\\.localhost:3170 is free`).test(free), free.match(/localhost:3170[^]{0,30}/)?.[0]);

  await d.step("Every other store is untouched");
  for (const [label, url, needle] of [["Acme Momos", `${BENCH.storefront}/main`, "Acme Momos"], ["Beta Bites", `${BENCH.betaStorefront}/only`, "Beta Bites"], ["Pro Direct Co", "http://prodirect.localhost:3170/central", "Central"]]) {
    const r = await customer(url);
    d.check(`${label} still opens`, r.status === 200 && r.text.includes(needle), `HTTP ${r.status}`);
  }
  d.never("the browser logged JavaScript errors", d.problems.length > 0, d.problems.join(" | "));
}
