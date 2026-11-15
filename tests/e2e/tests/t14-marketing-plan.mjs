// T14 — Marketing is a plan feature: a Basic-style plan doesn't have it, a Pro-style plan does, and the platform can unlock or
// lock it for one store. All in Chrome: the platform console, then the store owner's dashboard.
import * as ui from "../bench/ui.mjs";
import { BENCH } from "../bench/watch.mjs";

export const meta = {
  id: "t14-marketing-plan",
  title: "Marketing is a plan feature — Basic doesn't have it, Pro does, and it can be unlocked or locked for one store",
  area: "plans",
  fresh: true,
  summary: "In Chrome: the platform creates a plan without Marketing and a plan with it, and a store on the first. The owner finds no Marketing in the sidebar and, opening its address directly, a 'Marketing isn't in your plan' page with no forms. The platform then unlocks Marketing for that one store (Features tab) and the owner gets the real Marketing screen; it is set back to the plan, the store moves to the plan that has it (still works), and finally Marketing is locked for the store even though its plan has it (the lock wins) and the owner loses it again.",
  expect: [
    "The plan form has a 'Marketing' switch; a plan without it shows no Marketing to its stores.",
    "On a plan without Marketing the owner's sidebar has no Marketing entry, and opening /marketing/new says 'Marketing isn't in your plan' — no channel cards, no 'Review and send'.",
    "Unlocking Marketing for that one store (platform → store → Features) gives the owner the Marketing item and the working screen, without changing the plan.",
    "Moving the store to a plan that includes Marketing gives it Marketing.",
    "Locking Marketing for the store overrides its plan: the owner loses it again; setting it back to 'From plan' restores it.",
  ],
  expectNot: [
    "A store whose plan lacks Marketing must NOT see the Marketing menu item or the sending screens.",
    "An unlock for one store must NOT give Marketing to other stores on the same plan.",
    "A lock for one store must NOT remove Marketing from other stores on the Pro plan.",
    "The browser must NOT log JavaScript errors.",
  ],
};

const OWNER = ["owner@mktco.test", "Owner123!"];
const OTHER = ["owner@mktother.test", "Owner123!"];

export async function run(d, h) {
  await d.tab("dashboard", "Platform console · super admin");
  await ui.signIn(d, "super");

  await d.step("Platform console → Plans: one plan without Marketing, one with it");
  await ui.createPlan(d, { name: "Mkt Basic", description: "Takeaway only", people: 3, multiOutlet: false, features: ["Takeaway ordering", "Coupons"] });
  await ui.createPlan(d, { name: "Mkt Pro", description: "Takeaway and Marketing", people: 10, multiOutlet: false, features: ["Takeaway ordering", "Coupons", "Marketing"] });
  await ui.openPlatform(d, "/plans");
  const plans = await ui.text(d);
  d.check("both plans are listed", plans.includes("Mkt Basic") && plans.includes("Mkt Pro"));
  await d.click(d.page.locator("section").filter({ has: d.page.getByText("Mkt Pro", { exact: true }) }).getByRole("button", { name: "Edit" }).first(), { after: 700 });
  d.check("the plan form has a 'Marketing' switch, ticked for the Pro-style plan", await d.page.getByRole("checkbox", { name: /^\s*Marketing/ }).first().isChecked().catch(() => false));
  await d.press("Escape", 300);
  await d.shot("plan-form");

  await d.step("Two stores on the plan WITHOUT Marketing");
  await ui.createStore(d, { name: "Mkt Co", slug: "mktco", plan: "Mkt Basic", address: "mktco", ownerEmail: OWNER[0], ownerPassword: OWNER[1] });
  await ui.createStore(d, { name: "Mkt Other", slug: "mktother", plan: "Mkt Basic", address: "mktother", ownerEmail: OTHER[0], ownerPassword: OTHER[1] });
  d.check("both stores exist", /Mkt Co/.test(await ui.text(d)) && /Mkt Other/.test(await ui.text(d)));

  const sidebarHasMarketing = async () => (await ui.sidebarGroups(d)).some((g) => g.items.includes("Marketing"));
  const asOwner = async (creds, label) => { await d.tab("dashboard", label); await ui.signIn(d, creds); };

  await d.step("The owner of the Basic-style store: no Marketing");
  await asOwner(OWNER, "Store dashboard · owner of Mkt Co");
  d.never("Marketing is in the sidebar of a store whose plan lacks it", await sidebarHasMarketing(), JSON.stringify(await ui.sidebarGroups(d)));
  await ui.openMarketing(d);
  await d.pause(900);
  const locked = await ui.text(d);
  d.check("opening /marketing/new says 'Marketing isn't in your plan'", /Marketing isn't in your plan/.test(locked), locked.slice(locked.indexOf("Marketing"), locked.indexOf("Marketing") + 120));
  d.never("the page still offers the sending screens", (await d.page.getByRole("button", { name: "Review and send" }).count()) > 0 || (await d.page.getByRole("radio").count()) > 0);
  await d.shot("locked");

  await d.step("The platform unlocks Marketing for THIS store only");
  await d.tab("dashboard", "Platform console · super admin");
  await ui.signIn(d, "super");
  await ui.setStoreFeature(d, "Mkt Co", "Marketing", "Unlocked for this store");
  await asOwner(OWNER, "Store dashboard · owner of Mkt Co");
  d.check("the owner now has Marketing in the sidebar", await sidebarHasMarketing());
  await ui.openMarketing(d);
  await d.page.getByText("How do you want to reach them?").waitFor({ timeout: 15000 });
  d.check("…and the real Marketing screen opens", (await d.page.getByRole("radio").count()) === 3);
  await asOwner(OTHER, "Store dashboard · owner of Mkt Other");
  d.never("the OTHER store on the same plan got Marketing too", await sidebarHasMarketing());

  await d.step("Back to 'from plan', then the store moves to the plan that includes Marketing");
  await d.tab("dashboard", "Platform console · super admin");
  await ui.signIn(d, "super");
  await ui.setStoreFeature(d, "Mkt Co", "Marketing", "From plan");
  await asOwner(OWNER, "Store dashboard · owner of Mkt Co");
  d.never("Marketing stays after the unlock is removed (the plan still lacks it)", await sidebarHasMarketing());
  await d.tab("dashboard", "Platform console · super admin");
  await ui.signIn(d, "super");
  await ui.setStorePlan(d, "Mkt Co", "Mkt Pro");
  await asOwner(OWNER, "Store dashboard · owner of Mkt Co");
  d.check("on the plan that includes Marketing the owner has it", await sidebarHasMarketing());

  await d.step("Locking Marketing for one store beats its plan");
  await d.tab("dashboard", "Platform console · super admin");
  await ui.signIn(d, "super");
  await ui.setStoreFeature(d, "Mkt Co", "Marketing", "Locked for this store");
  await asOwner(OWNER, "Store dashboard · owner of Mkt Co");
  d.never("the owner still has Marketing after the platform locked it for the store", await sidebarHasMarketing());
  await ui.openMarketing(d);
  await d.pause(700);
  d.check("opening it says it isn't in the plan", /Marketing isn't in your plan/.test(await ui.text(d)));
  await d.tab("dashboard", "Platform console · super admin");
  await ui.signIn(d, "super");
  await ui.setStoreFeature(d, "Mkt Co", "Marketing", "From plan");
  await asOwner(OWNER, "Store dashboard · owner of Mkt Co");
  d.check("back to 'from plan' (a plan that includes it) → the owner has Marketing again", await sidebarHasMarketing());

  await d.step("Other Pro stores are untouched");
  await asOwner(["o@mart.test", "Owner123!"], "Store dashboard · owner of Marketing Mart");
  d.check("Marketing Mart (Pro) still has Marketing", await sidebarHasMarketing());
  d.never("the browser logged JavaScript errors", d.problems.length > 0, d.problems.join(" | "));
  void BENCH;
}
