/**
 * Number and time formatting for the dashboard, in Indian style: ₹1,24,535 and
 * compact ₹1.2L / ₹3.4Cr. Money arrives from the API in paise.
 */

const IN = "en-IN";
const whole = new Intl.NumberFormat(IN, { maximumFractionDigits: 0 });
const short = new Intl.NumberFormat(IN, { notation: "compact", maximumFractionDigits: 1 });

/** Paise as rupees: "₹1,24,535" — or "₹1.2L" when `compact` and big. */
export function rupees(paise, { compact = false } = {}) {
  const value = (paise ?? 0) / 100;
  if (compact && Math.abs(value) >= 10_000) return `₹${short.format(value)}`;
  return `₹${whole.format(value)}`;
}

/** A plain rupee amount (not paise), for plan prices. */
export const rupeesFlat = (value) => `₹${whole.format(value ?? 0)}`;

export const count = (n) => whole.format(n ?? 0);

/** "+12.3%" / "−4.1%" (a real minus sign) / "0%". */
export function signedPct(value) {
  if (value === null || value === undefined) return "–";
  if (value === 0) return "0%";
  const body = `${Math.abs(value).toFixed(1).replace(/\.0$/, "")}%`;
  return value > 0 ? `+${body}` : `−${body}`;
}

/** Axis labels for money: in full while the axis stays under ₹10,000, compact once it reaches it — one style per axis. */
export function axisMoney(maxPaise) {
  if (maxPaise / 100 < 10_000) return (v) => rupees(v);
  return (v) => (v === 0 ? "₹0" : `₹${short.format(v / 100)}`);
}

export function axisCount(max) {
  if (max < 10_000) return (v) => whole.format(v);
  return (v) => (v === 0 ? "0" : short.format(v));
}

/** Round axis ticks: { max, ticks } with `target` or so steps, on 1 / 2 / 2.5 / 5 × 10ⁿ. */
export function niceTicks(maxValue, target = 4) {
  if (!(maxValue > 0)) return { max: 1, ticks: [0, 1] };
  const rough = maxValue / target;
  const power = 10 ** Math.floor(Math.log10(rough));
  const f = rough / power;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * power;
  const top = Math.ceil(maxValue / step - 1e-9) * step;
  const ticks = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return { max: top, ticks };
}

/** "3 min ago" for recent moments, a date after that. */
export function ago(iso, now = Date.now()) {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days} d ago`;
  return new Date(iso).toLocaleDateString(IN, { day: "numeric", month: "short", year: "numeric" });
}

export const dateTime = (iso) =>
  new Date(iso).toLocaleString(IN, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

/** A byte count as "12 KB". */
export function bytes(n) {
  if (!n) return "0 B";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/* ------------------------------------------------------------ the server page */

/** A size in the unit that fits: 512 B, 3.4 KB, 120 MB, 1.92 GB, 1.2 TB. */
export function sizeAuto(b) {
  if (b === null || b === undefined) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = Math.max(0, b);
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v >= 100 || i === 0 ? Math.round(v) : v >= 10 ? v.toFixed(1) : v.toFixed(2)} ${units[i]}`;
}

/** The same size twice, the way you asked to see it: { gb: "1.92 GB", mb: "1,966 MB" }. */
export function sizeBoth(b) {
  const bytes = Math.max(0, b ?? 0);
  const gb = bytes / 1024 ** 3;
  return { gb: `${gb >= 100 ? gb.toFixed(0) : gb >= 10 ? gb.toFixed(1) : gb.toFixed(2)} GB`, mb: `${whole.format(Math.round(bytes / 1024 ** 2))} MB` };
}

/** A speed in bytes per second: "0 B/s", "340 KB/s", "2.4 MB/s". */
export const rate = (bps) => (bps === null || bps === undefined ? "—" : `${sizeAuto(bps)}/s`);

/** …and in megabits per second, the way hosting providers quote bandwidth. */
export const mbit = (bps) => (bps === null || bps === undefined ? "—" : `${((bps * 8) / 1e6).toFixed(bps * 8 < 1e7 ? 2 : 1)} Mbit/s`);

/** "266 days 19 h", "3 h 12 min", "45 s". */
export function uptime(seconds) {
  const s = Math.max(0, Math.round(seconds ?? 0));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d) return `${d} ${d === 1 ? "day" : "days"} ${h} h`;
  if (h) return `${h} h ${m} min`;
  if (m) return `${m} min`;
  return `${s} s`;
}

/** A length of time that suits a cache, where seconds matter: "41 s", "4 min 19 s", "3 h 12 min", "2 d 4 h". */
export function span(seconds) {
  const s = Math.max(0, Math.round(seconds ?? 0));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (s < 3600) return s % 60 ? `${m} min ${s % 60} s` : `${m} min`;
  const h = Math.floor(s / 3600);
  if (s < 86400) return m % 60 ? `${h} h ${m % 60} min` : `${h} h`;
  const d = Math.floor(s / 86400);
  return h % 24 ? `${d} d ${h % 24} h` : `${d} d`;
}

/** A clock time for a chart axis: "14:05". */
export const clock = (ms) => new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
export const clockSeconds = (ms) => new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

/** A percentage with at most one decimal: 12.3%, 4%. */
export const percent = (v) => (v === null || v === undefined ? "—" : `${Math.round(v * 10) / 10}%`);
