import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Activity, CheckCircle2, CircleX, FolderSearch, Pause, Play, Server, TriangleAlert } from "lucide-react";
import * as api from "../../lib/api";
import { useFolderScan, useServer, useServerHistory, useServerProcesses } from "../../lib/usePlatform";
import { Button, Card, Empty, PageHeader, Pill, Table, Tabs, Td, Th } from "../../ui";
import { HealthBoxes, LevelLabel } from "./ServerParts";
import { Figure, Legend, LineChart, Meter, SegmentedBar } from "./viz/charts";
import { ago, clock, clockSeconds, count, mbit, percent, rate, sizeAuto, sizeBoth, uptime } from "./viz/format";
import { muted } from "./shared";

/**
 * Everything about the machine this API runs on: how healthy it is (0–10), and the CPU, memory, disk, network
 * and processes behind that. It describes the server that answers the console — on your VPS it is the VPS; on
 * a developer's laptop it is the laptop.
 */
export function PlatformServer() {
  const [live, setLive] = useState(true);
  const q = useServer(live);
  const history = useServerHistory(live);
  const procs = useServerProcesses(live);
  const d = q.data;
  const points = history.data?.points ?? [];

  const header = (
    <PageHeaderRow
      d={d}
      live={live}
      setLive={setLive}
      fetching={q.isFetching}
      error={q.isError}
    />
  );

  if (!d) {
    return (
      <>
        {header}
        <p style={muted}>{q.isError ? `Couldn't read the server: ${q.error.message}` : "Reading the server…"}</p>
      </>
    );
  }

  return (
    <>
      {header}
      <div className="dash viz">
        <HealthBanner health={d.health} />
        <div className="dash-2">
          <CpuCard d={d} points={points} />
          <MemoryCard d={d} points={points} />
        </div>
        <div className="dash-2">
          <DiskCard d={d} points={points} />
          <NetworkCard d={d} points={points} />
        </div>
        <ProcessesCard procs={procs.data} error={procs.isError ? procs.error : null} />
        {procs.data?.apps ? <AppsCard apps={procs.data.apps} /> : null}
        <div className="dash-2">
          <ApiCard d={d} />
          <FoldersCard />
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ header */

function PageHeaderRow({ d, live, setLive, fetching, error }) {
  return (
    <PageHeader
      title="Server"
      icon={<Server size={23} />}
      subtitle={d ? `${d.machine.hostname} · ${d.machine.osName} · up ${uptime(d.machine.uptimeSec)}` : "The machine this API runs on."}
      action={
        <div style={{ display: "flex", alignItems: "center" }}>
          <span className={`viz srv-live ${live && !error ? "" : "off"}`} title={live ? "Refreshing every few seconds" : "Paused"}>
            <i />
            {error ? "Can't reach the server" : live ? (fetching ? "Updating…" : "Live") : "Paused"}
          </span>
          <Button variant="outline" onClick={() => setLive((v) => !v)} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            {live ? <Pause size={13} /> : <Play size={13} />} {live ? "Pause" : "Resume"}
          </Button>
        </div>
      }
    />
  );
}

/* ------------------------------------------------------------ health banner */

function HealthBanner({ health }) {
  if (!health.ready) {
    return (
      <section className="viz viz-fig">
        <h3 className="viz-title">Server health</h3>
        <p className="viz-sub">Measuring… the first readings take a few seconds.</p>
      </section>
    );
  }
  return (
    <section className="viz viz-fig">
      <div className="srv-banner">
        <div className="srv-score">
          <div className="viz-sub" style={{ margin: 0 }}>Server health</div>
          <div className="srv-score-top">
            <span className="srv-score-num">
              {health.boxes}
              <small>/10</small>
            </span>
            <LevelLabel level={health.level} label={health.label} />
          </div>
          <HealthBoxes boxes={health.boxes} level={health.level} size={22} />
          <div className="srv-scale">
            <span><i style={{ background: "var(--viz-status-good)" }} />7–10 healthy</span>
            <span><i style={{ background: "var(--viz-status-warning)" }} />4–6 needs attention</span>
            <span><i style={{ background: "var(--viz-status-critical)" }} />0–3 critical</span>
          </div>
        </div>
        <div>
          <h3 className="viz-title" style={{ marginBottom: 8 }}>{health.reasons.length ? "What needs attention" : "Everything is within normal limits"}</h3>
          {health.reasons.length ? (
            <ul className="srv-reasons">
              {health.reasons.map((r) => (
                <li key={r.id}>
                  {r.level === "critical" ? <CircleX size={16} color="var(--viz-bad)" aria-label="Critical" /> : <TriangleAlert size={16} color="var(--viz-warn-ink)" aria-label="Warning" />}
                  <span>
                    <b>{r.label}:</b> {r.text}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="viz-sub" style={{ margin: 0 }}>
              <CheckCircle2 size={14} color="var(--viz-good)" style={{ verticalAlign: -2, marginRight: 6 }} aria-hidden />
              CPU, memory, disk and the database are all comfortable.
            </p>
          )}
          <p className="viz-note" style={{ marginTop: 12 }}>
            The score is the average of the six parts below, held down by the weakest one — so a single overloaded resource can't hide behind fine ones.
          </p>
        </div>
      </div>
      <div className="srv-parts">
        {health.parts.map((p) => (
          <div key={p.id} className="srv-part">
            <div className="srv-part-top">
              {p.label}
              <span>{p.boxes}/10</span>
            </div>
            <HealthBoxes boxes={p.boxes} level={p.level} size={11} />
            <div className="srv-part-detail">{p.detail}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- small bits */

function Stat({ label, value, sub }) {
  return (
    <div>
      <div className="srv-stat-label">{label}</div>
      <div className="srv-stat-value">{value}</div>
      {sub ? <div className="srv-stat-sub">{sub}</div> : null}
    </div>
  );
}

const tickEvery = (n) => Math.max(1, Math.ceil(n / 6));
/** Hours:minutes along the bottom — but with seconds while the history is still only a few minutes long, or every label reads the same. */
const timeLabels = (points) => {
  const short = points.length > 1 && points.at(-1).t - points[0].t < 6 * 60_000;
  return points.map((p) => (short ? clockSeconds(p.t) : clock(p.t)));
};
const titleAt = (points) => (i) => (points[i] ? clockSeconds(points[i].t) : "");
/** A table version of a time series: about 36 rows, however many readings there are. */
const sampled = (points, rows = 36) => points.filter((_, i) => i % Math.max(1, Math.ceil(points.length / rows)) === 0);
const noData = <Empty title="Collecting readings…">The chart fills in over the first minute.</Empty>;

/* ---------------------------------------------------------------------- CPU */

function CpuCard({ d, points }) {
  const c = d.cpu;
  if (!c) return <Figure title="CPU"><p style={muted}>Not readable on this machine.</p></Figure>;
  const parts = [
    { id: "user", name: "Programs", value: c.user, color: "var(--viz-accent)", display: percent(c.user) },
    { id: "system", name: "System", value: c.system, color: "var(--viz-slot-2)", display: percent(c.system) },
    { id: "wait", name: "Waiting on disk", value: c.iowait, color: "var(--viz-slot-3)", display: percent(c.iowait) },
    ...(c.steal > 0 ? [{ id: "steal", name: "Taken by the host", value: c.steal, color: "var(--viz-context)", display: percent(c.steal), ink: "var(--viz-ink)" }] : []),
    { id: "idle", name: "Idle", value: c.idle, color: "var(--viz-grid)", display: percent(c.idle), ink: "var(--viz-ink)" },
  ];
  return (
    <Figure
      title="CPU"
      subtitle={`${d.machine.cpuModel || "Processor"} · ${c.cores} ${c.cores === 1 ? "core" : "cores"}`}
      legend={<Legend items={[{ name: "CPU in use", color: "var(--viz-accent)", line: true }, { name: "Waiting on disk", color: "var(--viz-context)", line: true }]} />}
      table={{
        caption: "CPU over the last 30 minutes",
        columns: [{ key: "t", label: "Time" }, { key: "u", label: "In use", right: true }, { key: "w", label: "Waiting on disk", right: true }],
        rows: sampled(points).map((p) => ({ t: clockSeconds(p.t), u: percent(p.cpu), w: percent(p.wait) })),
      }}
    >
      <div className="srv-stats">
        <Stat label="Usage" value={percent(c.used)} sub="of all cores together" />
        <Stat label="Remaining" value={percent(c.remaining)} sub="idle right now" />
        <Stat label="Cores" value={c.cores} sub="100% = every core busy" />
        <Stat
          label="Load (5 min average)"
          value={c.load[1].toFixed(2)}
          sub={`1 min ${c.load[0].toFixed(2)} · 15 min ${c.load[2].toFixed(2)} · ${c.loadPerCore} per core${c.loadPerCore > 1 ? " — queueing" : ""}`}
        />
      </div>
      <SegmentedBar parts={parts} />
      <div style={{ margin: "14px 0 6px", fontSize: 12.5, color: "var(--viz-ink-muted)" }}>Each core</div>
      <div className="srv-cores" role="img" aria-label={`Per core: ${c.perCore.map((v, i) => `core ${i + 1} ${v ?? 0} percent`).join(", ")}`}>
        {c.perCore.map((v, i) => (
          <div key={i} style={{ flex: "1 1 0", maxWidth: 34, minWidth: 8 }} title={`Core ${i + 1}: ${percent(v)}`}>
            <div className="srv-core" style={{ height: 44 }}>
              <i style={{ height: `${Math.max(0, Math.min(100, v ?? 0))}%` }} />
            </div>
            <div className="srv-core-label">{i + 1}</div>
          </div>
        ))}
      </div>
      {points.length > 2 ? (
        <LineChart
          height={190}
          labels={timeLabels(points)}
          tickEvery={tickEvery(points.length)}
          titleOf={titleAt(points)}
          yMax={100}
          format={percent}
          tickFormat={(v) => `${v}%`}
          summary="CPU use over the last 30 minutes"
          series={[
            { id: "wait", name: "Waiting on disk", color: "var(--viz-context)", values: points.map((p) => p.wait) },
            { id: "cpu", name: "CPU in use", color: "var(--viz-accent)", values: points.map((p) => p.cpu), area: true },
          ]}
        />
      ) : (
        noData
      )}
    </Figure>
  );
}

/* ------------------------------------------------------------------- memory */

function MemoryCard({ d, points }) {
  const m = d.memory;
  if (!m) return <Figure title="Memory"><p style={muted}>Not readable on this machine.</p></Figure>;
  const cache = Math.min(m.cacheB, m.availableB);
  const free = Math.max(0, m.availableB - cache);
  const total = sizeBoth(m.totalB);
  const used = sizeBoth(m.usedB);
  const left = sizeBoth(m.availableB);
  const availPct = Math.round((m.availableB / m.totalB) * 1000) / 10;
  const swap = sizeBoth(m.swapTotalB);
  const swapUsed = sizeBoth(m.swapUsedB);
  const parts = [
    { id: "used", name: "In use by programs", value: m.usedB, color: "var(--viz-accent)", display: sizeAuto(m.usedB) },
    { id: "cache", name: "Cache (given back when needed)", value: cache, color: "var(--viz-slot-3)", display: sizeAuto(cache) },
    { id: "free", name: "Free", value: free, color: "var(--viz-grid)", display: sizeAuto(free), ink: "var(--viz-ink)" },
  ];
  return (
    <Figure
      title="Memory (RAM)"
      subtitle="'Remaining' counts the cache Linux hands back the moment a program asks for it — the honest figure."
      legend={<Legend items={[{ name: "Memory used", color: "var(--viz-accent)", line: true }, { name: "Swap used", color: "var(--viz-context)", line: true }]} />}
      table={{
        caption: "Memory over the last 30 minutes",
        columns: [{ key: "t", label: "Time" }, { key: "m", label: "Memory used", right: true }, { key: "s", label: "Swap used", right: true }],
        rows: sampled(points).map((p) => ({ t: clockSeconds(p.t), m: percent(p.mem), s: percent(p.swap) })),
      }}
    >
      <div className="srv-stats">
        <Stat label="Total RAM" value={total.gb} sub={total.mb} />
        <Stat label="Used" value={used.gb} sub={`${used.mb} · ${percent(m.usedPct)}`} />
        <Stat label="Remaining" value={left.gb} sub={`${left.mb} · ${percent(availPct)}`} />
        <Stat
          label="Swap in use"
          value={m.swapTotalB ? swapUsed.gb : "none"}
          sub={m.swapTotalB ? `of ${swap.gb} · ${percent(m.swapUsedPct)} · ${swapUsed.mb}` : "no swap space is set up"}
        />
      </div>
      <SegmentedBar parts={parts} />
      <div style={{ height: 14 }} />
      {points.length > 2 ? (
        <LineChart
          height={190}
          labels={timeLabels(points)}
          tickEvery={tickEvery(points.length)}
          titleOf={titleAt(points)}
          yMax={100}
          format={percent}
          tickFormat={(v) => `${v}%`}
          summary="Memory and swap used over the last 30 minutes"
          series={[
            { id: "swap", name: "Swap used", color: "var(--viz-context)", values: points.map((p) => p.swap) },
            { id: "mem", name: "Memory used", color: "var(--viz-accent)", values: points.map((p) => p.mem), area: true },
          ]}
        />
      ) : (
        noData
      )}
    </Figure>
  );
}

/* --------------------------------------------------------------------- disk */

function DiskCard({ d, points }) {
  const { mounts, io } = d.disk;
  const hasIo = Boolean(io);
  return (
    <Figure
      title="Disk"
      subtitle="Space on each disk, and how fast it is being read and written right now."
      legend={hasIo ? <Legend items={[{ name: "Read", color: "var(--viz-accent)", line: true }, { name: "Write", color: "var(--viz-slot-2)", line: true }]} /> : null}
      table={
        hasIo
          ? {
              caption: "Disk speed over the last 30 minutes",
              columns: [{ key: "t", label: "Time" }, { key: "r", label: "Read", right: true }, { key: "w", label: "Write", right: true }, { key: "b", label: "Busy", right: true }],
              rows: sampled(points).map((p) => ({ t: clockSeconds(p.t), r: rate(p.rd), w: rate(p.wr), b: percent(p.busy) })),
            }
          : {
              caption: "Disk space",
              columns: [{ key: "m", label: "Disk" }, { key: "c", label: "Capacity", right: true }, { key: "u", label: "Used", right: true }, { key: "r", label: "Remaining", right: true }],
              rows: mounts.map((m) => ({ m: m.mount, c: sizeBoth(m.sizeB).gb, u: `${sizeBoth(m.usedB).gb} (${percent(m.usedPct)})`, r: `${sizeBoth(m.availB).gb} (${percent(m.availPct)})` })),
            }
      }
    >
      <div style={{ display: "grid", gap: 16, marginBottom: 16 }}>
        {mounts.map((m) => {
          const cap = sizeBoth(m.sizeB);
          const used = sizeBoth(m.usedB);
          const left = sizeBoth(m.availB);
          return (
            <div key={m.mount}>
              <div className="srv-stats" style={{ marginBottom: 8 }}>
                <Stat label={`Capacity · ${m.mount}`} value={cap.gb} sub={`${cap.mb} · ${m.device}`} />
                <Stat label="Used" value={used.gb} sub={`${used.mb} · ${percent(m.usedPct)}`} />
                <Stat label="Remaining" value={left.gb} sub={`${left.mb} · ${percent(m.availPct)}`} />
              </div>
              <Meter label={m.mount} value={m.usedB} total={m.usedB + m.availB} note={`${percent(m.usedPct)} used · ${left.gb} left`} />
            </div>
          );
        })}
        {mounts.length === 0 ? <p style={muted}>No disks could be read on this machine.</p> : null}
      </div>
      {hasIo ? (
        <>
          <div className="srv-stats">
            <Stat label="Read speed" value={rate(io.readBps)} sub={`${Math.round(io.readIops)} reads/s`} />
            <Stat label="Write speed" value={rate(io.writeBps)} sub={`${Math.round(io.writeIops)} writes/s`} />
            <Stat label="Disk busy" value={percent(io.busyPct)} sub="share of the time it was working" />
            <Stat label="Since the server started" value={`${sizeAuto(io.totalReadB)} read`} sub={`${sizeAuto(io.totalWrittenB)} written`} />
          </div>
          {points.length > 2 ? (
            <LineChart
              height={170}
              labels={timeLabels(points)}
              tickEvery={tickEvery(points.length)}
              titleOf={titleAt(points)}
              format={rate}
              tickFormat={(v) => sizeAuto(v)}
              summary="Disk read and write speed over the last 30 minutes"
              series={[
                { id: "wr", name: "Write", color: "var(--viz-slot-2)", values: points.map((p) => p.wr) },
                { id: "rd", name: "Read", color: "var(--viz-accent)", values: points.map((p) => p.rd) },
              ]}
            />
          ) : (
            noData
          )}
        </>
      ) : (
        <p className="viz-note" style={{ marginTop: 0 }}>Read and write speed aren't available on this kind of machine (they come from Linux's disk counters).</p>
      )}
    </Figure>
  );
}

/* ------------------------------------------------------------------ network */

function NetworkCard({ d, points }) {
  const n = d.network;
  if (!n) return <Figure title="Network"><p style={muted}>Not readable on this machine.</p></Figure>;
  // a Mac lists a dozen virtual cards that have never carried a byte; they only make the table long
  const used = n.interfaces.filter((i) => i.rxTotalB + i.txTotalB > 0);
  const idle = n.interfaces.length - used.length;
  return (
    <Figure
      title="Network traffic"
      subtitle="Everything the server's network cards have carried (the machine's own internal traffic is left out)."
      legend={<Legend items={[{ name: "Download (in)", color: "var(--viz-accent)", line: true }, { name: "Upload (out)", color: "var(--viz-slot-2)", line: true }]} />}
      table={{
        caption: "Network speed over the last 30 minutes",
        columns: [{ key: "t", label: "Time" }, { key: "i", label: "Download", right: true }, { key: "o", label: "Upload", right: true }],
        rows: sampled(points).map((p) => ({ t: clockSeconds(p.t), i: rate(p.rx), o: rate(p.tx) })),
      }}
    >
      <div className="srv-stats">
        <Stat label="Download now" value={rate(n.rxBps)} sub={mbit(n.rxBps)} />
        <Stat label="Upload now" value={rate(n.txBps)} sub={mbit(n.txBps)} />
        <Stat label="Total traffic" value={sizeAuto(n.rxTotalB + n.txTotalB)} sub="since the server started" />
        <Stat
          label={n.window ? (n.window.minutes >= 58 ? "Last hour" : `Last ${Math.max(1, Math.round(n.window.minutes))} min`) : "Last hour"}
          value={n.window ? sizeAuto(n.window.rxB + n.window.txB) : "—"}
          sub={n.window ? `${sizeAuto(n.window.rxB)} in · ${sizeAuto(n.window.txB)} out` : "collecting…"}
        />
      </div>
      <div className="srv-stats" style={{ marginBottom: 10 }}>
        <Stat label="Received" value={sizeAuto(n.rxTotalB)} sub={sizeBoth(n.rxTotalB).mb} />
        <Stat label="Sent" value={sizeAuto(n.txTotalB)} sub={sizeBoth(n.txTotalB).mb} />
        <Stat label="Open connections" value={n.tcp ? count(n.tcp.tcpInUse) : "—"} sub={n.tcp ? `${n.tcp.tcpWaiting} closing` : undefined} />
        <Stat label="Errors" value={count(n.errors)} sub="on the network cards" />
      </div>
      {points.length > 2 ? (
        <LineChart
          height={170}
          labels={timeLabels(points)}
          tickEvery={tickEvery(points.length)}
          titleOf={titleAt(points)}
          format={rate}
          tickFormat={(v) => sizeAuto(v)}
          summary="Network download and upload speed over the last 30 minutes"
          series={[
            { id: "tx", name: "Upload (out)", color: "var(--viz-slot-2)", values: points.map((p) => p.tx) },
            { id: "rx", name: "Download (in)", color: "var(--viz-accent)", values: points.map((p) => p.rx) },
          ]}
        />
      ) : (
        noData
      )}
      {n.interfaces.length > 1 ? (
        <>
          <div className="viz-tablewrap" style={{ marginTop: 12 }}>
            <table className="viz-table viz srv-nowrap">
              <thead>
                <tr><th>Network card</th><th className="r">In now</th><th className="r">Out now</th><th className="r">Total in</th><th className="r">Total out</th></tr>
              </thead>
              <tbody>
                {used.map((i) => (
                  <tr key={i.name}><td>{i.name}</td><td className="r">{rate(i.rxBps)}</td><td className="r">{rate(i.txBps)}</td><td className="r">{sizeAuto(i.rxTotalB)}</td><td className="r">{sizeAuto(i.txTotalB)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          {idle > 0 ? <p style={{ ...muted, margin: "6px 0 0" }}>{idle} unused network {idle === 1 ? "card" : "cards"} (no traffic yet) not shown.</p> : null}
        </>
      ) : null}
    </Figure>
  );
}

/* ---------------------------------------------------------------- processes */

function ProcessesCard({ procs, error }) {
  const [tab, setTab] = useState("memory");
  if (!procs) {
    return (
      <Card title="Busiest processes">
        <p style={muted}>{error ? `Couldn't read the process list: ${error.message}` : "Reading the process list…"}</p>
      </Card>
    );
  }
  const all = procs.processes;
  const list =
    tab === "memory"
      ? [...all].sort((a, b) => b.rssBytes - a.rssBytes)
      : tab === "cpu"
        ? [...all].filter((p) => p.cpuPct > 0).sort((a, b) => b.cpuPct - a.cpuPct)
        : [...all].filter((p) => p.readTotalB !== null).sort((a, b) => (b.readBps ?? 0) + (b.writeBps ?? 0) - ((a.readBps ?? 0) + (a.writeBps ?? 0)) || b.readTotalB + b.writeTotalB - (a.readTotalB + a.writeTotalB));
  const rows = list.slice(0, 10);
  const topMem = Math.max(1, ...rows.map((p) => p.rssBytes));
  const topCpu = Math.max(1, ...rows.map((p) => p.cpuPct));

  return (
    <Card
      title="Busiest processes"
      icon={<Activity size={16} />}
      subtitle={`${count(procs.total)} programs are running${procs.threads > 0 ? ` (${count(procs.threads)} threads)` : ""}. The ten using the most of each, right now.`}
    >
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "memory", label: "Memory (RAM)" },
          { id: "cpu", label: "CPU" },
          { id: "disk", label: "Disk activity" },
        ]}
      />
      {tab === "disk" && !procs.diskActivityAvailable ? (
        <Empty title="Not available on this machine">Per-process disk activity comes from Linux, and needs the API to run as the administrator (root).</Empty>
      ) : rows.length === 0 ? (
        <Empty title={tab === "cpu" ? "Nothing is using the CPU right now" : "Nothing to show"} />
      ) : (
        <div style={{ marginTop: 12 }}>
          <Table minWidth={760}>
            <thead>
              <tr>
                <Th width={34}>#</Th>
                <Th>Process</Th>
                <Th>User</Th>
                <Th>PID</Th>
                {tab === "memory" ? <Th>Memory</Th> : null}
                {tab === "cpu" ? <Th>CPU (of the whole server)</Th> : null}
                {tab === "disk" ? (
                  <>
                    <Th align="right">Reading now</Th>
                    <Th align="right">Writing now</Th>
                    <Th align="right">Total read</Th>
                    <Th align="right">Total written</Th>
                  </>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((p, i) => (
                <tr key={p.pid}>
                  <Td>{i + 1}</Td>
                  <Td>
                    <span className="srv-proc-name">{p.app ?? p.name}</span>
                    {p.app ? <span className="srv-badge">app</span> : null}
                    <div className="srv-proc-args" title={p.args}>{p.app ? p.name : p.args}</div>
                  </Td>
                  <Td>{p.user}</Td>
                  <Td style={{ fontVariantNumeric: "tabular-nums" }}>{p.pid}</Td>
                  {tab === "memory" ? (
                    <Td nowrap>
                      <span className="srv-bar" style={{ width: `${(p.rssBytes / topMem) * 110}px` }} />
                      <b style={{ marginLeft: 8 }}>{sizeBoth(p.rssBytes).mb}</b>
                      <span style={{ ...muted, marginLeft: 6 }}>{sizeBoth(p.rssBytes).gb} · {percent(p.memPct)}</span>
                    </Td>
                  ) : null}
                  {tab === "cpu" ? (
                    <Td nowrap>
                      <span className="srv-bar" style={{ width: `${(p.cpuPct / topCpu) * 110}px` }} />
                      <b style={{ marginLeft: 8 }}>{percent(p.cpuPct)}</b>
                    </Td>
                  ) : null}
                  {tab === "disk" ? (
                    <>
                      <Td align="right" nowrap>{rate(p.readBps)}</Td>
                      <Td align="right" nowrap>{rate(p.writeBps)}</Td>
                      <Td align="right" nowrap>{sizeAuto(p.readTotalB)}</Td>
                      <Td align="right" nowrap>{sizeAuto(p.writeTotalB)}</Td>
                    </>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </Table>
          <p className="viz-note">
            {tab === "cpu" ? "100% would mean every core of the server fully busy; one busy program on a 2-core server tops out at 50%." : null}
            {tab === "disk"
              ? "“Reading now / writing now” is measured over the last few seconds. “Total” is everything the program has read or written since it started — and it also counts the programs it started that have already finished, which is why systemd (it starts everything) shows the biggest totals and a script gets the credit for the tools it ran."
              : null}
          </p>
        </div>
      )}
    </Card>
  );
}

/* --------------------------------------------------------------------- apps */

const APP_STATUS = {
  online: { tone: "ok", label: "Running", icon: <CheckCircle2 size={13} /> },
  stopped: { tone: "error", label: "Stopped", icon: <CircleX size={13} /> },
  errored: { tone: "error", label: "Crashed", icon: <CircleX size={13} /> },
  launching: { tone: "warn", label: "Starting", icon: <TriangleAlert size={13} /> },
  stopping: { tone: "warn", label: "Stopping", icon: <TriangleAlert size={13} /> },
  "waiting restart": { tone: "warn", label: "Restarting", icon: <TriangleAlert size={13} /> },
};

function AppsCard({ apps }) {
  const stopped = apps.filter((a) => a.status !== "online");
  return (
    <Card
      title="Apps on this server"
      subtitle="Every app the server's process manager (pm2) looks after. A stopped app is not running — the sites it serves are unreachable."
    >
      {stopped.length ? (
        <p style={{ margin: "0 0 10px", fontSize: 13, color: "var(--viz-bad)" }}>
          <TriangleAlert size={14} style={{ verticalAlign: -2, marginRight: 6 }} aria-hidden />
          {stopped.length} of {apps.length} apps {stopped.length === 1 ? "isn't" : "aren't"} running: {stopped.map((a) => a.name).join(", ")}.
        </p>
      ) : null}
      <Table minWidth={680}>
        <thead>
          <tr>
            <Th>App</Th>
            <Th>Status</Th>
            <Th>Running for</Th>
            <Th align="right">Restarts</Th>
            <Th align="right">CPU</Th>
            <Th align="right">Memory</Th>
          </tr>
        </thead>
        <tbody>
          {[...apps].sort((a, b) => Number(a.status === "online") - Number(b.status === "online") || b.memoryB - a.memoryB).map((a) => {
            const s = APP_STATUS[a.status] ?? { tone: "neutral", label: a.status, icon: null };
            return (
              <tr key={a.id}>
                <Td><span className="srv-proc-name">{a.name}</span></Td>
                <Td nowrap><Pill tone={s.tone} icon={s.icon}>{s.label}</Pill></Td>
                <Td nowrap>{a.status === "online" ? uptime(a.uptimeSec) : "—"}</Td>
                <Td align="right">{count(a.restarts)}</Td>
                <Td align="right" nowrap>{a.status === "online" ? percent(a.cpuPct) : "—"}</Td>
                <Td align="right" nowrap>{a.status === "online" ? `${sizeBoth(a.memoryB).mb} · ${percent(a.memPct)}` : "—"}</Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </Card>
  );
}

/* -------------------------------------------------------------- API & database */

function ApiCard({ d }) {
  const a = d.api;
  const r5 = a.requests.last5min;
  const r60 = a.requests.lastHour;
  return (
    <Figure title="API and database" subtitle="The TablePe API process answering this console, and the database it talks to.">
      <div className="srv-stats">
        <Stat label="Database" value={a.db.ok ? `${a.db.ms} ms` : "Not reachable"} sub={a.db.ok ? "to answer a ping" : a.db.error} />
        <Stat label="API lag" value={`${a.loop?.p99 ?? 0} ms`} sub="how late its timers run (slowest 1 in 100)" />
        <Stat label="API running for" value={uptime(a.uptimeSec)} sub={`process ${a.pid} · Node ${a.nodeVersion?.replace(/^v/, "")}`} />
        <Stat label="API memory" value={sizeAuto(a.rssB)} sub={`${sizeAuto(a.heapUsedB)} of ${sizeAuto(a.heapTotalB)} heap · CPU ${percent(a.cpuPct ?? 0)}`} />
      </div>
      <div className="srv-stats">
        <Stat label="Requests, last 5 min" value={count(r5.requests)} sub={`${r5.perMinute} per minute`} />
        <Stat label="Failed (server errors)" value={`${r5.errorPct}%`} sub={`${count(r5.serverErrors)} of ${count(r5.requests)} · last hour ${r60.errorPct}%`} />
        <Stat label="Average answer time" value={r5.avgMs === null ? "—" : `${r5.avgMs} ms`} sub={r5.p95Ms === null ? undefined : `95% within ${r5.p95Ms} ms`} />
        <Stat label="Saved database trips" value={a.cache.hitRate === null ? "—" : `${Math.round(a.cache.hitRate * 100)}%`} sub={`${count(a.cache.entries)} items remembered · ${sizeAuto(a.cache.bytes)}`} />
      </div>
      <p className="viz-note" style={{ marginTop: 0 }}>
        Requests are counted since the API started ({ago(new Date(a.requests.since).toISOString())}); this page's own refreshing isn't counted.
      </p>
    </Figure>
  );
}

/* ------------------------------------------------------------------ folders */

function FoldersCard() {
  const qc = useQueryClient();
  const q = useFolderScan();
  const start = useMutation({ mutationFn: api.startFolderScan, onSuccess: (data) => qc.setQueryData(["server", "folders"], data) });
  const s = q.data;
  const running = s?.state === "running" || start.isPending;
  const max = Math.max(1, ...(s?.folders ?? []).map((f) => f.sizeB));
  return (
    <Figure
      title="What is using the disk"
      subtitle="The biggest folders in the places apps, logs and caches live. It reads the disk once, at the lowest priority, so it won't slow your sites."
      actions={
        <Button variant="outline" disabled={running} onClick={() => start.mutate()} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
          <FolderSearch size={13} /> {running ? "Measuring…" : s?.state === "done" ? "Scan again" : "Scan folders"}
        </Button>
      }
    >
      {start.error ? <p style={{ color: "var(--viz-bad)", fontSize: 13 }}>{start.error.message}</p> : null}
      {running ? (
        <p style={muted}>Measuring folders… this can take a minute on a big disk. You can leave this page; the result will be here when you come back.</p>
      ) : s?.state === "error" ? (
        <p style={muted}>{s.error}</p>
      ) : s?.state === "done" ? (
        <>
          <p className="viz-note" style={{ marginTop: 0, marginBottom: 10 }}>
            Scanned {ago(new Date(s.finishedAt).toISOString())} in {s.finishedAt - s.startedAt < 1000 ? "under a second" : `${Math.round((s.finishedAt - s.startedAt) / 1000)} s`}.
            {s.roots.length ? ` Together, the places scanned hold ${sizeAuto(s.roots.reduce((n, r) => n + r.sizeB, 0))}.` : ""}
          </p>
          <ol className="viz viz-hbars">
            {s.folders.slice(0, 15).map((f) => (
              <li key={f.path} className="viz-hbar" style={{ gridTemplateColumns: "minmax(120px, 46%) 1fr" }} title={f.path}>
                <span className="viz-hbar-label" style={{ direction: "rtl", textAlign: "left" }}>
                  <bdo dir="ltr">{f.path}</bdo>
                </span>
                <div className="viz-hbar-track">
                  <div className="viz-hbar-bar" style={{ width: `calc((100% - 150px) * ${f.sizeB / max})` }} />
                  <span className="viz-hbar-val">{sizeAuto(f.sizeB)}</span>
                  {f.pctOfDisk !== null ? <span style={{ ...muted, whiteSpace: "nowrap" }}>{f.pctOfDisk > 0 && f.pctOfDisk < 0.1 ? "<0.1%" : percent(f.pctOfDisk)} of used</span> : null}
                </div>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <p style={muted}>Press “Scan folders” to see which folders take the most space.</p>
      )}
    </Figure>
  );
}
