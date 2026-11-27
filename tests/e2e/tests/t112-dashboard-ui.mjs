// T112 — The dashboard's new look, its needs-attention strip, the new widgets, per-role and per-plan visibility, and the clean Configure page.
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t112-dashboard-ui",
  title: "Dashboard: a cleaner, more modern look with a needs-attention strip, three new widgets, each role and plan sees only its own, and a clear Configure-dashboard grid",
  area: "dashboard",
  browser: true,
  fresh: false,
  summary: "Chrome against the bench. The owner's dashboard: a greeting by name, today's date and 'Updated hh:mm' with a Refresh button; a strip that says whether anything needs attention; every card has a coloured icon chip; the new Out for delivery, Table bookings and Customer rating cards sit beside the old ones; the revenue chart is drawn at the card's width and pointing at it reads out that day's revenue. With made-up numbers (the stats call is answered with them for this check only): five chips — '3 orders are over the time limit' and '2 online orders are waiting for payment' (Orders), '1 delivery is ready and waiting for a rider', '2 bookings are waiting for your yes' (Bookings), '4 messages could not be sent today' (Notifications); the revenue card says '125% of yesterday' and 'Yesterday: ₹4,000' with a little trend line; the rating card 4.5 with five stars and '12 ratings, last 30 days'; the deliveries card '1 to hand over'; the bookings card '2 need a yes'. The kitchen sees its queue and recent orders but no revenue, rating or bookings; the owner of the small Starter plan has no deliveries, bookings, rating, coins or message-failure cards. Configure dashboard: one row per widget (20), a column per role (Owner, Manager, Cashier / Staff, Kitchen, Accountant — none for the platform's super admin), Revenue for the Kitchen is a padlock saying 'Kitchen can't open Reports', the accountant is ticked; unchanged → Saved and off; unticking the manager and switching Sold out off → 'Save changes' and '19 of 20 widgets on'; Move down changes the order; Save stores it and the manager's own dashboard loses Orders today and Sold out and shows the new order; a column's all / none link ticks or clears every widget that role may be given (never the padlocked ones); 'Recommended' (with a confirm) puts everything back, waiting for Save. On the Starter plan the Deliveries switch is off and its cells say 'Not in your plan (Delivery)'. On a phone the widgets are stacked with the roles as chips, no sideways scroll, and the dashboard keeps two cards a row. The bench's dashboard settings are put back at the end.",
  expect: [
    "The dashboard shows what needs attention, with each item linking to the page that fixes it.",
    "The kitchen sees no revenue; a small plan sees no cards for features it doesn't have.",
    "The Configure page shows a padlock, with the reason, where a role can't be given a widget.",
    "Changes made on the Configure page reach the other person's dashboard.",
  ],
  expectNot: [
    "A padlocked cell must NOT be ticked by an 'all' link.",
    "No sideways scrolling on a phone.",
    "No errors in the browser.",
  ],
};

export const run = (d) => runSuite(d, "dashboard-ui.mjs", { timeoutMs: 10 * 60_000 });
