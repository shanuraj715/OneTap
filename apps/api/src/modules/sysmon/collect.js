import { execFile } from "node:child_process";
import { access, readdir, readFile, stat } from "node:fs/promises";
import os from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import * as P from "./parsers.js";

/**
 * Reads the machine. Everything here only LOOKS — files under /proc and a few
 * standard read-only commands — and every read tolerates failure: a container
 * without /proc/diskstats, a Mac without /proc at all, or a missing command just
 * leaves that figure empty instead of breaking the page.
 */

const run = promisify(execFile);
const ONE_MB = 1024 * 1024;

const text = async (path) => {
  try {
    return await readFile(path, "utf8");
  } catch {
    return "";
  }
};

/** Run a command; on a non-zero exit (du does that when it can't read a folder) keep whatever it printed. */
export async function exec(cmd, args = [], { timeout = 5000, maxBuffer = 16 * ONE_MB } = {}) {
  try {
    return (await run(cmd, args, { timeout, maxBuffer })).stdout;
  } catch (err) {
    return typeof err.stdout === "string" ? err.stdout : "";
  }
}

/** Map over a list with a cap on how many run at once. */
export async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

/* -------------------------------------------------------------- the machine */

let staticInfo = null;

/** What the machine is — read once. */
export async function readStaticInfo() {
  if (staticInfo) return staticInfo;
  const cpus = os.cpus();
  let osName = `${os.type()} ${os.release()}`;
  if (process.platform === "linux") osName = P.parseOsRelease(await text("/etc/os-release")) ?? osName;
  else if (process.platform === "darwin") {
    const version = (await exec("sw_vers", ["-productVersion"])).trim();
    if (version) osName = `macOS ${version}`;
  }
  const [pageSize, clockTicks] =
    process.platform === "linux"
      ? await Promise.all([exec("getconf", ["PAGESIZE"]), exec("getconf", ["CLK_TCK"])]).then(([p, c]) => [Number(p) || 4096, Number(c) || 100])
      : [4096, 100];
  staticInfo = {
    hostname: os.hostname(),
    platform: process.platform,
    osName,
    kernel: os.release(),
    arch: os.arch(),
    cpuModel: (cpus[0]?.model ?? "").replace(/\s+/g, " ").trim(),
    cores: cpus.length || 1,
    nodeVersion: process.version,
    pageSize,
    clockTicks,
  };
  return staticInfo;
}

/** One raw reading of the whole machine. Counters here only ever grow; the monitor turns two readings into rates. */
export async function readSystem() {
  const at = Date.now();
  if (process.platform === "linux") {
    const [stat, meminfo, load, netdev, diskstats, vmstat, sockstat] = await Promise.all(
      ["/proc/stat", "/proc/meminfo", "/proc/loadavg", "/proc/net/dev", "/proc/diskstats", "/proc/vmstat", "/proc/net/sockstat"].map(text),
    );
    const disks = P.parseDiskstats(diskstats);
    return {
      at,
      cpu: stat ? P.parseCpuStat(stat) : P.cpuTicksFromOs(os.cpus()),
      mem: meminfo ? P.parseMeminfo(meminfo) : fallbackMemory(),
      load: load ? P.parseLoadavg(load) : os.loadavg(),
      net: P.parseNetDev(netdev),
      disks: disks.length ? disks : null,
      swapIo: vmstat ? P.parseSwapIo(vmstat) : null,
      tcp: sockstat ? P.parseSockstat(sockstat) : null,
    };
  }
  if (process.platform === "darwin") {
    const [vm, swap, netstat] = await Promise.all([exec("vm_stat"), exec("sysctl", ["-n", "vm.swapusage"]), exec("netstat", ["-ibn"])]);
    return {
      at,
      cpu: P.cpuTicksFromOs(os.cpus()),
      mem: vm ? { ...P.parseVmStat(vm, os.totalmem()), ...P.parseSwapUsage(swap) } : fallbackMemory(),
      load: os.loadavg(),
      net: P.parseNetstat(netstat),
      disks: null, // macOS has no per-disk counters we can read without extra tools
      swapIo: null,
      tcp: null,
    };
  }
  return { at, cpu: P.cpuTicksFromOs(os.cpus()), mem: fallbackMemory(), load: os.loadavg(), net: [], disks: null, swapIo: null, tcp: null };
}

function fallbackMemory() {
  return { totalB: os.totalmem(), freeB: os.freemem(), availableB: os.freemem(), cacheB: 0, swapTotalB: 0, swapFreeB: 0 };
}

/** The real disks and how full they are. */
export async function readMounts() {
  const rows = P.realMounts(P.parseDf(await exec("df", ["-kP"])));
  return rows.map((r) => ({ mount: r.mount, device: r.filesystem, sizeB: r.sizeKb * 1024, usedB: r.usedKb * 1024, availB: r.availKb * 1024 }));
}

/* ---------------------------------------------------------------- processes */

let passwd = { at: 0, map: new Map() };
async function userOf(uid) {
  if (Date.now() - passwd.at > 300_000) passwd = { at: Date.now(), map: P.parsePasswd(await text("/etc/passwd")) };
  return passwd.map.get(uid) ?? String(uid);
}

/**
 * Every process, with the memory it holds and the CPU time and disk traffic it has used so far. Two such readings
 * a moment apart give what each is using NOW. Per-process disk figures need to be root (or the same user).
 */
export async function readProcesses() {
  const info = await readStaticInfo();
  const at = Date.now();
  if (process.platform === "linux") {
    const pids = (await readdir("/proc").catch(() => [])).filter((n) => /^\d+$/.test(n));
    const rows = await mapLimit(pids, 48, async (n) => {
      const st = P.parseProcStat(await text(`/proc/${n}/stat`));
      if (!st) return null;
      const [cmd, io, owner] = await Promise.all([text(`/proc/${n}/cmdline`), text(`/proc/${n}/io`), stat(`/proc/${n}`).catch(() => null)]);
      const args = cmd.replace(/\0+$/, "").replace(/\0/g, " ").trim();
      if (!args && st.rssPages === 0) return null; // a kernel thread: no memory, no command line
      return {
        pid: st.pid,
        name: P.processName(st.comm, args),
        args: P.redactArgs(args),
        user: owner ? await userOf(owner.uid) : "?",
        rssBytes: st.rssPages * info.pageSize,
        cpuTicks: st.cpuTicks,
        startTicks: st.startTicks,
        threads: st.threads,
        io: io ? P.parseProcIo(io) : null,
      };
    });
    return { at, source: "linux", rows: rows.filter(Boolean) };
  }
  // macOS and others: `ps` already gives a recent CPU figure; there are no per-process disk counters
  const out = await exec("ps", ["-axo", "pid=,rss=,pcpu=,etime=,user=,args="], { maxBuffer: 32 * ONE_MB });
  const rows = P.parsePs(out).map((p) => ({
    pid: p.pid,
    name: P.processName(p.args.split(/\s+/)[0].split("/").pop(), p.args),
    args: P.redactArgs(p.args),
    user: p.user,
    rssBytes: p.rssBytes,
    cpuNowPct: Math.min(100, p.cpuPct / info.cores), // ps counts one full core as 100
    uptimeSec: p.uptimeSec,
    io: null,
  }));
  return { at, source: process.platform, rows };
}

/* -------------------------------------------------------------------- pm2 */

let pm2Cache = { at: 0, value: { available: false, apps: [] } };

/**
 * The apps pm2 manages on this machine (name, status, restarts, memory…) — only if pm2's background
 * process is already running: asking pm2 when it isn't would START it. Cached for 15 seconds.
 */
export async function readPm2() {
  if (Date.now() - pm2Cache.at < 15_000) return pm2Cache.value;
  let value = { available: false, apps: [] };
  try {
    const pidFile = join(process.env.PM2_HOME ?? join(os.homedir(), ".pm2"), "pm2.pid");
    const pid = Number((await readFile(pidFile, "utf8")).trim());
    process.kill(pid, 0); // throws if that process isn't there
    // `pm2` on the PATH first; under nvm the API's PATH may not include it, but it lives next to the node binary running the API
    let apps = [];
    for (const cmd of ["pm2", join(dirname(process.execPath), "pm2"), "/usr/local/bin/pm2", "/usr/bin/pm2"]) {
      apps = P.parsePm2(await exec(cmd, ["jlist"], { timeout: 8000, maxBuffer: 32 * ONE_MB }));
      if (apps.length) break;
    }
    value = { available: apps.length > 0, apps };
  } catch {
    /* no pm2 here */
  }
  pm2Cache = { at: Date.now(), value };
  return value;
}

/* ------------------------------------------------------------------ folders */

/** Folders worth measuring on a server: where apps, logs, caches and home directories live. */
const DEFAULT_ROOTS = ["/var/www", "/root", "/home", "/opt", "/srv", "/var/log", "/var/lib", "/var/cache", "/usr/local", "/tmp"];

export async function existingScanRoots() {
  const wanted = (process.env.SYSMON_SCAN_ROOTS ? process.env.SYSMON_SCAN_ROOTS.split(",") : [...DEFAULT_ROOTS, os.homedir()]).map((r) => r.trim()).filter(Boolean);
  const found = [];
  for (const root of [...new Set(wanted)]) {
    try {
      if ((await stat(root)).isDirectory()) found.push(root);
    } catch {
      /* not on this machine */
    }
  }
  return found;
}

/** Size of every folder directly inside each root, in bytes (one pass of `du`, at the lowest priority so it never competes with real work). */
export async function measureFolders(roots, { timeout = 90_000 } = {}) {
  const idle = process.platform === "linux" && (await access("/usr/bin/ionice").then(() => true, () => false)) ? ["ionice", "-c3"] : [];
  const out = await exec("nice", ["-n", "19", ...idle, "du", "-x", "-k", "-d", "1", "--", ...roots], { timeout, maxBuffer: 64 * ONE_MB });
  const isRoot = new Set(roots);
  const children = [];
  const totals = [];
  for (const line of out.split("\n")) {
    const m = /^(\d+)\s+(.+)$/.exec(line);
    if (!m) continue;
    const row = { path: m[2], sizeB: Number(m[1]) * 1024 };
    (isRoot.has(row.path) ? totals : children).push(row);
  }
  children.sort((a, b) => b.sizeB - a.sizeB);
  return { folders: children, roots: totals.sort((a, b) => b.sizeB - a.sizeB) };
}
