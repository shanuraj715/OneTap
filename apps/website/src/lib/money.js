/** Rupees the way Indians write them: ₹1,23,456. */
export const inr = (n) => `₹${new Intl.NumberFormat("en-IN").format(Math.round(n))}`;
