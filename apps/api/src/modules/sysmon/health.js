/**
 * Server health, scored 0 to 10.
 *
 * Each part of the server gets its own score from one clear rule, so "why isn't
 * this a 10?" always has an answer a person can read:
 *
 *   CPU            how busy the processors have been over the last minute (and whether the
 *                  hosting provider is taking CPU away from this virtual server)
 *   Load           how much work is waiting for the CPU, per core
 *   Memory         how much is still available, and whether the server is swapping
 *   Disk space     how full the fullest disk is
 *   Disk activity  how busy the disk is, and how long the CPU waits on it
 *   API & database how fast the database answers, whether the API is keeping up, how many requests fail
 *
 * The server's overall score is the average, but never more than 3 above its
 * weakest part, and never green while any part is yellow or red: one overloaded
 * resource can't hide behind fine ones.
 *
 * 7–10 is healthy (green), 4–6 needs attention (yellow), 0–3 is critical (red).
 * The number of coloured boxes always stays inside the band of its colour.
 */

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const round1 = (v) => Math.round(v * 10) / 10;

/** Piecewise-linear score for a figure where HIGHER IS WORSE. `points` = [[value, score], …] with value rising and score falling. */
export function scaleDown(value, points) {
  if (value <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [v0, s0] = points[i - 1];
    const [v1, s1] = points[i];
    if (value <= v1) return s0 + ((value - v0) / (v1 - v0)) * (s1 - s0);
  }
  return points.at(-1)[1];
}

/** …and where HIGHER IS BETTER: points = [[value, score], …] with both rising. */
export function scaleUp(value, points) {
  if (value >= points.at(-1)[0]) return points.at(-1)[1];
  if (value <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [v0, s0] = points[i - 1];
    const [v1, s1] = points[i];
    if (value <= v1) return s0 + ((value - v0) / (v1 - v0)) * (s1 - s0);
  }
  return points.at(-1)[1];
}

export const levelOf = (score) => (score >= 7 ? "good" : score >= 4 ? "warning" : "critical");
const BAND = { good: [7, 10], warning: [4, 6], critical: [0, 3] };
/** How many of the 10 boxes light up: the score rounded, kept inside its colour's band (so 6.9 is 6 yellow boxes, never 7). */
const boxesFor = (score, level) => clamp(Math.round(score), BAND[level][0], BAND[level][1]);
export const LEVEL_LABEL = { good: "Healthy", warning: "Needs attention", critical: "Critical" };

const gb = (b) => (b >= 1024 ** 3 ? `${(b / 1024 ** 3).toFixed(1)} GB` : `${Math.round(b / 1024 ** 2)} MB`);
const pct = (v) => `${Math.round(v)}%`;

function part(id, label, score, value, detail, reason) {
  const s = round1(clamp(score, 0, 10));
  const level = levelOf(s);
  return { id, label, score: s, boxes: boxesFor(s, level), level, value, detail, reason: level === "good" ? null : reason };
}

/* ------------------------------------------------------------------- parts */

function cpuPart({ cpu }) {
  if (!cpu) return null;
  let score = scaleDown(cpu.used, [[50, 10], [75, 7], [90, 4], [100, 0]]);
  if (cpu.steal > 25) score -= 4;
  else if (cpu.steal > 10) score -= 2;
  const stolen = cpu.steal >= 2 ? `, and the host is taking ${pct(cpu.steal)} for other customers` : "";
  return part(
    "cpu",
    "CPU",
    score,
    pct(cpu.used),
    `${pct(cpu.used)} busy over the last minute${stolen}`,
    cpu.steal > 10
      ? `The hosting provider is taking ${pct(cpu.steal)} of this server's CPU for other customers (a "noisy neighbour"), on top of ${pct(cpu.used)} in use.`
      : cpu.used > 90
        ? `The CPU is overloaded: ${pct(cpu.used)} busy over the last minute, so pages and orders will be slow.`
        : `The CPU has been busy: ${pct(cpu.used)} over the last minute.`,
  );
}

function loadPart({ load, cores }) {
  if (!load || !cores) return null;
  const perCore = load[1] / cores;
  return part(
    "load",
    "Load",
    scaleDown(perCore, [[0.7, 10], [1, 7], [1.5, 4], [3, 0]]),
    load[1].toFixed(2),
    `${load[1].toFixed(2)} average over 5 minutes, on ${cores} ${cores === 1 ? "core" : "cores"}`,
    `More work is waiting than the ${cores} ${cores === 1 ? "core" : "cores"} can handle (load ${load[1].toFixed(1)}).`,
  );
}

/**
 * How much of the swap is in use, 0–100. Accepts either how much is used (`swapUsedB`, what the sampler reports) or how
 * much is free (`swapFreeB`, what /proc/meminfo reports) — and never returns NaN, whatever is missing.
 */
export function swapPercent(mem) {
  const total = Number(mem?.swapTotalB);
  if (!(total > 0)) return 0;
  const used = typeof mem.swapUsedB === "number" ? mem.swapUsedB : total - mem.swapFreeB;
  return Number.isFinite(used) ? clamp((used / total) * 100, 0, 100) : 0;
}

function memoryPart({ mem, swapRate }) {
  if (!mem || !mem.totalB) return null;
  const availablePct = (mem.availableB / mem.totalB) * 100;
  const swapPct = swapPercent(mem);
  let score = scaleUp(availablePct, [[4, 0], [12, 4], [25, 7], [40, 10]]);
  if (swapPct > 75) score -= 3;
  else if (swapPct > 50) score -= 2;
  else if (swapPct > 25) score -= 1;
  const swapping = (swapRate?.out ?? 0) > 100; // pages per second written to swap: the server is out of memory right now
  if (swapping) score -= 2;
  return part(
    "memory",
    "Memory",
    score,
    pct(100 - availablePct),
    `${pct(100 - availablePct)} in use, ${gb(mem.availableB)} still available${mem.swapTotalB ? ` · swap ${pct(swapPct)} used` : ""}`,
    `Memory is running low: only ${pct(availablePct)} (${gb(mem.availableB)}) is left${swapPct > 25 ? `, and ${pct(swapPct)} of swap is in use` : ""}${swapping ? ". The server is swapping right now, which slows everything down" : ""}.`,
  );
}

function diskSpacePart({ mounts }) {
  const big = (mounts ?? []).filter((m) => m.sizeB >= 1024 ** 3);
  const list = big.length ? big : (mounts ?? []);
  if (!list.length) return null;
  let worst = null;
  for (const m of list) {
    const freePct = (m.availB / Math.max(1, m.usedB + m.availB)) * 100;
    let score = scaleUp(freePct, [[3, 0], [10, 4], [20, 7], [35, 10]]);
    // a disk that is getting full AND has little room in absolute terms is worse than the percentage alone says —
    // but a small volume that is mostly empty (a 1.9 GB /boot at 79% free) is perfectly fine
    if (freePct < 25) {
      if (m.availB < 1024 ** 3) score = Math.min(score, 2);
      else if (m.availB < 3 * 1024 ** 3) score = Math.min(score, 5);
    }
    if (!worst || score < worst.score) worst = { score, m, freePct };
  }
  const usedPct = 100 - worst.freePct;
  return part(
    "disk",
    "Disk space",
    worst.score,
    pct(usedPct),
    `${worst.m.mount} is ${pct(usedPct)} full, ${gb(worst.m.availB)} left`,
    `${worst.m.mount} is ${pct(usedPct)} full — only ${gb(worst.m.availB)} left. Clear old logs or files before it fills up.`,
  );
}

function diskActivityPart({ cpu, diskBusy }) {
  if (diskBusy === null || diskBusy === undefined) return null;
  let score = scaleDown(diskBusy, [[40, 10], [70, 7], [90, 4], [100, 1]]);
  const wait = cpu?.iowait ?? 0;
  if (wait > 40) score -= 4;
  else if (wait > 20) score -= 2;
  return part(
    "diskio",
    "Disk activity",
    score,
    pct(diskBusy),
    `disk busy ${pct(diskBusy)} of the time${wait >= 1 ? ` · CPU waiting on it ${pct(wait)}` : ""}`,
    `The disk is very busy (${pct(diskBusy)} of the time)${wait > 20 ? `, and the CPU spends ${pct(wait)} of its time waiting for it` : ""}.`,
  );
}

function apiPart({ api }) {
  if (!api) return null;
  const db = api.dbOk === false ? 0 : api.dbMs === null || api.dbMs === undefined ? 10 : scaleDown(api.dbMs, [[100, 10], [250, 7], [600, 4], [2000, 0]]);
  const loop = api.loopP99Ms === null || api.loopP99Ms === undefined ? 10 : scaleDown(api.loopP99Ms, [[50, 10], [150, 7], [500, 4], [2000, 0]]);
  const failing = api.requests5m >= 20 ? scaleDown(api.errorPct5m, [[0.5, 10], [2, 7], [8, 4], [25, 0]]) : 10;
  const score = Math.min(db, loop, failing);
  const reasons = [];
  if (api.dbOk === false) reasons.push("The database isn't reachable.");
  else if (db < 7) reasons.push(`The database is slow to answer (${Math.round(api.dbMs)} ms).`);
  if (loop < 7) reasons.push(`The API is lagging: its event loop is delayed by ${Math.round(api.loopP99Ms)} ms.`);
  if (failing < 7) reasons.push(`${api.errorPct5m.toFixed(1)}% of requests in the last 5 minutes failed.`);
  return part(
    "api",
    "API & database",
    score,
    api.dbOk === false ? "no database" : api.dbMs == null ? "—" : `${Math.round(api.dbMs)} ms`,
    `database ${api.dbOk === false ? "not reachable" : api.dbMs == null ? "not measured yet" : `answers in ${Math.round(api.dbMs)} ms`} · API lag ${Math.round(api.loopP99Ms ?? 0)} ms${api.requests5m >= 20 ? ` · ${api.errorPct5m.toFixed(1)}% failed` : ""}`,
    reasons.join(" "),
  );
}

/* ------------------------------------------------------------------ overall */

/**
 * @param {object} m
 * @param {{used:number, iowait:number, steal:number}|null} m.cpu    averages over the last minute
 * @param {number[]|null} m.load        1/5/15-minute load averages
 * @param {number} m.cores
 * @param {object|null} m.mem            { totalB, availableB, swapTotalB, and swapUsedB or swapFreeB }
 * @param {{out:number}|null} m.swapRate pages/second swapped out
 * @param {object[]} m.mounts            [{ mount, sizeB, usedB, availB }]
 * @param {number|null} m.diskBusy       % of the last minute the disk was busy
 * @param {object|null} m.api            { dbOk, dbMs, loopP99Ms, requests5m, errorPct5m }
 */
export function scoreHealth(m) {
  const parts = [cpuPart(m), loadPart(m), memoryPart(m), diskSpacePart(m), diskActivityPart(m), apiPart(m)].filter(Boolean);
  if (parts.length === 0) return { ready: false, score: null, boxes: 0, level: null, label: "Measuring…", parts: [], reasons: [] };
  const average = parts.reduce((n, p) => n + p.score, 0) / parts.length;
  const worst = Math.min(...parts.map((p) => p.score));
  const score = round1(clamp(Math.min(average, worst + 3, worst < 7 ? 6.9 : 10), 0, 10));
  const level = levelOf(score);
  return {
    ready: true,
    score,
    boxes: boxesFor(score, level),
    level,
    label: LEVEL_LABEL[level],
    parts,
    reasons: parts
      .filter((p) => p.reason)
      .sort((a, b) => a.score - b.score)
      .map((p) => ({ id: p.id, label: p.label, level: p.level, text: p.reason })),
  };
}
