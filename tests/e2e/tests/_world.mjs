// Shared constants and checks for the store-lifecycle chain (t08 → t12). Files starting with "_" are not tests.
// Everything is done in Chrome — there are no API calls in these tests.
import { BENCH } from "../bench/watch.mjs";
import { text, openPlatform } from "../bench/ui.mjs";

export const W = {
  store: "Lifecycle Foods",
  slug: "lifecycle",
  ownerEmail: "owner@lifecycle.test",
  ownerPassword: "Owner123!",
  label: "lifecycle", // the store's Rasoi Pulse address:  lifecycle.<base>
};
export const SUB_HOST = `${W.label}.localhost:3170`;
export const SUB_URL = `http://${SUB_HOST}`;
export const OWNER = [W.ownerEmail, W.ownerPassword];
export const PLAN = { basic: "Lifecycle Basic", pro: "Lifecycle Pro", custom: "Lifecycle Custom" };

/** the three outlets: dashboard name + URL slug, and what customers see (the name each outlet is renamed to under Settings → Outlets) */
export const OUTLETS = {
  central: { name: "Central", slug: "central", title: "Lifecycle Central", lat: 28.6315, lng: 77.2167, radius: 3, fee: 20, free: 500, minOrder: 0, hours: ["08:00", "20:00"] },
  second: { name: "Second", slug: "second", title: "Lifecycle Second", lat: 28.5707, lng: 77.3219, radius: 5, fee: 30, free: 600, minOrder: 50, hours: ["09:00", "21:00"] },
  third: { name: "Third", slug: "third", title: "Lifecycle Third", lat: 28.4595, lng: 77.0266, radius: 8, fee: 40, free: 700, minOrder: 100, hours: ["10:00", "22:00"] },
};
export const MENUS = {
  central: ["Burgers", [["Veg Burger", "veg", 90], ["Chicken Burger", "non-veg", 120]]],
  second: ["Pizzas", [["Margherita Pizza", "veg", 150], ["Farmhouse Pizza", "veg", 190]]],
  third: ["Rolls", [["Paneer Roll", "veg", 80], ["Egg Roll", "non-veg", 70]]],
};

/** the chain's store must exist — checked on the platform console's Stores page, like a person would */
export async function requireWorld(d) {
  await openPlatform(d, "/stores");
  await d.page.getByText("All stores").first().waitFor({ timeout: 15000 });
  if (!(await text(d)).includes(W.store)) throw new Error(`"${W.store}" isn't on the Stores page — t08–t12 are a chain that builds on each other. Run them together: node run.mjs --only t08,t09,t10,t11,t12`);
}

export { BENCH };
