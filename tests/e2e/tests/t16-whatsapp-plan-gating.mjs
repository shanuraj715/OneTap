// T16 — WhatsApp chat switched off (by the plan, or locked for one store): the numbers are unlinked at once, the dashboard asks
// the server nothing about WhatsApp, and every WhatsApp address is a 404 inside the dashboard. All in Chrome.
import * as ui from "../bench/ui.mjs";
import { BENCH } from "../bench/watch.mjs";

export const meta = {
  id: "t16-whatsapp-plan-gating",
  title: "WhatsApp chat off (plan or per-store lock) — numbers unlinked at once, no WhatsApp requests, every WhatsApp address is a 404",
  area: "whatsapp",
  fresh: true,
  summary: "In Chrome as the owner of Acme Momos (Pro plan, four linked/linkable numbers). First the baseline: WhatsApp is in the sidebar, the Numbers page shows the numbers, the dashboard talks to /api/whatsapp, and the browser's only websocket is the live order feed. Then the platform takes WhatsApp chat out of the Pro plan: at once the owner has no WhatsApp in the sidebar, every WhatsApp address (chats, numbers, broadcast, access, clean-up) shows a 404 in the middle of the page with the sidebar still there, and the browser sends no WhatsApp requests at all. When the feature comes back, the numbers are all 'Unlinked' (with the reason) and need linking again, while the chats and messages are still there. A lock for just this store behaves the same way and beats the plan.",
  expect: [
    "While WhatsApp chat is on: the sidebar has WhatsApp, Numbers lists the numbers, and the dashboard polls /api/whatsapp.",
    "The dashboard's only websocket is the live order feed (/realtime); WhatsApp chat never opens one in the browser.",
    "After the platform removes WhatsApp chat from the plan: no WhatsApp item in the sidebar; /whatsapp, /whatsapp/chats, /numbers, /broadcast, /access and /cleanup each show a '404 — Page not found' in the content area with the sidebar still visible and none of the chat screens.",
    "While it is off the browser sends NO request to /api/whatsapp.",
    "When the feature is switched back on, every number shows 'Unlinked' with the reason and a 'Link again' button, and the old chats are still listed.",
    "Locking WhatsApp chat for the one store does the same, even though its plan has it; setting it back to 'From plan' restores the menu.",
  ],
  expectNot: [
    "A store without WhatsApp chat must NOT show the WhatsApp pages (not even by typing the address).",
    "A store without WhatsApp chat must NOT keep any number linked.",
    "The dashboard must NOT send any WhatsApp request while the feature is off.",
    "Chats and messages must NOT be deleted when the feature goes away.",
    "The browser must NOT log JavaScript errors.",
  ],
};

const OWNER = ["o@acme.test", "Owner123!"];
const WA_PAGES = ["/whatsapp", "/whatsapp/chats", "/whatsapp/numbers", "/whatsapp/broadcast", "/whatsapp/access", "/whatsapp/cleanup"];

export async function run(d, h) {
  await d.tab("dashboard", "Store dashboard · owner of Acme Momos");
  const sockets = [];
  const waCalls = [];
  d.page.on("websocket", (ws) => sockets.push(ws.url()));
  d.page.on("request", (r) => { if (/\/api\/whatsapp/.test(r.url())) waCalls.push(r.url()); });
  // the item appears a moment after sign-in (the plan and the person's access are read first) and may carry an unread badge
  const sidebarNow = async () => (await d.page.locator("aside nav a").allInnerTexts()).some((t) => /^WhatsApp/.test(t.trim()));
  const sidebarHasWhatsApp = async () => ui.until(sidebarNow, 6000);
  // for "it is NOT there": wait until the rest of the sidebar has drawn, then look
  const sidebarLacksWhatsApp = async () => { await d.page.getByRole("link", { name: "Orders", exact: true }).first().waitFor({ timeout: 15000 }); await d.pause(2500); return !(await sidebarNow()); };
  const asOwner = async () => { await d.tab("dashboard", "Store dashboard · owner of Acme Momos"); await ui.signIn(d, OWNER); };
  const asSuper = async () => { await d.tab("dashboard", "Platform console · super admin"); await ui.signIn(d, "super"); };

  await d.step("Baseline: WhatsApp chat is on for the Pro plan");
  await asOwner();
  d.check("WhatsApp is in the sidebar", await sidebarHasWhatsApp());
  await d.goto(BENCH.admin + "/whatsapp/numbers", 900);
  await d.page.getByText("Counter phone").first().waitFor({ timeout: 15000 });
  const numbers0 = await ui.text(d);
  d.check("the Numbers page lists the linked numbers (Counter phone, Number 2, Number 3, New phone)", ["Counter phone", "Number 2", "Number 3", "New phone"].every((n) => numbers0.includes(n)));
  d.check("Counter phone and Number 3 are connected", (numbers0.match(/Connected|Online/g) ?? []).length >= 2, numbers0.match(/Counter phone[^]{0,60}/)?.[0]);
  d.check("the dashboard talks to /api/whatsapp while it is on", waCalls.length > 0, `${waCalls.length} requests`);
  await d.goto(BENCH.admin + "/orders", 2000); // the live order feed opens on the Orders page
  d.check("the browser's only websocket is the live order feed (/realtime) — WhatsApp chat doesn't open one", sockets.length > 0 && sockets.every((u) => /\/realtime/.test(u)), sockets.join(", "));
  d.never("a websocket for WhatsApp is opened by the browser", sockets.some((u) => /whatsapp|\/wa\b/i.test(u)), sockets.join(", "));

  await d.step("The platform takes WhatsApp chat out of the Pro plan");
  await asSuper();
  await ui.setPlanFeature(d, "Pro", "WhatsApp chat", false);

  await d.step("The owner: no WhatsApp anywhere, and every WhatsApp address is a 404");
  await asOwner();
  const callsBefore = waCalls.length;
  d.check("WhatsApp is gone from the sidebar", await sidebarLacksWhatsApp());
  for (const path of WA_PAGES) {
    await d.goto(BENCH.admin + path, 700);
    await d.page.locator("[data-not-found]").waitFor({ timeout: 10000 });
    const t = await ui.text(d);
    d.check(`${path} → 404 in the middle of the page`, /404/.test(t) && /Page not found/.test(t));
    d.check(`…and the sidebar is still there (${path})`, (await d.page.locator("aside nav a").count()) > 3 && /Orders/.test(t));
    d.never(`…and no chat screen shows (${path})`, /Counter phone|New chat|Broadcast message|Link a number/.test(t) || (await d.page.getByRole("button", { name: /New chat|Add a number|Send/ }).count()) > 0);
  }
  await d.shot("404");
  await d.pause(2500);
  d.never("the browser sent any request to /api/whatsapp while the feature was off", waCalls.length > callsBefore, `${waCalls.length - callsBefore} requests: ${waCalls.slice(callsBefore, callsBefore + 3).join(", ")}`);
  d.never("a websocket for WhatsApp is open", sockets.some((u) => /whatsapp|\/wa\b/i.test(u)));

  await d.step("WhatsApp chat comes back: every number was unlinked, the chats are still there");
  await asSuper();
  await ui.setPlanFeature(d, "Pro", "WhatsApp chat", true);
  await asOwner();
  d.check("WhatsApp is back in the sidebar", await sidebarHasWhatsApp());
  await d.goto(BENCH.admin + "/whatsapp/numbers", 900);
  await d.page.getByText("Counter phone").first().waitFor({ timeout: 15000 });
  const numbers1 = await ui.text(d);
  d.check("every number says 'Unlinked'", (numbers1.match(/Unlinked/g) ?? []).length >= 4, `${(numbers1.match(/Unlinked/g) ?? []).length} of 4`);
  d.never("a number still says Connected", /Connected/.test(numbers1.replace(/Disconnected/g, "")), numbers1.match(/Connected/)?.[0]);
  d.check("the reason is shown on the cards", /WhatsApp chat isn't in this store's plan any more/.test(numbers1));
  d.check("each can be linked again", (await d.page.getByRole("button", { name: /Link again/ }).count()) >= 4);
  await d.goto(BENCH.admin + "/whatsapp/chats", 900);
  await d.page.getByText("Riya Sharma").first().waitFor({ timeout: 15000 });
  d.check("the old chats are still listed (nothing was deleted)", /Riya Sharma/.test(await ui.text(d)) && /Kabir/.test(await ui.text(d)));
  await d.shot("numbers-unlinked");

  await d.step("Locking WhatsApp chat for just this store beats its plan");
  await asSuper();
  await ui.setStoreFeature(d, "Acme Momos", "WhatsApp chat", "Locked for this store");
  await asOwner();
  d.check("WhatsApp is not in the sidebar of a store it is locked for", await sidebarLacksWhatsApp());
  await d.goto(BENCH.admin + "/whatsapp/chats", 700);
  await d.page.locator("[data-not-found]").waitFor({ timeout: 10000 });
  d.check("its chat address is a 404", /Page not found/.test(await ui.text(d)));
  await asSuper();
  await ui.setStoreFeature(d, "Acme Momos", "WhatsApp chat", "From plan");
  await asOwner();
  d.check("back to 'from plan' (the plan has it) → WhatsApp is back", await sidebarHasWhatsApp());

  d.never("the browser logged JavaScript errors", d.problems.length > 0, d.problems.join(" | "));
}
