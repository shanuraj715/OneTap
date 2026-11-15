// T11 — the owner deletes an outlet from the dashboard, then the outlet is checked on the store's subdomain. All in Chrome.
import { BENCH } from "../bench/watch.mjs";
import * as ui from "../bench/ui.mjs";
import { MENUS, OUTLETS, OWNER, SUB_URL, W, requireWorld } from "./_world.mjs";

export const meta = {
  id: "t11-outlet-delete",
  title: "Delete an outlet from the dashboard — protection for outlets with orders, then the deleted outlet on the subdomain",
  area: "domains",
  fresh: false,
  summary: "Continues from t10, in Chrome. The platform enables outlet 3 again. The owner then tries to delete outlet 2 (it has order history, so it is protected) and deletes outlet 3 (no orders). On the store's subdomain outlet 3 now says 'couldn't find that page' with no menu, the address still lists and opens outlets 1 and 2, and the plan's outlet count drops.",
  expect: [
    "An outlet that has order history cannot be deleted — the owner is told why, and the outlet keeps working on the subdomain.",
    "An outlet with no orders can be deleted by the owner from the Outlets page; the list loses it.",
    "After deletion /third on the subdomain is a real 404 'couldn't find that page' with no menu; the address root lists only outlets 1 and 2; /central and /second are unaffected.",
  ],
  expectNot: [
    "An outlet with orders must NOT be deleted (order history must never vanish).",
    "The deleted outlet must NOT still open or show its menu on the subdomain.",
    "Deleting one outlet must NOT affect the other outlets or the store's address.",
    "The browser must NOT log JavaScript errors.",
  ],
};

export async function run(d, h) {
  const who = { now: "" };
  const as = async (key, creds, label) => { await d.tab("dashboard", label); if (who.now !== key) { await ui.signIn(d, creds); who.now = key; } };
  const customer = async (url) => { await d.tab("customer", "Customer · browser"); return ui.visit(d, url); };
  await as("super", "super", "Platform console · super admin");
  await requireWorld(d);

  await d.step("The platform enables outlet 3 again (the store paid up), so the owner can manage it");
  await ui.setOutletBlocked(d, W.store, OUTLETS.third.title, false);
  const before = await customer(`${SUB_URL}/third`);
  d.check("outlet 3 opens on the subdomain before deletion, with its menu", before.status === 200 && before.text.includes("Paneer Roll"), `HTTP ${before.status}`);

  await d.step("The owner tries to delete outlet 2, which has orders");
  await as("owner", OWNER, "Store dashboard · owner of Lifecycle Foods");
  const refused = await ui.deleteOutletRow(d, "Second");
  d.never("an outlet with order history is deleted", !/order history/i.test(refused) && !/Second\s*second/.test(refused), refused.slice(-200));
  d.check("…the owner is told it has order history and can't be deleted", /order history/i.test(refused), refused.match(/[^.]*order history[^.]*\./i)?.[0]);
  await d.shot("delete-refused");
  const second = await customer(`${SUB_URL}/second`);
  d.check("outlet 2 still opens on the subdomain", second.status === 200 && second.text.includes("Margherita Pizza"), `HTTP ${second.status}`);

  await d.step("The owner deletes outlet 3 (no orders) from the dashboard");
  await as("owner", OWNER, "Store dashboard · owner of Lifecycle Foods");
  const listBefore = await ui.text(d);
  await ui.deleteOutletRow(d, "Third");
  await d.goto(`${BENCH.admin}/outlets`, 500);
  const list = await ui.text(d);
  d.check("the Outlets page no longer lists Third", /Central/.test(list) && /Second/.test(list) && !/\bThird\b/.test(list), list.match(/Outlets —[^]{0,120}/)?.[0]);
  void listBefore;
  await d.shot("outlets-after-delete");

  await d.step("Check the deleted outlet on the store's subdomain");
  const gone = await ui.until(async () => (await customer(`${SUB_URL}/third`)).status === 404);
  d.check("/third is now a 404", gone);
  const gt = await ui.text(d);
  d.check("…saying it couldn't find that page", /couldn.t find/i.test(gt), gt.slice(0, 100));
  d.never("the deleted outlet still shows its menu", MENUS.third[1].some(([n]) => gt.includes(n)));
  await d.shot("third-deleted");
  const root = await customer(`${SUB_URL}/`);
  d.check("the address still opens and lists outlets 1 and 2", root.status === 200 && root.text.includes(OUTLETS.central.title) && root.text.includes(OUTLETS.second.title), `HTTP ${root.status}`);
  d.never("the address root still lists the deleted outlet", root.text.includes(OUTLETS.third.title));
  for (const slug of ["central", "second"]) {
    const page = await customer(`${SUB_URL}/${slug}`);
    d.never(`outlet "${slug}" is affected by the deletion`, page.status !== 200 || !MENUS[slug][1].every(([n]) => page.text.includes(n)));
  }
  d.never("the browser logged JavaScript errors", d.problems.length > 0, d.problems.join(" | "));
}
