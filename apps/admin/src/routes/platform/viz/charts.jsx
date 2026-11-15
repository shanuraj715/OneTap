import { useId, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowUp, BarChart3, Minus, Table2 } from "lucide-react";
import { niceTicks, signedPct } from "./format";
import "./viz.css";

/**
 * Charts for the dashboard, drawn by hand in SVG / HTML — no chart library.
 *
 * What they all follow:
 *  - Thin marks: bars at most 24px, with a 4px rounded data-end and a square
 *    baseline; lines 2px; end-dots 8px+ with a 2px ring in the card's colour.
 *  - Hairline, solid, quiet gridlines. Text always wears text colours, never the
 *    series colour: identity comes from the mark beside the text.
 *  - Colour does one job: an accent for "this", gray for "what it's compared
 *    with", blue↔red for above/below a baseline.
 *  - Every value is reachable without hovering: a legend, direct labels on the
 *    ends that matter, and a table view (the button on every chart). The tooltip
 *    only adds to that, and shows the same on keyboard focus (arrow keys).
 */

/* ------------------------------------------------------------------ plumbing */

/** The width of an element, kept up to date as it resizes. */
function useWidth(ref, fallback = 640) {
  const [width, setWidth] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => setWidth(Math.max(260, Math.floor(el.getBoundingClientRect().width) || fallback));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, fallback]);
  return width;
}

/** One tooltip per chart, placed by the chart on the mark being looked at. */
function useTip() {
  const wrap = useRef(null);
  const [tip, setTip] = useState(null);
  return { wrap, tip, show: (x, y, node) => setTip({ x, y, node }), hide: () => setTip(null) };
}

function Tip({ tip, width, height }) {
  if (!tip) return null;
  const flip = tip.x > width * 0.58;
  const top = Math.min(Math.max(tip.y, 34), Math.max(34, height - 34));
  return (
    <div className="viz-tip" role="tooltip" style={{ left: tip.x, top, transform: `translate(${flip ? "calc(-100% - 12px)" : "12px"}, -50%)` }}>
      {tip.node}
    </div>
  );
}

/** A tooltip row: a short key in the series colour, the name, and the value — the value leads. */
function TipRow({ color, name, value }) {
  return (
    <div className="viz-tip-row">
      {color ? <span className="viz-tip-line" style={{ "--c": color }} /> : null}
      <span>{name}</span>
      <strong>{value}</strong>
    </div>
  );
}

/** Left/right arrows move through the marks; Home/End jump to the ends. */
function arrowKeys(n, current, set) {
  return (e) => {
    const at = current ?? n - 1;
    const keys = { ArrowRight: Math.min(n - 1, at + 1), ArrowLeft: Math.max(0, at - 1), Home: 0, End: n - 1 };
    if (e.key in keys) {
      e.preventDefault();
      set(keys[e.key]);
    }
  };
}

/* ------------------------------------------------------------- the card & table */

/**
 * A chart's frame: title, an optional legend, and the "Table" toggle — every chart
 * has a table twin with exactly the same numbers.
 */
export function Figure({ title, subtitle, legend, table, children, busy, note, actions, className = "" }) {
  const [asTable, setAsTable] = useState(false);
  return (
    <figure className={`viz viz-fig ${busy ? "viz-busy" : ""} ${className}`}>
      <figcaption className="viz-head">
        <div>
          <h3 className="viz-title">{title}</h3>
          {subtitle ? <p className="viz-sub">{subtitle}</p> : null}
        </div>
        <div className="viz-actions">
          {actions}
          {table ? (
            <button type="button" className="viz-btn" aria-pressed={asTable} onClick={() => setAsTable((v) => !v)}>
              {asTable ? <BarChart3 size={13} /> : <Table2 size={13} />}
              {asTable ? "Chart" : "Table"}
            </button>
          ) : null}
        </div>
      </figcaption>
      {asTable && table ? <DataTable {...table} /> : (
        <>
          {legend}
          {children}
        </>
      )}
      {note ? <p className="viz-note">{note}</p> : null}
    </figure>
  );
}

/** The same numbers as a chart, as a plain table. `columns: [{ key, label, right }]`, `rows: [{ [key]: text }]`. */
export function DataTable({ caption, columns, rows }) {
  return (
    <div className="viz-tablewrap">
      <table className="viz-table">
        {caption ? <caption>{caption}</caption> : null}
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={c.right ? "r" : ""}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {columns.map((c) => (
                <td key={c.key} className={c.right ? "r" : ""}>
                  {row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Names the series. A legend is always shown for two or more; a single series needs none (the title says it). */
export function Legend({ items }) {
  return (
    <ul className="viz-legend">
      {items.map((item) => (
        <li key={item.name}>
          <span className={item.line ? "viz-linekey" : "viz-swatch"} style={{ "--c": item.color }} />
          {item.name}
        </li>
      ))}
    </ul>
  );
}

/* ---------------------------------------------------------------- change chips */

/** A signed change with an arrow — direction never rests on colour alone. `upIsGood=false` flips what counts as good. */
export function Delta({ pct, upIsGood = true, label }) {
  if (pct === null || pct === undefined) {
    return (
      <span className="viz-delta none" title={label ? `${label}: nothing to compare with yet` : undefined}>
        <Minus size={12} aria-hidden /> no comparison yet
      </span>
    );
  }
  if (pct === 0) {
    return (
      <span className="viz-delta flat">
        <Minus size={12} aria-hidden /> 0%
      </span>
    );
  }
  const up = pct > 0;
  const good = up === upIsGood;
  return (
    <span className={`viz-delta ${good ? "good" : "bad"}`} aria-label={`${up ? "up" : "down"} ${Math.abs(pct)} percent${label ? ` ${label}` : ""}`}>
      {up ? <ArrowUp size={12} aria-hidden /> : <ArrowDown size={12} aria-hidden />}
      {signedPct(pct)}
    </span>
  );
}

/* ------------------------------------------------------------------- sparkline */

/** A tiny trend: the past in gray, the current point in the accent. */
export function Sparkline({ values, width = 96, height = 28 }) {
  const clean = values.map((v) => (typeof v === "number" ? v : 0));
  const max = Math.max(...clean, 1);
  const min = Math.min(...clean, 0);
  const x = (i) => 3 + (i * (width - 6)) / Math.max(1, clean.length - 1);
  const y = (v) => height - 4 - ((v - min) / (max - min || 1)) * (height - 8);
  const path = clean.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const last = clean.length - 1;
  return (
    <svg className="viz" width={width} height={height} aria-hidden>
      <path d={path} fill="none" stroke="var(--viz-context)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(last)} cy={y(clean[last])} r="4" fill="var(--viz-accent)" className="viz-ring" />
    </svg>
  );
}

/* ----------------------------------------------------------------------- tiles */

/** One number with its change and, optionally, its trend. */
export function StatTile({ label, icon, value, delta, deltaNote, note, spark, to, title }) {
  const body = (
    <>
      <div className="viz-tile-label">
        {icon}
        {label}
      </div>
      <div className="viz-tile-value">{value}</div>
      {delta !== undefined || spark || note ? (
        <div className="viz-tile-foot">
          <div style={{ minWidth: 0 }}>
            {delta !== undefined ? <Delta pct={delta} label={deltaNote} /> : null}
            {deltaNote && delta !== undefined ? <div className="viz-tile-note">{deltaNote}</div> : null}
            {note ? <div className="viz-tile-note">{note}</div> : null}
          </div>
          {spark ? <Sparkline values={spark} /> : null}
        </div>
      ) : null}
    </>
  );
  return to ? (
    <Link to={to} className="viz viz-tile" title={title}>
      {body}
    </Link>
  ) : (
    <div className="viz viz-tile" title={title}>
      {body}
    </div>
  );
}

/** The one number the page leads with. */
export function Hero({ label, value, delta, deltaNote, note, spark }) {
  return (
    <div className="viz viz-tile viz-hero">
      <div className="viz-tile-label">{label}</div>
      <div className="viz-hero-value">{value}</div>
      <div className="viz-hero-row">
        <Delta pct={delta} label={deltaNote} />
        {deltaNote ? <span className="viz-tile-note">{deltaNote}</span> : null}
      </div>
      {note ? <div className="viz-tile-note">{note}</div> : null}
      {spark ? (
        <div style={{ marginTop: 14 }}>
          <Sparkline values={spark} width={300} height={64} />
          <div className="viz-tile-note">Sales in each of the last 12 months</div>
        </div>
      ) : null}
    </div>
  );
}

/* --------------------------------------------------------------- column chart */

/** A column with a rounded top (the data end) and a square foot on the baseline. */
const columnPath = (x, y, w, h, r = 4) => {
  if (h <= 0) return "";
  const radius = Math.min(r, w / 2, h);
  return `M${x},${y + h} V${y + radius} Q${x},${y} ${x + radius},${y} H${x + w - radius} Q${x + w},${y} ${x + w},${y + radius} V${y + h} Z`;
};
/** …and a bar that hangs below the baseline: rounded at the bottom. */
const hangingPath = (x, y, w, h, r = 4) => {
  if (h <= 0) return "";
  const radius = Math.min(r, w / 2, h);
  return `M${x},${y} V${y + h - radius} Q${x},${y + h} ${x + radius},${y + h} H${x + w - radius} Q${x + w},${y + h} ${x + w},${y + h - radius} V${y} Z`;
};

/**
 * Columns along a time axis. data: [{ key, label, value, tip?: string[], partial?: bool }].
 * The value is labelled on the latest column and the tallest; the axis carries the rest.
 */
export function ColumnChart({ data, height = 250, format, labelFormat, tickFormat, name, summary }) {
  const { wrap, tip, show, hide } = useTip();
  const width = useWidth(wrap);
  const [on, setOn] = useState(null);
  const max = Math.max(0, ...data.map((d) => d.value));
  const { max: top, ticks } = niceTicks(max);
  const tickText = tickFormat ?? format;
  const m = { top: 24, right: 8, bottom: 26, left: 14 + Math.max(...ticks.map((t) => String(tickText(t)).length)) * 6.6 };
  const plotW = width - m.left - m.right;
  const plotH = height - m.top - m.bottom;
  const band = plotW / data.length;
  const barW = Math.min(24, band * 0.6);
  const y = (v) => m.top + plotH - (v / top) * plotH;
  const cx = (i) => m.left + band * (i + 0.5);

  // label the latest column and the tallest — if there is room for both
  const maxAt = data.findIndex((d) => d.value === max);
  const labelled = [];
  for (const i of [data.length - 1, maxAt]) {
    if (i >= 0 && data[i].value > 0 && labelled.every((j) => Math.abs(cx(i) - cx(j)) >= 62)) labelled.push(i);
  }

  const point = (i) => {
    setOn(i);
    const d = data[i];
    show(
      cx(i),
      y(d.value),
      <>
        <div className="viz-tip-title">{d.label}{d.partial ? " · so far" : ""}</div>
        <TipRow color="var(--viz-accent)" name={name} value={format(d.value)} />
        {(d.tip ?? []).map((line) => (
          <div key={line}>{line}</div>
        ))}
      </>,
    );
  };
  const leave = () => {
    setOn(null);
    hide();
  };

  return (
    <div
      ref={wrap}
      className="viz-plot"
      style={{ height }}
      tabIndex={0}
      role="group"
      aria-label={`${summary ?? name}. Use the left and right arrow keys to move between columns.`}
      onKeyDown={arrowKeys(data.length, on, point)}
      onFocus={() => on === null && point(data.length - 1)}
      onBlur={leave}
    >
      <svg width={width} height={height} aria-hidden>
        {ticks.map((t) => (
          <g key={t}>
            <line className={t === 0 ? "viz-baseline" : "viz-grid"} x1={m.left} x2={width - m.right} y1={y(t)} y2={y(t)} />
            <text className="viz-tick" x={m.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle">
              {tickText(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => (
          <g key={d.key}>
            <path
              className={`viz-bar ${on === i ? "is-on" : ""}`}
              d={columnPath(cx(i) - barW / 2, y(d.value), barW, y(0) - y(d.value))}
              fill="var(--viz-accent)"
              fillOpacity={d.partial ? 0.5 : 1}
            />
            {(data.length - 1 - i) % (band < 46 ? 2 : 1) === 0 ? (
              <text className="viz-xlabel" x={cx(i)} y={height - 8} textAnchor="middle">
                {d.label}
              </text>
            ) : null}
            {/* the whole slot is the target, not the painted bar */}
            <rect className="viz-hit" x={m.left + band * i} y={m.top - 10} width={band} height={plotH + m.bottom + 10} onPointerMove={() => point(i)} onPointerLeave={leave} />
          </g>
        ))}
        {labelled.map((i) => (
          <text key={`v${i}`} className="viz-value" x={cx(i)} y={y(data[i].value) - 7} textAnchor="middle">
            {(labelFormat ?? format)(data[i].value)}
          </text>
        ))}
      </svg>
      <Tip tip={tip} width={width} height={height} />
    </div>
  );
}

/* ------------------------------------------------------ change above / below zero */

/**
 * Month-on-month change as bars above and below a zero line — the up and down of
 * it. data: [{ key, label, value: percent | null, tip?: string }]. Blue up, red
 * down; the direction is also the position, so colour is never the only signal.
 */
export function ChangeBars({ data, height = 250, summary }) {
  const { wrap, tip, show, hide } = useTip();
  const width = useWidth(wrap);
  const [on, setOn] = useState(null);
  const biggest = Math.max(10, ...data.map((d) => Math.abs(d.value ?? 0)));
  const { max: limit, ticks: posTicks } = niceTicks(biggest, 2);
  const ticks = [...posTicks.slice(1).reverse().map((t) => -t), ...posTicks];
  const m = { top: 22, right: 8, bottom: 26, left: 52 };
  const plotW = width - m.left - m.right;
  const plotH = height - m.top - m.bottom;
  const band = plotW / data.length;
  const barW = Math.min(24, band * 0.6);
  const y = (v) => m.top + plotH / 2 - (v / limit) * (plotH / 2);
  const cx = (i) => m.left + band * (i + 0.5);
  const last = data.length - 1;
  const peak = data.reduce((best, d, i) => (Math.abs(d.value ?? 0) > Math.abs(data[best].value ?? 0) ? i : best), 0);
  const labelled = [last, peak].filter((i, k, all) => data[i].value !== null && all.indexOf(i) === k && (k === 0 || Math.abs(cx(i) - cx(all[0])) >= 62));

  const point = (i) => {
    setOn(i);
    const d = data[i];
    show(
      cx(i),
      y(d.value ?? 0),
      <>
        <div className="viz-tip-title">{d.label}{d.partial ? " · so far" : ""}</div>
        <TipRow color={d.value === null ? undefined : d.value >= 0 ? "var(--viz-pole-up)" : "var(--viz-pole-down)"} name={d.partial ? "vs the same days of last month" : "vs the month before"} value={d.value === null ? "no comparison" : signedPct(d.value)} />
        {d.tip ? <div>{d.tip}</div> : null}
      </>,
    );
  };
  const leave = () => {
    setOn(null);
    hide();
  };

  return (
    <div
      ref={wrap}
      className="viz-plot"
      style={{ height }}
      tabIndex={0}
      role="group"
      aria-label={`${summary}. Use the left and right arrow keys to move between months.`}
      onKeyDown={arrowKeys(data.length, on, point)}
      onFocus={() => on === null && point(last)}
      onBlur={leave}
    >
      <svg width={width} height={height} aria-hidden>
        {ticks.map((t) => (
          <g key={t}>
            <line className={t === 0 ? "viz-baseline" : "viz-grid"} x1={m.left} x2={width - m.right} y1={y(t)} y2={y(t)} />
            <text className="viz-tick" x={m.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle">
              {t > 0 ? `+${t}%` : t < 0 ? `−${Math.abs(t)}%` : "0%"}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const v = d.value ?? 0;
          const h = Math.abs(y(v) - y(0));
          return (
            <g key={d.key}>
              {d.value !== null ? (
                <path
                  className={`viz-bar ${on === i ? "is-on" : ""}`}
                  d={v >= 0 ? columnPath(cx(i) - barW / 2, y(v), barW, h) : hangingPath(cx(i) - barW / 2, y(0), barW, h)}
                  fill={v >= 0 ? "var(--viz-pole-up)" : "var(--viz-pole-down)"}
                  fillOpacity={d.partial ? 0.5 : 1}
                />
              ) : null}
              {(data.length - 1 - i) % (band < 46 ? 2 : 1) === 0 ? (
                <text className="viz-xlabel" x={cx(i)} y={height - 8} textAnchor="middle">
                  {d.label}
                </text>
              ) : null}
              <rect className="viz-hit" x={m.left + band * i} y={m.top - 10} width={band} height={plotH + m.bottom + 10} onPointerMove={() => point(i)} onPointerLeave={leave} />
            </g>
          );
        })}
        {labelled.map((i) => (
          <text key={`v${i}`} className="viz-value" x={cx(i)} y={data[i].value >= 0 ? y(data[i].value) - 7 : y(data[i].value) + 16} textAnchor="middle">
            {signedPct(data[i].value)}
          </text>
        ))}
      </svg>
      <Tip tip={tip} width={width} height={height} />
    </div>
  );
}

/* ------------------------------------------------------------------ line chart */

/** The position of the last real number in a series (or -1). */
const lastIndex = (values) => {
  for (let i = values.length - 1; i >= 0; i--) if (typeof values[i] === "number") return i;
  return -1;
};

/**
 * Lines across a shared x axis. series: [{ id, name, endLabel?, color, values: (number|null)[], area?: bool }].
 * A crosshair snaps to the nearest point and one tooltip lists every series there.
 * The ends are labelled directly when they don't crowd each other; otherwise the legend carries identity.
 */
export function LineChart({ labels, series, height = 250, format, tickFormat, tickEvery = 1, titleOf, summary, yMax = 0 }) {
  const { wrap, tip, show, hide } = useTip();
  const width = useWidth(wrap);
  const [on, setOn] = useState(null);
  const all = series.flatMap((s) => s.values.filter((v) => typeof v === "number"));
  const { max: top, ticks } = niceTicks(Math.max(0, yMax, ...all));
  const tickText = tickFormat ?? format;
  // direct end-labels only when every line finishes at the right-hand edge — otherwise a label would land on another line; the legend names them either way
  const sameEdge = series.length >= 2 && series.every((s) => lastIndex(s.values) === labels.length - 1);
  const endLabels = sameEdge ? Math.max(...series.map((s) => (s.endLabel ?? s.name).length)) * 6.8 + 22 : 14;
  const m = { top: 14, right: endLabels, bottom: 26, left: 14 + Math.max(...ticks.map((t) => String(tickText(t)).length)) * 6.6 };
  const plotW = width - m.left - m.right;
  const plotH = height - m.top - m.bottom;
  const n = labels.length;
  const x = (i) => m.left + (n === 1 ? plotW / 2 : (i * plotW) / (n - 1));
  const y = (v) => m.top + plotH - (v / top) * plotH;
  // however many labels the caller asks for, never more than fit side by side: on a phone the same chart gets fewer, so they can't run into each other
  const labelPx = Math.max(0, ...labels.map((l) => String(l).length)) * 6.6 + 20;
  const fit = Math.max(2, Math.floor(Math.max(0, plotW) / labelPx));
  const every = n > 1 ? Math.max(tickEvery, Math.ceil((n - 1) / (fit - 1))) : 1;

  const segments = (values) => {
    const out = [];
    let run = [];
    values.forEach((v, i) => {
      if (typeof v === "number") run.push([i, v]);
      else if (run.length) {
        out.push(run);
        run = [];
      }
    });
    if (run.length) out.push(run);
    return out;
  };
  // end labels: only when the lines finish far enough apart to read
  const ends = series.map((s) => ({ s, i: lastIndex(s.values) })).filter((e) => e.i >= 0);
  const crowded = ends.some((a, k) => ends.some((b, j) => j > k && Math.abs(y(a.s.values[a.i]) - y(b.s.values[b.i])) < 15));
  const showEnds = sameEdge && !crowded;

  const point = (i) => {
    setOn(i);
    const present = series.filter((s) => typeof s.values[i] === "number");
    show(
      x(i),
      Math.min(...present.map((s) => y(s.values[i])), m.top + plotH),
      <>
        <div className="viz-tip-title">{titleOf ? titleOf(i) : labels[i]}</div>
        {present.map((s) => (
          <TipRow key={s.id} color={s.color} name={s.name} value={format(s.values[i])} />
        ))}
        {present.length === 0 ? <div>No data</div> : null}
      </>,
    );
  };
  const leave = () => {
    setOn(null);
    hide();
  };
  const fromPointer = (e) => {
    const box = e.currentTarget.getBoundingClientRect();
    return Math.max(0, Math.min(n - 1, Math.round(((e.clientX - box.left - m.left) / plotW) * (n - 1))));
  };

  return (
    <div
      ref={wrap}
      className="viz-plot"
      style={{ height }}
      tabIndex={0}
      role="group"
      aria-label={`${summary}. Use the left and right arrow keys to move along the line.`}
      onKeyDown={arrowKeys(n, on, point)}
      onFocus={() => on === null && point(Math.max(0, ...series.map((s) => lastIndex(s.values))))}
      onBlur={leave}
      onPointerMove={(e) => point(fromPointer(e))}
      onPointerLeave={leave}
    >
      <svg width={width} height={height} aria-hidden>
        {ticks.map((t) => (
          <g key={t}>
            <line className={t === 0 ? "viz-baseline" : "viz-grid"} x1={m.left} x2={width - m.right} y1={y(t)} y2={y(t)} />
            <text className="viz-tick" x={m.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle">
              {tickText(t)}
            </text>
          </g>
        ))}
        {labels.map((label, i) =>
          (n - 1 - i) % every === 0 ? (
            <text key={label + i} className="viz-xlabel" x={x(i)} y={height - 8} textAnchor="middle">
              {label}
            </text>
          ) : null,
        )}
        {on !== null ? <line className="viz-cross" x1={x(on)} x2={x(on)} y1={m.top} y2={m.top + plotH} /> : null}
        {series.map((s) => (
          <g key={s.id}>
            {s.area
              ? segments(s.values).map((run, k) => (
                  <path key={`a${k}`} d={`M${x(run[0][0])},${y(0)} ${run.map(([i, v]) => `L${x(i)},${y(v)}`).join(" ")} L${x(run.at(-1)[0])},${y(0)} Z`} fill={s.color} fillOpacity="0.1" />
                ))
              : null}
            {segments(s.values).map((run, k) => (
              <path key={k} d={run.map(([i, v], j) => `${j ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ")} fill="none" stroke={s.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            ))}
          </g>
        ))}
        {ends.map(({ s, i }) => (
          <circle key={s.id} className="viz-ring" cx={x(i)} cy={y(s.values[i])} r="4.5" fill={s.color} />
        ))}
        {on !== null
          ? series.map((s) => (typeof s.values[on] === "number" ? <circle key={s.id} className="viz-ring" cx={x(on)} cy={y(s.values[on])} r="4.5" fill={s.color} /> : null))
          : null}
        {showEnds
          ? ends.map(({ s, i }) => (
              <text key={s.id} className="viz-endlabel" x={x(i) + 10} y={y(s.values[i])} dominantBaseline="middle">
                {s.endLabel ?? s.name}
              </text>
            ))
          : null}
      </svg>
      <Tip tip={tip} width={width} height={height} />
    </div>
  );
}

/* ----------------------------------------------------------- ranked horizontal bars */

/**
 * A ranked list of bars, largest first, one colour. rows: [{ id, label, value, display, delta?, href?, note? }].
 * Each bar has its value at the tip, so nothing needs hovering.
 */
export function RankedBars({ rows, deltaNote }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ol className="viz viz-hbars">
      {rows.map((r) => (
        <li key={r.id} className="viz-hbar" title={`${r.label}: ${r.display}${r.note ? ` · ${r.note}` : ""}`}>
          {r.href ? (
            <Link className="viz-hbar-label" to={r.href}>
              {r.label}
            </Link>
          ) : (
            <span className="viz-hbar-label">{r.label}</span>
          )}
          <div className="viz-hbar-track">
            <div className="viz-hbar-bar" style={{ width: `calc((100% - 150px) * ${r.value / max})` }} />
            <span className="viz-hbar-val">{r.display}</span>
            {r.delta !== undefined ? <Delta pct={r.delta} label={deltaNote} /> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ---------------------------------------------------------- one whole in parts */

/**
 * One whole split into a few parts, at a glance: a tall bar, each part its own
 * block, its share printed inside when the block is wide enough. The legend names
 * the parts in block order and repeats no numbers (the table view has them).
 * parts: [{ id, name, value, color, display, ink? }]   (ink: the text colour inside the block, for pale blocks)
 */
export function SegmentedBar({ parts }) {
  const wrap = useRef(null);
  const width = useWidth(wrap, 400);
  const total = parts.reduce((sum, p) => sum + p.value, 0);
  const shown = parts.filter((p) => p.value > 0);
  return (
    <div ref={wrap}>
      <div className="viz-seg" role="img" aria-label={parts.map((p) => `${p.name} ${total ? Math.round((p.value / total) * 100) : 0} percent`).join(", ")}>
        {shown.map((p) => {
          const share = p.value / total;
          const room = share * (width - (shown.length - 1) * 2);
          return (
            <div key={p.id} tabIndex={0} style={{ flex: p.value, "--c": p.color, color: p.ink }} title={`${p.name}: ${p.display} (${Math.round(share * 100)}%)`}>
              {room >= 54 ? `${Math.round(share * 100)}%` : ""}
            </div>
          );
        })}
      </div>
      <ul className="viz-legend" style={{ marginTop: 10, marginBottom: 0 }}>
        {parts.map((p) => (
          <li key={p.id}>
            <span className="viz-swatch" style={{ "--c": p.color }} />
            {p.name}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------------ meter */

/** A figure against its limit: the track is a lighter step of the same blue. */
export function Meter({ label, value, total, note }) {
  const share = total > 0 ? Math.min(1, value / total) : 0;
  const id = useId();
  return (
    <div className="viz viz-meter-row">
      <div className="viz-meter-top">
        <span id={id}>{label}</span>
        <span>
          {note ?? `${value} of ${total}`}
        </span>
      </div>
      <div className="viz-meter" role="meter" aria-labelledby={id} aria-valuemin={0} aria-valuemax={total} aria-valuenow={value}>
        <i style={{ width: `${share * 100}%` }} />
      </div>
    </div>
  );
}
