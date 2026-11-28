/**
 * What to photograph in each app. A scenario drives the REAL app (through adb) to the screen it wants; capture.mjs then takes the picture,
 * crops the empty band at the top and converts it for the website. It runs once for every device (tablet held sideways, tablet held upright, phone) and every look
 * (light, dark), on a freshly installed app, so a scenario must not depend on what an earlier one left behind. Each entry has:
 *   name           the file's name (oma-<name>.<device>.<look>.webp) and the screenshot's key
 *   title / caption / alt   what the website says about it (alt = what is on the screen, for screen readers: no device or look in it, the website adds those)
 *   rank           the order the screenshots appear in on the website (default: the order here); the shots are TAKEN in the order listed here
 *   devices        only these devices (default: all three)
 *   run(c)         the taps that get to the screen. c = the helpers from adb.mjs (tap, tapAt, waitFor, screen, swipe, sleep …) plus: c.device, c.twoPanel (the screen
 *                  is wide enough for the app's two-panel layout), c.swipeBy(fx1, fy1, fx2, fy2) (a swipe written as fractions of the picture), c.relaunch()
 * To fix or add a screen:  node mobile-apps/screenshots/capture.mjs --look oma --steps "tap:tab-orders;sleep:1000;look;shot:try"
 * lists what is on screen (ids, texts, positions) and saves a picture to raw/look-try.png.
 * The restaurant, the guests and the orders are made up (serve.mjs).
 */

/** a dish card on the OMA menu: tap its Add / Choose button (found inside the card, so it works whatever row the card is on) */
async function pressDish(c, name) {
  const nodes = await c.screen();
  const card = nodes.find((n) => n.id === `dish-${name}`);
  if (!card) throw new Error(`no dish card for "${name}" on screen`);
  const button = nodes.find((n) => (n.text === "Add" || n.text === "Choose") && n.cx > card.x1 && n.cx < card.x2 && n.cy > card.y1 && n.cy < card.y2);
  if (!button) throw new Error(`no Add / Choose button inside the card of "${name}"`);
  c.tapAt(button.cx, button.cy);
  await c.sleep(700);
  return button.text;
}

/** open a dish's option sheet, choose what is asked for (`pick`, if anything), and add it to the order */
async function addViaSheet(c, name, pick) {
  await pressDish(c, name);
  await c.waitFor({ id: "dish-sheet" });
  if (pick) await c.tap({ text: pick });
  await c.tap({ id: "dish-add" });
  await c.waitFor({ id: "dish-sheet" }, { gone: true });
  await c.sleep(500);
}

/**
 * Go to the Tables tab and make sure the areas we want are open (they start closed, and the app remembers which a waiter opened).
 * An area is open when one of its tables is on screen; a header is only tapped when the area is closed, so nothing is ever closed by mistake.
 */
async function showAreas(c, wanted = [["Ground floor", "table-T1"]]) {
  await c.tap({ id: "tab-tables" });
  await c.waitFor({ id: /^zone-header-/ }, { timeoutMs: 20_000 }); // the tables screen has loaded
  await c.sleep(500);
  for (const [area, aTable] of wanted) {
    for (let tries = 0; tries < 3; tries++) {
      if ((await c.screen()).some((n) => n.id === aTable)) break;
      await c.tap({ id: `zone-header-${area}` });
      await c.sleep(700);
    }
    await c.waitFor({ id: aTable });
  }
}

async function openTableT1(c) {
  await showAreas(c);
  await c.tap({ id: "table-T1" });
  await c.waitFor({ id: "take-order" });
}

/** back to the first screen of an app that has a bottom tab bar (`tab`): press "Navigate up" until it is there; start the app again if that doesn't get there */
async function goHome(c, tab) {
  for (let tries = 0; tries < 4; tries++) {
    const now = await c.screen();
    if (now.some((n) => n.id === tab)) return;
    const up = now.find((n) => n.desc === "Navigate up");
    if (!up) break;
    c.tapAt(up.cx, up.cy);
    await c.sleep(700);
  }
  if (!(await c.screen()).some((n) => n.id === tab)) await c.relaunch();
}

/** the menu of table T1, with the Momos section open (the screen the "options" and "take-order" shots start from) */
async function ensureMenu(c) {
  if (!(await c.screen()).some((n) => n.id === "dish-search")) {
    await goHome(c, "tab-tables");
    await openTableT1(c);
    await c.tap({ id: "take-order" });
    await c.waitFor({ id: "dish-search" });
  }
  if (!(await c.screen()).some((n) => n.id === "dish-Chicken Kurkure Momos")) {
    await c.tap({ id: "section-Momos" });
    await c.sleep(900);
  }
}

export const SHOTS = {
  oma: [
    {
      name: "orders",
      rank: 3,
      title: "Every order in one list",
      caption: "Follow each order from new to ready to served. See who ordered, from which table or as a delivery, and what was paid.",
      alt: "The Orders list: each order's number, status, table or delivery, items and amount.",
      run: async (c) => {
        await c.tap({ id: "tab-orders" });
        await c.sleep(2000);
      },
    },
    {
      name: "tables",
      rank: 0,
      title: "Every table at a glance",
      caption: "See which tables are free and who is seated, with what they still owe. Tap a table to see its orders, add more items, move the table or confirm the payment.",
      alt: "The tables grouped by area, free and seated tables marked with the guests' names and what they still owe.",
      run: async (c) => {
        if (c.twoPanel) {
          await showAreas(c, [["Terrace", "table-T6"], ["Ground floor", "table-T1"]]);
          await c.tap({ id: "table-T1" });
          await c.waitFor({ id: "take-order" });
          await c.sleep(600);
        } else {
          await goHome(c, "tab-tables");
          await showAreas(c, [["Ground floor", "table-T1"]]);
        }
      },
    },
    {
      name: "table",
      rank: 1,
      devices: ["tablet-portrait", "phone"],
      title: "Everything about one table",
      caption: "The bill so far, what is still to pay and every order on the table. Add more items, move the table, confirm the payment or free it.",
      alt: "One table's page: the guests, the bill so far and what is still to pay, buttons to add items, move the table or confirm the payment, and the table's orders.",
      run: async (c) => {
        await goHome(c, "tab-tables");
        await openTableT1(c);
        await c.sleep(600);
      },
    },
    {
      name: "take-order",
      rank: 2,
      title: "Take the order at the table",
      caption: "Choose dishes by category, pick sizes and add-ons, and add a note for the kitchen. Dishes that are sold out or nearly out are marked, so nobody promises what you can't serve.",
      alt: "The menu with dish photos, prices and Add and Choose buttons, and the order being built with its total.",
      run: async (c) => {
        await goHome(c, "tab-tables");
        await openTableT1(c);
        await c.tap({ id: "take-order" });
        await c.waitFor({ id: "dish-search" });
        await c.tap({ id: "section-Momos" });
        await c.sleep(900);
        if (c.twoPanel) {
          // build the order from dishes that open the option sheet (the ones with photos): a dish added with its plain "Add" button gets a cramped
          // "1 in the order" label with a stepper squeezed into its card, which is how the app really looks but not the best picture of it
          await addViaSheet(c, "Paneer Tandoori Momos");
          await addViaSheet(c, "Chicken Tandoori Momos");
          await addViaSheet(c, "Chicken Kurkure Momos", "Medium"); // the spice level is required
          await addViaSheet(c, "Veg Steamed Momos", /Full/);
          await c.waitFor({ id: "order-total" });
        } else {
          await addViaSheet(c, "Chicken Tandoori Momos");
          await pressDish(c, "Afghani Malai Momos");
          await c.waitFor({ id: "review-order" });
        }
        await c.sleep(900);
      },
    },
    {
      name: "options",
      rank: 4,
      title: "Sizes, add-ons and notes",
      caption: "Pick the size, the add-ons and the spice level, and write a note for the kitchen. What the guest must choose is marked, so no order goes in half finished.",
      alt: "A dish's options: add-ons to tick, the required spice level, a note for the kitchen, the quantity and the Add button.",
      run: async (c) => {
        await ensureMenu(c);
        await pressDish(c, "Chicken Kurkure Momos");
        await c.waitFor({ id: "dish-sheet" });
        await c.tap({ text: "Medium" });
        await c.tap({ text: "Mayo dip" });
        await c.sleep(500);
      },
    },
  ],
  kda: [
    {
      name: "board",
      rank: 0,
      title: "The kitchen board",
      caption: "New orders land the moment they are accepted. Tap Start, then Mark ready. Every ticket shows how long it has waited and changes colour as it does.",
      alt: "The kitchen board with the orders in New, Preparing and Ready, each ticket showing table, guest, dishes and waiting time.",
      run: async (c) => {
        await c.tap({ id: "tab-board" });
        await c.waitFor({ id: /^ticket-\d+$/ });
        await c.sleep(600);
      },
    },
    {
      name: "prep",
      rank: 1,
      title: "Prep list",
      caption: "Everything on the board that is not ready yet, added up. The same dish with the same size and add-ons is one line, so the kitchen can cook in batches.",
      alt: "The prep list: each line shows how many of a dish are still to make and across how many orders.",
      run: async (c) => {
        await c.tap({ id: "tab-prep" });
        await c.sleep(1800);
      },
    },
    {
      name: "dishes",
      rank: 2,
      title: "Sold out in one tap",
      caption: "Mark a dish sold out, or put it back, in one tap. See at a glance what is off the menu and what is running low for the day.",
      alt: "The dishes list: each dish marked Available or Sold out with a button to change it, and a dish running low shown as 2 left of 20 a day.",
      run: async (c) => {
        await c.tap({ id: "tab-dishes" });
        await c.sleep(1800);
      },
    },
    {
      name: "today",
      rank: 3,
      title: "Today at a glance",
      caption: "For kitchen managers: how many orders are made, how long they take on average, which was the slowest, and which dishes went out most.",
      alt: "The Today page: orders by stage right now, orders made, average time, late orders, the slowest order and the most made dishes.",
      run: async (c) => {
        await c.tap({ id: "tab-today" });
        await c.sleep(2200);
      },
    },
  ],
  rda: [
    {
      name: "deliveries",
      rank: 0,
      title: "Your deliveries, one by one",
      caption: "Each delivery shows the address, the landmark, how far it is, what is in the bag and whether it is paid. Navigate, call or message the customer with one tap.",
      alt: "The rider's list of deliveries on the way, each with address, distance, customer, items, payment, Navigate, Call and WhatsApp buttons and a Delivered button.",
      run: async (c) => {
        await c.tap({ id: "tab-deliveries" });
        await c.waitFor({ id: "delivery-0008" });
        await c.sleep(800);
      },
    },
    {
      name: "pickup",
      rank: 1,
      title: "Pick up when it is ready",
      caption: "A delivery says Being prepared until the kitchen has finished it. Then it says Ready to pick up, and you tap Picked up to head out.",
      alt: "One delivery marked Ready to pick up with a Picked up button, and one marked Being prepared while the kitchen is still making it.",
      run: async (c) => {
        c.swipeBy(0.5, 0.85, 0.5, 0.2);
        await c.sleep(1200);
      },
    },
    {
      name: "code",
      rank: 2,
      title: "Hand over with the customer's code",
      caption: "Orders paid online are handed over against the customer's own 4-digit code, so the food reaches the right person.",
      alt: "The box that asks the rider for the customer's 4-digit code before an order can be marked delivered.",
      run: async (c) => {
        c.swipeBy(0.5, 0.2, 0.5, 0.85); // back to the top
        await c.sleep(1000);
        await c.tap({ id: "action-0008" });
        await c.sleep(1500);
      },
    },
  ],
};
