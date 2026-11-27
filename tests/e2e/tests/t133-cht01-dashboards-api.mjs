// T133 — The numbers behind CHT01 (the stacked area chart): the platform dashboard's last 12 months and a store dashboard's last 14 days, each split by order type
import { runSuite } from "../bench/suite.mjs";

export const meta = {
  id: "t133-cht01-dashboards-api",
  title: "CHT01 data: the platform dashboard sends each of the last 12 months' sales split by order type, a store dashboard sends each of the last 14 days' sales split by order type — and the layers always add up to the totals",
  area: "dashboard",
  browser: false,
  fresh: false,
  summary: "A private API on an in-memory database with orders in different order types. The platform dashboard's sales.monthlyChannels has 12 months that line up with the monthly bars; dine-in, takeaway, delivery and 'other' (any other order type) add up to each month's sales; a cancelled order is never counted. A store's dashboard revenueTrend still has 14 days and now carries each day's split; an unpaid order is left out; a day with no sales has an empty split.",
  expect: [
    "The platform dashboard has twelve months of sales split into dine-in, takeaway, delivery and other.",
    "In every month and every day the layers add up to the same total as the bars.",
    "A store's 14-day trend carries each day's split by order type.",
  ],
  expectNot: [
    "A cancelled order must NOT be in any layer.",
    "An unpaid order must NOT be in the store's daily trend.",
    "The layers must NOT add up to something different from the column chart.",
  ],
};

export const run = (d) => runSuite(d, "cht01-dashboards-api.mjs", { timeoutMs: 4 * 60_000 });
