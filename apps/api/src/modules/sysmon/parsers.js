/**
 * Readers for what an operating system says about itself: the text files under
 * /proc on Linux, and the output of a few standard commands on macOS. Each one
 * takes the raw text and returns plain numbers — no file or process access
 * here, so every parser can be tested against a captured sample.
 */

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/* ---------------------------------------------------------------------- CPU */

/** `/proc/stat` → cumulative CPU time in clock ticks, for all CPUs together and for each core. */
export function parseCpuStat(text) {
  const rows = [];
  for (const line of String(text).split("\n")) {
    const m = /^(cpu\d*)\s+(.*)$/.exec(line);
    if (!m) continue;
    const f = m[2].trim().split(/\s+/).map(Number);
    // user nice system idle iowait irq softirq steal (guest time is already inside user)
    rows.push({ name: m[1], user: num(f[0]), nice: num(f[1]), system: num(f[2]), idle: num(f[3]), iowait: num(f[4]), irq: num(f[5]), softirq: num(f[6]), steal: num(f[7]) });
  }
  return { total: rows.find((r) => r.name === "cpu") ?? null, cores: rows.filter((r) => r.name !== "cpu") };
}

/** Node's `os.cpus()` (macOS and others) in the same shape as `parseCpuStat`. Times there are in milliseconds. */
export function cpuTicksFromOs(cpus) {
  const rows = cpus.map((c, i) => ({ name: `cpu${i}`, user: c.times.user, nice: c.times.nice, system: c.times.sys, idle: c.times.idle, iowait: 0, irq: c.times.irq, softirq: 0, steal: 0 }));
  const sum = (k) => rows.reduce((n, r) => n + r[k], 0);
  const total = { name: "cpu", user: sum("user"), nice: sum("nice"), system: sum("system"), idle: sum("idle"), iowait: 0, irq: sum("irq"), softirq: 0, steal: 0 };
  return { total, cores: rows };
}

/**
 * How the CPU's time was spent between two readings, as percentages that add up to 100:
 *   used (programs and the kernel working), iowait (idle, waiting on the disk),
 *   steal (taken by the host the virtual server runs on), idle.
 */
export function cpuShares(prev, next) {
  if (!prev || !next) return null;
  const d = (k) => Math.max(0, next[k] - prev[k]);
  const user = d("user") + d("nice");
  const system = d("system") + d("irq") + d("softirq");
  const idle = d("idle");
  const iowait = d("iowait");
  const steal = d("steal");
  const total = user + system + idle + iowait + steal;
  if (total <= 0) return null;
  const pct = (x) => Math.round((x / total) * 1000) / 10;
  return { used: pct(user + system), user: pct(user), system: pct(system), iowait: pct(iowait), steal: pct(steal), idle: pct(idle) };
}

/** `/proc/loadavg` → [1, 5, 15 minute load averages]. */
export function parseLoadavg(text) {
  const f = String(text).trim().split(/\s+/);
  return [num(f[0]), num(f[1]), num(f[2])];
}

/* ------------------------------------------------------------------- memory */

/** `/proc/meminfo` → bytes. "Available" is what programs could get without swapping — the honest "remaining". */
export function parseMeminfo(text) {
  const kb = {};
  for (const line of String(text).split("\n")) {
    const m = /^(\w+)(?:\(\w+\))?:\s+(\d+)/.exec(line);
    if (m) kb[m[1]] = Number(m[2]);
  }
  const bytes = (k) => (kb[k] ?? 0) * 1024;
  const totalB = bytes("MemTotal");
  const reclaimable = bytes("MemFree") + bytes("Buffers") + bytes("Cached");
  const availableB = Math.min(totalB, kb.MemAvailable !== undefined ? bytes("MemAvailable") : reclaimable);
  return {
    totalB,
    freeB: bytes("MemFree"),
    availableB,
    cacheB: bytes("Buffers") + bytes("Cached") + bytes("SReclaimable"),
    swapTotalB: bytes("SwapTotal"),
    swapFreeB: bytes("SwapFree"),
  };
}

/** macOS `vm_stat` → bytes. There is no "available" figure there; free + inactive + speculative pages is the usual stand-in. */
export function parseVmStat(text, totalB) {
  const page = Number(/page size of (\d+) bytes/.exec(text)?.[1]) || 4096;
  const pages = (label) => num(new RegExp(`^${label}:\\s+(\\d+)`, "m").exec(text)?.[1]) * page;
  const freeB = pages("Pages free");
  const reclaim = pages("Pages inactive") + pages("Pages speculative");
  return { totalB, freeB, availableB: Math.min(totalB, freeB + reclaim), cacheB: reclaim, swapTotalB: 0, swapFreeB: 0 };
}

/** macOS `sysctl -n vm.swapusage` → bytes ("total = 2048.00M  used = 1024.00M  free = 1024.00M"). */
export function parseSwapUsage(text) {
  const unit = { K: 1024, M: 1024 ** 2, G: 1024 ** 3 };
  const read = (label) => {
    const m = new RegExp(`${label} = ([\\d.]+)([KMG])`).exec(String(text));
    return m ? Number(m[1]) * unit[m[2]] : 0;
  };
  return { swapTotalB: read("total"), swapFreeB: read("free") };
}

/** `/proc/vmstat` → pages swapped in and out since boot. Rising numbers mean the server is short of memory right now. */
export function parseSwapIo(text) {
  const read = (key) => num(new RegExp(`^${key} (\\d+)`, "m").exec(String(text))?.[1]);
  return { swapIn: read("pswpin"), swapOut: read("pswpout") };
}

/* ------------------------------------------------------------------ network */

/** `/proc/net/dev` → bytes and packets per interface since boot. */
export function parseNetDev(text) {
  const out = [];
  for (const line of String(text).split("\n").slice(2)) {
    const m = /^\s*([^:]+):\s*(.*)$/.exec(line);
    if (!m) continue;
    const f = m[2].trim().split(/\s+/).map(Number);
    out.push({ name: m[1].trim(), rxBytes: num(f[0]), rxPackets: num(f[1]), rxErrs: num(f[2]), rxDrop: num(f[3]), txBytes: num(f[8]), txPackets: num(f[9]), txErrs: num(f[10]), txDrop: num(f[11]) });
  }
  return out;
}

/** macOS `netstat -ibn` → the same per-interface figures (one row per interface, from its `<Link#n>` line). */
export function parseNetstat(text) {
  const out = [];
  const seen = new Set();
  for (const line of String(text).split("\n").slice(1)) {
    if (!/<Link#\d+>/.test(line)) continue;
    const f = line.trim().split(/\s+/);
    const name = f[0];
    if (seen.has(name)) continue;
    seen.add(name);
    // the last seven columns are always: Ipkts Ierrs Ibytes Opkts Oerrs Obytes Coll (the address column may be empty)
    const tail = f.slice(-7).map(Number);
    out.push({ name, rxPackets: num(tail[0]), rxErrs: num(tail[1]), rxBytes: num(tail[2]), txPackets: num(tail[3]), txErrs: num(tail[4]), txBytes: num(tail[5]), rxDrop: 0, txDrop: 0 });
  }
  return out;
}

/** `/proc/net/sockstat` → open TCP connections. */
export function parseSockstat(text) {
  const tcp = /^TCP: inuse (\d+) orphan (\d+) tw (\d+) alloc (\d+)/m.exec(String(text));
  return { tcpInUse: num(tcp?.[1]), tcpWaiting: num(tcp?.[3]), tcpAllocated: num(tcp?.[4]) };
}

/* --------------------------------------------------------------------- disk */

/** Whole physical disks — not their partitions, loop devices, or LVM volumes (which would count the same bytes twice). */
const PHYSICAL_DISK = /^(sd[a-z]+|vd[a-z]+|xvd[a-z]+|hd[a-z]+|nvme\d+n\d+|mmcblk\d+)$/;
const VIRTUAL_DISK = /^(dm-\d+|md\d+)$/;

/** `/proc/diskstats` → cumulative reads, writes (bytes) and time busy, per disk. */
export function parseDiskstats(text) {
  const all = [];
  for (const line of String(text).split("\n")) {
    const f = line.trim().split(/\s+/);
    if (f.length < 14) continue;
    all.push({
      name: f[2],
      reads: num(f[3]),
      readBytes: num(f[5]) * 512, // the kernel counts in 512-byte sectors whatever the disk's own sector size
      writes: num(f[7]),
      writeBytes: num(f[9]) * 512,
      busyMs: num(f[12]),
    });
  }
  const physical = all.filter((d) => PHYSICAL_DISK.test(d.name));
  return physical.length ? physical : all.filter((d) => VIRTUAL_DISK.test(d.name));
}

/** `df -kP` → one row per mounted filesystem, in kilobytes. */
export function parseDf(text) {
  const out = [];
  for (const line of String(text).split("\n").slice(1)) {
    const m = /^(\S+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)%\s+(.+)$/.exec(line.trim());
    if (!m) continue;
    out.push({ filesystem: m[1], sizeKb: Number(m[2]), usedKb: Number(m[3]), availKb: Number(m[4]), mount: m[6] });
  }
  return out;
}

/** Only real disks worth watching: block devices of a useful size, not snaps/loops/tmpfs or macOS's extra system volumes. */
export function realMounts(rows) {
  const kept = rows.filter(
    (r) =>
      r.filesystem.startsWith("/dev/") &&
      !r.filesystem.startsWith("/dev/loop") &&
      r.sizeKb >= 500 * 1024 &&
      !/^\/System\/Volumes\/(?!Data$)/.test(r.mount) &&
      !r.mount.startsWith("/private/var/vm") &&
      !r.mount.startsWith("/Library/Developer") &&
      !r.mount.startsWith("/snap/"),
  );
  // on a Mac the system volume "/" and the data volume are one disk showing twice
  return kept.some((r) => r.mount === "/System/Volumes/Data") ? kept.filter((r) => r.mount !== "/") : kept;
}

/* ---------------------------------------------------------------- processes */

/** `/proc/<pid>/stat` → CPU time and memory. The name sits in parentheses and may itself contain spaces and brackets. */
export function parseProcStat(text) {
  const s = String(text);
  const open = s.indexOf("(");
  const close = s.lastIndexOf(")");
  if (open < 0 || close < open) return null;
  const f = s.slice(close + 2).trim().split(/\s+/);
  return {
    pid: num(s.slice(0, open)),
    comm: s.slice(open + 1, close),
    state: f[0],
    ppid: num(f[1]),
    cpuTicks: num(f[11]) + num(f[12]), // user + system
    threads: num(f[17]),
    startTicks: num(f[19]),
    rssPages: num(f[21]),
  };
}

/** `/proc/<pid>/io` → bytes the process has really read from / written to storage. */
export function parseProcIo(text) {
  const read = (key) => num(new RegExp(`^${key}: (\\d+)`, "m").exec(String(text))?.[1]);
  return { readBytes: read("read_bytes"), writeBytes: read("write_bytes") };
}

/** `ps -axo pid=,rss=,pcpu=,etime=,user=,args=` → rows (used on macOS). */
export function parsePs(text) {
  const out = [];
  for (const line of String(text).split("\n")) {
    const m = /^\s*(\d+)\s+(\d+)\s+([\d.]+)\s+(\S+)\s+(\S+)\s+(.*)$/.exec(line);
    if (m) out.push({ pid: Number(m[1]), rssBytes: Number(m[2]) * 1024, cpuPct: Number(m[3]), uptimeSec: etimeToSeconds(m[4]), user: m[5], args: m[6] });
  }
  return out;
}

/** "266-12:21:18" / "02:52:44" / "29:17" → seconds. */
export function etimeToSeconds(etime) {
  const m = /^(?:(\d+)-)?(?:(\d+):)?(\d+):(\d+)$/.exec(String(etime));
  if (!m) return 0;
  return num(m[1]) * 86400 + num(m[2]) * 3600 + num(m[3]) * 60 + num(m[4]);
}

/** Command lines can carry secrets (--password, tokens, user:pass@host). Hide the value, keep the shape. */
export function redactArgs(text, max = 140) {
  return String(text)
    .replace(/(--?(?:password|passwd|pass|pwd|token|secret|api[-_]?key|apikey|key|auth|credentials?)[=\s]+)(\S+)/gi, "$1•••")
    .replace(/\b([A-Z][A-Z0-9_]*(?:PASSWORD|TOKEN|SECRET|KEY)[A-Z0-9_]*=)(\S+)/g, "$1•••")
    .replace(/(\/\/[^\s:@/]+:)([^\s@/]+)(@)/g, "$1•••$3")
    .slice(0, max);
}

/** A readable name for a process: "nginx: worker process", "systemd-journald", "node server.js". */
export function processName(comm, args) {
  const a = String(args ?? "").trim();
  if (!a) return `[${comm}]`; // a kernel thread: it has no command line
  const base = (p) => p.split("/").pop();
  const tokens = a.split(/\s+/);
  if (/^(node|nodejs)$/.test(base(tokens[0]))) {
    const script = tokens.slice(1).find((t) => !t.startsWith("-"));
    return script ? `node ${script.split("/").slice(-2).join("/")}` : "node";
  }
  // a process that renamed itself ("nginx: master process …", "PM2 v5.3.1: God Daemon (/root/.pm2)")
  if (!a.startsWith("/") && a.indexOf(": ") > 0 && a.indexOf(": ") < 40) return a.replace(/\s*\(.*\)\s*$/, "").slice(0, 60);
  return base(tokens[0].replace(/:$/, "")) || comm;
}

/* ------------------------------------------------------------------ the rest */

/** `/etc/os-release` → "Ubuntu 22.04.5 LTS". */
export function parseOsRelease(text) {
  return /^PRETTY_NAME="?([^"\n]+)"?/m.exec(String(text))?.[1] ?? null;
}

/** `/etc/passwd` → { uid: name }. */
export function parsePasswd(text) {
  const map = new Map();
  for (const line of String(text).split("\n")) {
    const f = line.split(":");
    if (f.length >= 3 && f[0]) map.set(Number(f[2]), f[0]);
  }
  return map;
}

/**
 * `pm2 jlist` → the apps pm2 manages. Only a handful of safe fields are kept: the raw output
 * carries every app's whole environment, secrets included, and must never be passed on.
 */
export function parsePm2(text, now = Date.now()) {
  const s = String(text);
  // pm2 may print a notice or two before the JSON; the list starts at the first "[" that opens an array of objects
  const start = /\[\s*[{\]]/.exec(s)?.index ?? -1;
  if (start < 0) return [];
  let list;
  try {
    list = JSON.parse(s.slice(start));
  } catch {
    return [];
  }
  return list.map((app) => {
    const online = app.pm2_env?.status === "online";
    const since = Number(app.pm2_env?.pm_uptime);
    return {
      id: app.pm_id,
      name: String(app.name ?? ""),
      pid: online ? Number(app.pid) || null : null,
      status: String(app.pm2_env?.status ?? "unknown"),
      restarts: num(app.pm2_env?.restart_time),
      uptimeSec: online && since ? Math.max(0, Math.round((now - since) / 1000)) : 0,
      cpuPct: num(app.monit?.cpu),
      memoryB: num(app.monit?.memory),
    };
  });
}
