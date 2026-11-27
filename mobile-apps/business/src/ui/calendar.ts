/** The arithmetic behind the date picker (days are "YYYY-MM-DD", in the phone's own calendar). */
export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const two = (n: number) => String(n).padStart(2, "0");
export const dayKey = (y: number, m: number, d: number) => `${y}-${two(m + 1)}-${two(d)}`;
export const todayKey = (now = new Date()) => dayKey(now.getFullYear(), now.getMonth(), now.getDate());
export const parseDay = (key: string): { y: number; m: number; d: number } | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  return m ? { y: Number(m[1]), m: Number(m[2]) - 1, d: Number(m[3]) } : null;
};
export const prettyDay = (key: string) => {
  const p = parseDay(key);
  return p ? `${p.d} ${MONTHS[p.m]!.slice(0, 3)} ${p.y}` : "";
};
/** The weeks of a month, Monday first: 6 rows × 7 cells; a cell is a day key or null (before the 1st / after the last). */
export function monthGrid(y: number, m: number): (string | null)[][] {
  const first = (new Date(y, m, 1).getDay() + 6) % 7; // Monday = 0
  const days = new Date(y, m + 1, 0).getDate();
  const cells: (string | null)[] = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => dayKey(y, m, i + 1))];
  while (cells.length < 42) cells.push(null);
  return Array.from({ length: 6 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}
export const shiftMonth = (y: number, m: number, by: number) => { const d = new Date(y, m + by, 1); return { y: d.getFullYear(), m: d.getMonth() }; };
export const inRange = (key: string, min?: string, max?: string) => (!min || key >= min) && (!max || key <= max);
