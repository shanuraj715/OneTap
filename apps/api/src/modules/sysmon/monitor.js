import os from "node:os";
import { monitorEventLoopDelay, performance } from "node:perf_hooks";
import { mongoose } from "@onetap/db";
import { cache } from "../cache/cache.js";
import { existingScanRoots, measureFolders, readMounts, readPm2, readProcesses, readStaticInfo, readSystem } from "./collect.js";
import { scoreHealth } from "./health.js";
import { cpuShares } from "./parsers.js";
import { requestStatsSince, requestSummary } from "./request-stats.js";

/**
 * The server monitor.
 *
 * Every few seconds it takes one reading of the machine (a handful of tiny file reads — no database, no
 * commands) and turns two consecutive readings into rates: CPU %, network and disk speed, swapping. The last
 * hour is kept in memory so the page can draw history straight away. Nothing here touches the database except a
 * one-off ping, made only while someone is looking at the page.
 *
 * Everything describes the machine THIS API runs on.
 */

const state = {
  timer: null,
  loop: null,
  intervalMs: 5000,
  keep: 720, // one hour at 5 s
  chain: Promise.resolve(),
  prev: null,
  latest: null,
  ring: [],
  startedAt: Date.now(),
  priming: null,
  apiPrev: null,
  procPrev: null,
  mounts: { at: 0, value: [] },
  db: { at: 0, value: null },
  folders: { state: "idle", startedAt: null, finishedAt: null, folders: [], roots: [], error: null },
};

const round1 = (v) => Math.round(v * 10) / 10;
const grow = (a, b) => Math.max(0, b - a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const avg = (list) => (list.length ? list.reduce((n, v) => n + v, 0) / list.length : 0);

/* ----------------------------------------------------------------- deriving */

/** Network cards worth counting: the real ones, not loopback, containers or tunnels. */
function pickNics(net) {
  const real = net.filter((n) => /^(eth\d+|ens\w+|enp\w+|eno\w+|enx\w+|em\d+|wlan\d+|wlp\w+|bond\d+|en\d+)$/.test(n.name));
  if (real.length) return real;
  return net.filter((n) => !/^(lo\d*|docker\d*|veth\w*|br-\w+|virbr\d+|tun\d+|tap\d+|gif\d+|stf\d+|utun\d+|awdl\d+|llw\d+|anpi\d+)\*?$/.test(n.name));
}

function deriveNet(prev, raw, dt) {
  const before = new Map(prev.net.map((n) => [n.name, n]));
  const interfaces = pickNics(raw.net).map((n) => {
    const p = before.get(n.name);
    return {
      name: n.name,
      rxBps: p ? grow(p.rxBytes, n.rxBytes) / dt : 0,
      txBps: p ? grow(p.txBytes, n.txBytes) / dt : 0,
      rxTotalB: n.rxBytes,
      txTotalB: n.txBytes,
      rxErrs: n.rxErrs,
      txErrs: n.txErrs,
      rxDrop: n.rxDrop,
      txDrop: n.txDrop,
    };
  });
  const sum = (k) => interfaces.reduce((n, i) => n + i[k], 0);
  return { interfaces, rxBps: sum("rxBps"), txBps: sum("txBps"), rxTotalB: sum("rxTotalB"), txTotalB: sum("txTotalB"), errors: sum("rxErrs") + sum("txErrs") };
}

function deriveDisk(prev, raw, dt) {
  if (!raw.disks) return null;
  const before = new Map((prev.disks ?? []).map((d) => [d.name, d]));
  const out = { readBps: 0, writeBps: 0, readIops: 0, writeIops: 0, busyPct: 0, totalReadB: 0, totalWrittenB: 0 };
  for (const d of raw.disks) {
    out.totalReadB += d.readBytes;
    out.totalWrittenB += d.writeBytes;
    const p = before.get(d.name);
    if (!p) continue;
    out.readBps += grow(p.readBytes, d.readBytes) / dt;
    out.writeBps += grow(p.writeBytes, d.writeBytes) / dt;
    out.readIops += grow(p.reads, d.reads) / dt;
    out.writeIops += grow(p.writes, d.writes) / dt;
    out.busyPct = Math.max(out.busyPct, Math.min(100, (grow(p.busyMs, d.busyMs) / (dt * 1000)) * 100)); // the busiest disk
  }
  out.busyPct = round1(out.busyPct);
  return out;
}

/** This API process: its own CPU, memory and how far behind its event loop is running. */
function readApi(dt, cores) {
  const cpuNow = process.cpuUsage();
  let cpuPct = null;
  if (state.apiPrev && dt > 0) {
    const used = (cpuNow.user - state.apiPrev.user + (cpuNow.system - state.apiPrev.system)) / 1e6;
    cpuPct = round1(Math.min(100, (used / dt / cores) * 100));
  }
  state.apiPrev = cpuNow;
  const mem = process.memoryUsage();
  const ms = (ns) => round1(ns / 1e6);
  const h = state.loop;
  const loop = h ? { p50: ms(h.percentile(50)), p99: ms(h.percentile(99)), max: ms(h.max) } : { p50: 0, p99: 0, max: 0 };
  h?.reset();
  return { cpuPct, rssB: mem.rss, heapUsedB: mem.heapUsed, heapTotalB: mem.heapTotal, externalB: mem.external, loop };
}

function derive(prev, raw, info) {
  const dt = (raw.at - prev.at) / 1000;
  if (dt < 0.2) return null;
  const cpu = cpuShares(prev.cpu.total, raw.cpu.total);
  if (!cpu) return null;
  const swapRate = raw.swapIo && prev.swapIo ? { in: grow(prev.swapIo.swapIn, raw.swapIo.swapIn) / dt, out: grow(prev.swapIo.swapOut, raw.swapIo.swapOut) / dt } : null;
  const m = raw.mem;
  const usedB = Math.max(0, m.totalB - m.availableB);
  return {
    t: raw.at,
    dt,
    cpu,
    perCore: raw.cpu.cores.map((c, i) => cpuShares(prev.cpu.cores[i], c)?.used ?? null),
    load: raw.load,
    mem: {
      totalB: m.totalB,
      usedB,
      availableB: m.availableB,
      freeB: m.freeB,
      cacheB: m.cacheB,
      usedPct: m.totalB ? round1((usedB / m.totalB) * 100) : 0,
      swapTotalB: m.swapTotalB,
      swapUsedB: Math.max(0, m.swapTotalB - m.swapFreeB),
      swapUsedPct: m.swapTotalB ? round1(((m.swapTotalB - m.swapFreeB) / m.swapTotalB) * 100) : 0,
    },
    swapRate,
    net: deriveNet(prev, raw, dt),
    disk: deriveDisk(prev, raw, dt),
    tcp: raw.tcp,
    api: readApi(dt, info.cores),
  };
}

/** The small version kept for the history charts. */
function compact(s) {
  return {
    t: s.t,
    cpu: s.cpu.used,
    wait: s.cpu.iowait,
    steal: s.cpu.steal,
    mem: s.mem.usedPct,
    swap: s.mem.swapUsedPct,
    swo: round1(s.swapRate?.out ?? 0),
    rx: Math.round(s.net.rxBps),
    tx: Math.round(s.net.txBps),
    rxT: s.net.rxTotalB,
    txT: s.net.txTotalB,
    rd: s.disk ? Math.round(s.disk.readBps) : null,
    wr: s.disk ? Math.round(s.disk.writeBps) : null,
    busy: s.disk ? s.disk.busyPct : null,
    load: s.load[0],
    rss: s.api.rssB,
    lag: s.api.loop.p99,
  };
}

/* -------------------------------------------------------------------- loop */

/** One reading, one rate calculation. Readings are queued so two can never overlap. */
export function sampleNow() {
  const run = async () => {
    const info = await readStaticInfo();
    const raw = await readSystem();
    const prev = state.prev;
    state.prev = raw;
    if (!prev) return null;
    const s = derive(prev, raw, info);
    if (!s) return null;
    state.latest = s;
    state.ring.push(compact(s));
    if (state.ring.length > state.keep) state.ring.splice(0, state.ring.length - state.keep);
    return s;
  };
  const next = state.chain.then(run, run);
  state.chain = next.catch(() => {});
  return next;
}

/** Begin sampling. Safe to call more than once. The timer never keeps the process alive. */
export function startServerMonitor({ intervalMs = 5000, keep = 720 } = {}) {
  if (state.timer) return;
  state.intervalMs = intervalMs;
  state.keep = keep;
  state.loop = monitorEventLoopDelay({ resolution: 20 });
  state.loop.enable();
  void sampleNow().catch(() => {});
  state.timer = setInterval(() => void sampleNow().catch(() => {}), intervalMs);
  state.timer.unref();
}

export function stopServerMonitor() {
  clearInterval(state.timer);
  state.loop?.disable();
  Object.assign(state, { timer: null, loop: null, prev: null, latest: null, ring: [], apiPrev: null, procPrev: null, priming: null });
}

/** Make sure there are readings to show: right after the API starts there is nothing to compare yet. */
async function ensureReady() {
  startServerMonitor();
  if (state.latest) return;
  state.priming ??= (async () => {
    await sampleNow();
    await sleep(700);
    await sampleNow();
  })().finally(() => {
    state.priming = null;
  });
  await state.priming;
}

/* ------------------------------------------------------------------ pieces */

async function getMounts() {
  if (Date.now() - state.mounts.at > 20_000) state.mounts = { at: Date.now(), value: await readMounts() };
  return state.mounts.value;
}

/** How long the database takes to answer a ping — only measured while the page is open, and at most every 5 seconds. */
export async function pingDatabase() {
  if (state.db.value && Date.now() - state.db.at < 4500) return state.db.value;
  const started = performance.now();
  let value;
  try {
    if (mongoose.connection.readyState !== 1) throw new Error("not connected");
    await Promise.race([mongoose.connection.db.admin().ping(), sleep(3000).then(() => Promise.reject(new Error("timed out after 3 s")))]);
    value = { ok: true, ms: round1(performance.now() - started), error: null };
  } catch (err) {
    value = { ok: false, ms: null, error: String(err.message).slice(0, 120) };
  }
  state.db = { at: Date.now(), value };
  return value;
}

/** Averages over the most recent readings (12 × 5 s = the last minute). */
function recent(n = 12) {
  const r = state.ring.slice(-n);
  const nums = (k) => r.map((x) => x[k]).filter((v) => typeof v === "number");
  return {
    n: r.length,
    cpu: r.length ? { used: avg(nums("cpu")), iowait: avg(nums("wait")), steal: avg(nums("steal")) } : null,
    busy: nums("busy").length ? avg(nums("busy")) : null,
    swapOut: nums("swo").length ? Math.max(...nums("swo")) : 0,
    loopP99: nums("lag").length ? Math.max(...nums("lag")) : 0,
  };
}

/* -------------------------------------------------------------- the snapshot */

/** Everything the Server page shows that changes second by second (without the process list). */
export async function serverSnapshot() {
  await ensureReady();
  const [info, mounts, db] = await Promise.all([readStaticInfo(), getMounts(), pingDatabase()]);
  const s = state.latest;
  const win = recent(12);
  const req5 = requestSummary(5);
  const req60 = requestSummary(60);
  const first = state.ring[0];
  const last = state.ring.at(-1);

  const health = scoreHealth({
    cpu: win.cpu,
    load: s?.load ?? null,
    cores: info.cores,
    mem: s?.mem ?? null,
    swapRate: { out: win.swapOut },
    mounts,
    diskBusy: win.busy,
    api: { dbOk: db.ok, dbMs: db.ms, loopP99Ms: win.loopP99, requests5m: req5.requests, errorPct5m: req5.errorPct },
  });

  const mountRows = mounts.map((m) => ({ ...m, usedPct: round1((m.usedB / Math.max(1, m.usedB + m.availB)) * 100), availPct: round1((m.availB / Math.max(1, m.usedB + m.availB)) * 100) }));
  return {
    at: Date.now(),
    ready: Boolean(s),
    machine: { ...info, uptimeSec: Math.round(os.uptime()), bootedAt: new Date(Date.now() - os.uptime() * 1000).toISOString() },
    sampler: { intervalMs: state.intervalMs, samples: state.ring.length, sinceMs: Date.now() - state.startedAt },
    cpu: s ? { ...s.cpu, remaining: s.cpu.idle, cores: info.cores, perCore: s.perCore, load: s.load, loadPerCore: round1(s.load[1] / info.cores) } : null,
    memory: s?.mem ?? null,
    swapRate: s?.swapRate ?? null,
    disk: { mounts: mountRows, io: s?.disk ?? null },
    network: s
      ? {
          ...s.net,
          tcp: s.tcp,
          window: first && last && last.t > first.t ? { minutes: Math.round((last.t - first.t) / 6000) / 10, rxB: grow(first.rxT, last.rxT), txB: grow(first.txT, last.txT) } : null,
        }
      : null,
    api: {
      pid: process.pid,
      nodeVersion: process.version,
      uptimeSec: Math.round(process.uptime()),
      ...(s?.api ?? {}),
      db,
      cache: (({ entries, hitRate, bytes }) => ({ entries, hitRate, bytes }))(cache.stats()),
      requests: { last5min: req5, lastHour: req60, since: requestStatsSince() },
    },
    health,
  };
}

/** The last stretch of history for the charts, thinned to at most `max` points. */
export async function serverHistory(minutes = 30, max = 240) {
  await ensureReady();
  const from = Date.now() - minutes * 60_000;
  const all = state.ring.filter((p) => p.t >= from);
  const stride = Math.max(1, Math.ceil(all.length / max));
  return { intervalMs: state.intervalMs * stride, points: all.filter((_, i) => i % stride === (all.length - 1) % stride) };
}

/* ---------------------------------------------------------------- processes */

/**
 * The biggest users of memory, CPU and disk right now. CPU and disk speed come from comparing two readings,
 * so the first call waits half a second to take the second one.
 */
export async function processSnapshot() {
  await ensureReady();
  const info = await readStaticInfo();
  let cur = await readProcesses();
  let base = state.procPrev;
  if (!base || cur.at - base.at < 1000 || cur.at - base.at > 120_000) {
    base = cur;
    await sleep(500);
    cur = await readProcesses();
  }
  state.procPrev = cur;
  const seconds = Math.max(0.1, (cur.at - base.at) / 1000);
  const before = new Map(base.rows.map((r) => [`${r.pid}:${r.startTicks ?? 0}`, r]));
  const totalMem = os.totalmem();
  const ioKnown = cur.rows.some((r) => r.io);

  const [pm2, uptimeNow] = [await readPm2(), os.uptime()];
  const appByPid = new Map(pm2.apps.filter((a) => a.pid).map((a) => [a.pid, a.name]));

  const rows = cur.rows.map((r) => {
    const p = before.get(`${r.pid}:${r.startTicks ?? 0}`);
    const cpuPct =
      r.cpuTicks !== undefined
        ? p
          ? Math.min(100, ((grow(p.cpuTicks, r.cpuTicks) / info.clockTicks / seconds) * 100) / info.cores)
          : 0
        : (r.cpuNowPct ?? 0);
    const readBps = r.io && p?.io ? grow(p.io.readBytes, r.io.readBytes) / seconds : null;
    const writeBps = r.io && p?.io ? grow(p.io.writeBytes, r.io.writeBytes) / seconds : null;
    return {
      pid: r.pid,
      name: r.name,
      app: appByPid.get(r.pid) ?? null,
      args: r.args,
      user: r.user,
      rssBytes: r.rssBytes,
      memPct: round1((r.rssBytes / totalMem) * 100),
      cpuPct: round1(cpuPct),
      threads: r.threads ?? null,
      readBps,
      writeBps,
      readTotalB: r.io?.readBytes ?? null,
      writeTotalB: r.io?.writeBytes ?? null,
      uptimeSec: r.uptimeSec ?? (r.startTicks !== undefined ? Math.max(0, Math.round(uptimeNow - r.startTicks / info.clockTicks)) : null),
    };
  });

  const top = (list, n) => list.slice(0, n);
  const byMem = [...rows].sort((a, b) => b.rssBytes - a.rssBytes);
  const byCpu = [...rows].filter((r) => r.cpuPct > 0).sort((a, b) => b.cpuPct - a.cpuPct);
  const byIo = [...rows].filter((r) => r.readTotalB !== null).sort((a, b) => (b.readBps ?? 0) + (b.writeBps ?? 0) - ((a.readBps ?? 0) + (a.writeBps ?? 0)) || b.readTotalB + b.writeTotalB - (a.readTotalB + a.writeTotalB));
  const keep = new Map();
  for (const r of [...top(byMem, 12), ...top(byCpu, 12), ...top(byIo, 12)]) keep.set(r.pid, r);

  return {
    at: cur.at,
    windowSeconds: round1(seconds),
    total: rows.length,
    threads: rows.reduce((n, r) => n + (r.threads ?? 0), 0),
    diskActivityAvailable: ioKnown,
    processes: [...keep.values()],
    apps: pm2.available ? pm2.apps.map((a) => ({ ...a, memPct: round1((a.memoryB / totalMem) * 100) })) : null,
  };
}

/* ------------------------------------------------------------------ folders */

export const folderScanState = () => state.folders;

/** Start measuring folders in the background (one at a time). Poll `folderScanState()` for the result. */
export function startFolderScan() {
  if (state.folders.state === "running") return state.folders;
  state.folders = { state: "running", startedAt: Date.now(), finishedAt: null, folders: [], roots: [], error: null };
  void (async () => {
    try {
      const roots = await existingScanRoots();
      if (!roots.length) throw new Error("There are no folders to measure on this machine.");
      const [{ folders, roots: totals }, mounts] = await Promise.all([measureFolders(roots), getMounts()]);
      const usedB = mounts.find((m) => m.mount === "/")?.usedB ?? mounts[0]?.usedB ?? null;
      state.folders = {
        state: "done",
        startedAt: state.folders.startedAt,
        finishedAt: Date.now(),
        error: null,
        diskUsedB: usedB,
        roots: totals,
        folders: folders.slice(0, 25).map((f) => ({ ...f, pctOfDisk: usedB ? round1((f.sizeB / usedB) * 100) : null })),
      };
    } catch (err) {
      state.folders = { state: "error", startedAt: state.folders.startedAt, finishedAt: Date.now(), folders: [], roots: [], error: String(err.message).slice(0, 200) };
    }
  })();
  return state.folders;
}
