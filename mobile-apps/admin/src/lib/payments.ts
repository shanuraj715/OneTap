/** The rules of the "write a payment down" form, apart from the screen so they can be tested on their own. Money is in rupees; days are "YYYY-MM-DD". */

/** What the plan's price comes to for this many months: a year uses the yearly price (with the plan's discount) when it has one, otherwise months × the monthly price. */
export function suggestedAmount(monthly: number, yearly: number, months: number): number {
  if (!Number.isFinite(months) || months < 1) return 0;
  return months === 12 && yearly ? yearly : monthly * months;
}

/** The yearly price of a plan from its monthly price and yearly discount (percent): 2,499 a month with 20% off = 23,990. 0 when there is no discount. */
export function yearlyPrice(monthly: number, discountPct: number): number {
  return monthly && discountPct ? Math.round((monthly * 12 * (100 - discountPct)) / 100) : 0;
}

/** What is wrong with the form, in a sentence — or null when it can be sent. */
export function paymentProblem(paidOn: string, amount: number, months: number): string | null {
  if (!paidOn) return "Pick the day the money arrived.";
  if (!(amount > 0)) return "Type the amount that was paid, in rupees.";
  if (!(Number.isInteger(months) && months >= 1 && months <= 60)) return "Months must be a whole number from 1 to 60.";
  return null;
}

/** Whether a payment on this day would be the store's new sale (nothing before it) or a re-subscription — the same rule the server uses. */
export function kindFor(existing: { paidOn: string }[], paidOn: string): "new" | "renewal" {
  if (!existing.length) return "new";
  const first = existing.reduce((a, p) => (p.paidOn < a ? p.paidOn : a), existing[0]!.paidOn);
  return paidOn < first ? "new" : "renewal";
}
