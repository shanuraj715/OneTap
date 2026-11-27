import { useState } from "react";
import { Animated, View, type GestureResponderEvent, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, Defs, G, Line, LinearGradient as SvgGradient, Path, Stop, Text as SvgText } from "react-native-svg";
import { Text } from "./primitives";
import { niceMax, smoothPath, toPoints } from "./chartMath";
import { useDraw } from "./charts";
import { useTheme } from "./theme";

let chartCounter = 0;
/** A number that is different for every chart drawn, so the gradients of two charts on one screen never share an id. */
const useChartId = () => useState(() => ++chartCounter)[0];

/* ------------------------------------------------------------------------------------------------ stacked area */
export interface Layer { label: string; values: number[]; color?: string }
/**
 * Layers of colour stacked on top of each other along a shared x axis, with the axis numbers and faint grid lines: how a total is made of its
 * parts over time (sales by outlet, new against returning customers …). Press and drag across it: a guide follows the finger and a bubble lists
 * every layer at that point with the total. `layers[0]` is at the bottom.
 */
export function StackedAreaChart({ layers, labels, height = 230, format = (n) => String(n), axisFormat, testID }: {
  layers: Layer[]; labels: string[]; height?: number; format?: (n: number) => string; axisFormat?: (n: number) => string; testID?: string;
}) {
  const { c } = useTheme();
  const id = useChartId();
  const [width, setWidth] = useState(0);
  const [at, setAt] = useState<number | null>(null);
  const n = labels.length;
  const draw = useDraw(JSON.stringify(layers.map((l) => l.values)) + width, 800);
  const totals = labels.map((_, i) => layers.reduce((s, l) => s + (l.values[i] ?? 0), 0));
  const max = niceMax(Math.max(...totals, 0));
  const axis = axisFormat ?? format;
  const padL = 46, padR = 10, padT = 12, padB = 24;
  const plotW = Math.max(1, width - padL - padR);
  const plotH = height - padT - padB;
  const x = (i: number) => padL + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => padT + plotH - (max > 0 ? (v / max) * plotH : 0);
  const cum = layers.map((_, li) => labels.map((__, i) => layers.slice(0, li + 1).reduce((s, l) => s + (l.values[i] ?? 0), 0)));
  const color = (li: number) => layers[li]?.color ?? c.chart[li % c.chart.length]!;
  const shape = (li: number) => {
    if (!n) return "";
    const top = cum[li]!.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
    const below = li === 0 ? labels.map(() => 0) : cum[li - 1]!;
    const back = below.map((v, i) => `L${x(i).toFixed(1)} ${y(v).toFixed(1)}`).reverse().join(" ");
    return `${top} ${back} Z`;
  };
  const touch = (e: GestureResponderEvent) => {
    if (!n) return;
    setAt(Math.max(0, Math.min(n - 1, Math.round(((e.nativeEvent.locationX - padL) / plotW) * (n - 1)))));
  };
  const xTicks = n > 2 ? [0, Math.floor((n - 1) / 2), n - 1] : n === 2 ? [0, 1] : [0];
  return (
    <View testID={testID} onLayout={(e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width))} accessible accessibilityLabel={`Stacked area chart of ${layers.map((l) => l.label).join(", ")}. Touch to read a point.`}
      onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true} onResponderGrant={touch} onResponderMove={touch} onResponderRelease={() => setAt(null)} onResponderTerminate={() => setAt(null)}>
      {width > 0 ? (
        <Animated.View style={{ width: draw.interpolate({ inputRange: [0, 1], outputRange: [0, width] }), height, overflow: "hidden" }}>
        <Svg width={width} height={height}>
          <Defs>
            {layers.map((_, li) => (
              <SvgGradient key={li} id={`stack${id}-${li}`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={color(li)} stopOpacity={0.95} />
                <Stop offset="1" stopColor={color(li)} stopOpacity={0.55} />
              </SvgGradient>
            ))}
          </Defs>
          {[0, 0.25, 0.5, 0.75, 1].map((f) => (
            <G key={f}>
              <Line x1={padL} x2={width - padR} y1={y(max * f)} y2={y(max * f)} stroke={c.border} strokeWidth={1} strokeDasharray={f === 0 ? undefined : "3 5"} />
              <SvgText x={padL - 6} y={y(max * f) + 4} fontSize={10.5} fill={c.muted} textAnchor="end">{axis(max * f)}</SvgText>
            </G>
          ))}
          {layers.map((_, li) => <Path key={li} d={shape(li)} fill={`url(#stack${id}-${li})`} stroke={color(li)} strokeWidth={1.2} strokeLinejoin="round" opacity={0.96} />)}
          {xTicks.map((i) => <SvgText key={i} x={Math.min(Math.max(x(i), padL + 14), width - padR - 14)} y={height - 6} fontSize={10.5} fill={c.muted} textAnchor="middle">{labels[i]}</SvgText>)}
          {at !== null ? <Line x1={x(at)} x2={x(at)} y1={padT} y2={padT + plotH} stroke={c.text} strokeOpacity={0.5} strokeWidth={1.2} /> : null}
          {at !== null ? layers.map((_, li) => <Circle key={li} cx={x(at)} cy={y(cum[li]![at]!)} r={3.6} fill={color(li)} stroke={c.solid} strokeWidth={1.5} />) : null}
        </Svg>
        </Animated.View>
      ) : <View style={{ height }} />}
      {at !== null && labels[at] !== undefined ? (
        <View pointerEvents="none" style={{ position: "absolute", top: 4, left: Math.min(Math.max(x(at) - 82, 0), Math.max(0, width - 164)), width: 164, padding: 8, borderRadius: 12, backgroundColor: c.solid, borderWidth: 1, borderColor: c.border, gap: 2 }}>
          <Text variant="caption" tone="muted">{labels[at]}</Text>
          {layers.map((l, li) => <View key={li} style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}><Text variant="caption" style={{ color: color(li) }} numberOfLines={1}>{l.label}</Text><Text variant="caption">{format(l.values[at] ?? 0)}</Text></View>)}
          {layers.length > 1 ? <View style={{ flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderColor: c.border, paddingTop: 2 }}><Text variant="caption" tone="muted">Total</Text><Text variant="label">{format(totals[at] ?? 0)}</Text></View> : null}
        </View>
      ) : null}
      {layers.length > 1 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, paddingTop: 6 }}>
          {layers.map((l, li) => <View key={li} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color(li) }} /><Text variant="caption" tone="muted">{l.label}</Text></View>)}
        </View>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------------------------------------------ heat map */
const HEAT_DAYS = [1, 2, 3, 4, 5, 6, 0]; // Monday first
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const hourName = (h: number) => (h === 0 ? "12 am" : h < 12 ? `${h} am` : h === 12 ? "12 pm" : `${h - 12} pm`);
/** Busy and quiet times: a grid of weekday × hour, darker = more. `data[0]` is Sunday (as the server sends it); the grid shows Monday first. Tap a square to read it. */
export function Heatmap({ data, unit = "orders", color, testID }: { data: number[][]; unit?: string; color?: string; testID?: string }) {
  const { c } = useTheme();
  const [width, setWidth] = useState(0);
  const [sel, setSel] = useState<{ d: number; h: number } | null>(null);
  const max = Math.max(1, ...data.flat());
  const labelW = 34;
  const cell = width > 0 ? (width - labelW) / 24 : 0;
  const base = color ?? c.chart[0]!;
  return (
    <View testID={testID} onLayout={(e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width))} accessible accessibilityLabel="Busy times by weekday and hour">
      {width > 0 ? (
        <>
          <View style={{ flexDirection: "row", marginLeft: labelW, height: 16 }}>
            {[0, 6, 12, 18].map((h) => <View key={h} style={{ position: "absolute", left: h * cell }}><Text variant="caption" tone="muted">{h === 0 ? "12a" : h === 12 ? "12p" : h < 12 ? `${h}a` : `${h - 12}p`}</Text></View>)}
          </View>
          {HEAT_DAYS.map((d) => (
            <View key={d} style={{ flexDirection: "row", alignItems: "center", marginBottom: 2 }}>
              <View style={{ width: labelW }}><Text variant="caption" tone="muted">{DAY_NAMES[d]}</Text></View>
              {Array.from({ length: 24 }, (_, h) => {
                const v = data[d]?.[h] ?? 0;
                const on = sel?.d === d && sel.h === h;
                return <View key={h} onTouchEnd={() => setSel(on ? null : { d, h })} accessibilityLabel={`${DAY_NAMES[d]} ${hourName(h)}: ${v} ${unit}`} style={{ width: cell - 1.5, height: 17, marginRight: 1.5, borderRadius: 3, backgroundColor: base, opacity: v ? 0.12 + 0.88 * (v / max) : 0.06, borderWidth: on ? 1.5 : 0, borderColor: c.text }} />;
              })}
            </View>
          ))}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6, minHeight: 20 }}>
            {sel ? <Text variant="label">{DAY_NAMES[sel.d]} {hourName(sel.h)}: {data[sel.d]?.[sel.h] ?? 0} {unit}</Text> : <Text variant="caption" tone="muted">Tap a square. Darker = busier.</Text>}
          </View>
        </>
      ) : <View style={{ height: 150 }} />}
    </View>
  );
}

/* ------------------------------------------------------------------------------------------------ gauge */
/** A ring that fills to `value` (0 → 1; more than 1 is shown as full). Text in the middle. */
export function Gauge({ value, size = 130, stroke = 12, color, top, bottom, testID }: { value: number; size?: number; stroke?: number; color?: string; top?: string; bottom?: string; testID?: string }) {
  const { c } = useTheme();
  const id = useChartId();
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  const col = color ?? c.chart[0]!;
  return (
    <View testID={testID} style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }} accessible accessibilityLabel={`${top ?? ""} ${bottom ?? ""}`.trim()}>
      <Svg width={size} height={size}>
        <Defs>
          <SvgGradient id={`gauge${id}`} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor={col} /><Stop offset="1" stopColor={c.chart[3] ?? col} /></SvgGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.border} strokeWidth={stroke} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={`url(#gauge${id})`} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${circ * v} ${circ}`} rotation={-90} origin={`${size / 2}, ${size / 2}`} />
      </Svg>
      <View style={{ position: "absolute", alignItems: "center" }}>
        {top ? <Text variant="title">{top}</Text> : null}
        {bottom ? <Text variant="caption" tone="muted">{bottom}</Text> : null}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------------------------------------ sparkline */
/** A tiny line with no axes: the shape of a number over time, next to the number. */
export function Sparkline({ values, width = 84, height = 30, color, testID }: { values: number[]; width?: number; height?: number; color?: string; testID?: string }) {
  const { c } = useTheme();
  const pts = toPoints(values, width, height, { l: 2, r: 2, t: 3, b: 3 });
  const col = color ?? c.chart[0]!;
  const last = pts[pts.length - 1];
  return (
    <View testID={testID} accessible accessibilityLabel="Trend" style={{ width, height }}>
      <Svg width={width} height={height}>
        {pts.length > 1 ? <Path d={smoothPath(pts)} fill="none" stroke={col} strokeWidth={2} strokeLinecap="round" /> : null}
        {last ? <Circle cx={last.x} cy={last.y} r={2.6} fill={col} /> : null}
      </Svg>
    </View>
  );
}
