/**
 * Money is kept in paise (whole numbers) everywhere, exactly as the server sends it. This turns it into text for the screen:
 * 9000 → ₹90, 34050 → ₹340.50, 123456700 → ₹12,34,567 (Indian grouping: the last three digits, then pairs).
 */
export function formatMoney(paise: number): string {
  if (!Number.isFinite(paise)) return "₹–";
  const negative = paise < 0;
  const abs = Math.abs(Math.round(paise));
  const rupees = Math.floor(abs / 100);
  const rest = abs % 100;
  const digits = String(rupees);
  const lastThree = digits.slice(-3);
  const head = digits.slice(0, -3);
  const grouped = head ? `${head.replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${lastThree}` : lastThree;
  const text = `₹${grouped}${rest ? `.${String(rest).padStart(2, "0")}` : ""}`;
  return negative ? `−${text}` : text;
}

/** "+₹10" / "−₹5" for a price change on an add-on; nothing for a free one. */
export function formatDelta(paise: number): string {
  if (!paise) return "";
  return paise > 0 ? `+${formatMoney(paise)}` : formatMoney(paise);
}
