import { kindFor, paymentProblem, suggestedAmount, yearlyPrice } from "@/lib/payments";
import { money, moneyShort } from "@/lib/format";

describe("what a plan's price comes to", () => {
  it("is months × the monthly price, and a year uses the yearly price with the plan's discount", () => {
    expect(suggestedAmount(2499, 23990, 1)).toBe(2499);
    expect(suggestedAmount(2499, 23990, 3)).toBe(7497);
    expect(suggestedAmount(2499, 23990, 12)).toBe(23990);
    expect(suggestedAmount(2499, 0, 12)).toBe(29988); // no yearly price: 12 × monthly
    expect(suggestedAmount(0, 0, 5)).toBe(0); // a plan with no price suggests nothing
  });
  it("suggests nothing for months that are not a number or are below 1", () => {
    for (const m of [0, -2, NaN]) expect(suggestedAmount(2499, 23990, m)).toBe(0);
  });
  it("works out the yearly price from the discount", () => {
    expect(yearlyPrice(2499, 20)).toBe(23990);
    expect(yearlyPrice(999, 0)).toBe(0);
    expect(yearlyPrice(0, 20)).toBe(0);
  });
});

describe("what is wrong with the form", () => {
  it("needs a day, an amount above 0 and a whole number of months from 1 to 60", () => {
    expect(paymentProblem("2026-11-28", 2499, 1)).toBeNull();
    expect(paymentProblem("", 2499, 1)).toMatch(/day/);
    expect(paymentProblem("2026-11-28", 0, 1)).toMatch(/amount/);
    expect(paymentProblem("2026-11-28", NaN, 1)).toMatch(/amount/);
    expect(paymentProblem("2026-11-28", -5, 1)).toMatch(/amount/);
    for (const m of [0, 61, 1.5, NaN]) expect(paymentProblem("2026-11-28", 100, m)).toMatch(/Months/);
    expect(paymentProblem("2026-11-28", 100, 60)).toBeNull();
  });
});

describe("new sale or re-subscription", () => {
  const paid = (...days: string[]) => days.map((paidOn) => ({ paidOn }));
  it("the first payment of a store is the new sale", () => {
    expect(kindFor([], "2026-11-28")).toBe("new");
  });
  it("any later payment is a re-subscription — also one on the same day as the first", () => {
    expect(kindFor(paid("2026-10-01"), "2026-11-28")).toBe("renewal");
    expect(kindFor(paid("2026-11-28"), "2026-11-28")).toBe("renewal");
  });
  it("a payment dated BEFORE the first one would become the new sale (the older one turns into a re-subscription)", () => {
    expect(kindFor(paid("2026-10-01", "2026-11-01"), "2026-09-15")).toBe("new");
    expect(kindFor(paid("2026-11-01", "2026-10-01"), "2026-10-02")).toBe("renewal"); // the order they were written in does not matter
  });
});

describe("money in rupees (not paise)", () => {
  it("shows whole rupees without decimals and paise only when there are any, in Indian grouping", () => {
    expect(money(2499)).toBe("₹2,499");
    expect(money(2499.5)).toBe("₹2,499.5");
    expect(money(999.99)).toBe("₹999.99");
    expect(money(1234567)).toBe("₹12,34,567");
    expect(money(0)).toBe("₹0");
    expect(money(null)).toBe("₹0");
  });
  it("is short for a chart axis", () => {
    expect(moneyShort(900)).toBe("₹900");
    expect(moneyShort(2500)).toBe("₹2.5 K");
    expect(moneyShort(150000)).toBe("₹1.5 L");
  });
});
