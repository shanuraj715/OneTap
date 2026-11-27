import { useEffect, useMemo, useState } from "react";
import { Animated, Easing, Pressable, View, type GestureResponderEvent, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, Defs, G, Line, LinearGradient as SvgGradient, Path, Rect, Stop } from "react-native-svg";
import { Text } from "./primitives";
import { areaPath, lineLength, nearest, niceMax, segments, smoothPath, toPoints } from "./chartMath";
import { useReducedMotion } from "./motion";
import { radius, useTheme } from "./theme";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** 0 → 1 once (and again when `key` changes): what makes a chart draw itself in. */
function useDraw(key: unknown, ms = 900) {
  const reduced = useReducedMotion();
  const [t] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduced) { t.setValue(1); return; }
    t.setValue(0);
    Animated.timing(t, { toValue: 1, duration: ms, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [t, key, ms, reduced]);
  return t;
}

/* ------------------------------------------------------------------------------------------------ line */
export interface Series { values: number[]; color?: string; label?: string; dashed?: boolean }
/**
 * Lines drawn in as soon as they appear, with a soft fill under the first; press and drag a finger over it to read a value (a dot, a guide
 * line and a bubble follow the finger). `labels` names the points (the x axis shows a few of them).
 */
export function LineChart({ series, labels, height = 190, format = (n) => String(n), testID }: { series: Series[]; labels?: string[]; height?: number; format?: (n: number) => string; testID?: string }) {
  const { c } = useTheme();
  const [width, setWidth] = useState(0);
  const [at, setAt] = useState<number | null>(null);
  const all = series.flatMap((s) => s.values);
  const max = niceMax(Math.max(...all, 0));
  const lines = useMemo(() => series.map((s) => toPoints(s.values, width, height - 18, undefined, max)), [series, width, height, max]);
  const draw = useDraw(JSON.stringify(series.map((s) => s.values)) + width);
  const first = lines[0] ?? [];
  const onTouch = (e: GestureResponderEvent) => { if (first.length) setAt(nearest(first, e.nativeEvent.locationX)); };
  const stops = labels && labels.length > 1 ? [0, Math.floor((labels.length - 1) / 2), labels.length - 1] : [];
  return (
    <View onLayout={(e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width))} testID={testID} accessible accessibilityLabel={`Line chart of ${series[0]?.label ?? "values"}. Touch to read a value.`}
      onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true} onResponderGrant={onTouch} onResponderMove={onTouch} onResponderRelease={() => setAt(null)} onResponderTerminate={() => setAt(null)}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Defs>
            <SvgGradient id="area" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={series[0]?.color ?? c.chart[0]} stopOpacity={0.38} />
              <Stop offset="1" stopColor={series[0]?.color ?? c.chart[0]} stopOpacity={0} />
            </SvgGradient>
          </Defs>
          {[0.25, 0.5, 0.75, 1].map((f) => <Line key={f} x1={8} x2={width - 8} y1={12 + (height - 18 - 24) * (1 - f)} y2={12 + (height - 18 - 24) * (1 - f)} stroke={c.border} strokeWidth={1} strokeDasharray="3 5" />)}
          {first.length ? <Path d={areaPath(first, height - 18 - 12)} fill="url(#area)" opacity={0.9} /> : null}
          {lines.map((pts, i) => {
            const len = lineLength(pts) + 4;
            return <AnimatedPath key={i} d={smoothPath(pts)} fill="none" stroke={series[i]!.color ?? c.chart[i % c.chart.length]} strokeWidth={i === 0 ? 3 : 2} strokeLinecap="round" strokeDasharray={series[i]!.dashed ? "6 6" : [len, len]} strokeDashoffset={series[i]!.dashed ? 0 : draw.interpolate({ inputRange: [0, 1], outputRange: [len, 0] })} opacity={i === 0 ? 1 : 0.7} />;
          })}
          {at !== null && first[at] ? (
            <G>
              <Line x1={first[at]!.x} x2={first[at]!.x} y1={8} y2={height - 18} stroke={c.muted} strokeWidth={1} />
              {lines.map((pts, i) => (pts[at] ? <Circle key={i} cx={pts[at]!.x} cy={pts[at]!.y} r={5.5} fill={series[i]!.color ?? c.chart[i % c.chart.length]} stroke={c.solid} strokeWidth={2} /> : null))}
            </G>
          ) : null}
        </Svg>
      ) : <View style={{ height }} />}
      {at !== null && first[at] ? (
        <View pointerEvents="none" style={{ position: "absolute", top: 0, left: Math.min(Math.max(first[at]!.x - 52, 0), Math.max(0, width - 104)), width: 104, alignItems: "center", paddingVertical: 4, borderRadius: radius.sm, backgroundColor: c.solid, borderWidth: 1, borderColor: c.border }}>
          {labels?.[at] ? <Text variant="caption" tone="muted">{labels[at]}</Text> : null}
          {series.map((s, i) => <Text key={i} variant="label" style={{ color: s.color ?? c.chart[i % c.chart.length] }}>{format(s.values[at] ?? 0)}</Text>)}
        </View>
      ) : null}
      {stops.length ? (
        <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 8 }}>
          {stops.map((i) => <Text key={i} variant="caption" tone="muted">{labels![i]}</Text>)}
        </View>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------------------------------------------ bars */
/** Bars that grow up from the baseline; tap one to read its value (it lights up, the others dim). */
export function BarChart({ data, height = 180, format = (n) => String(n), color, testID }: { data: { label: string; value: number }[]; height?: number; format?: (n: number) => string; color?: string; testID?: string }) {
  const { c } = useTheme();
  const [width, setWidth] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  const grow = useDraw(JSON.stringify(data) + width, 700);
  const max = niceMax(Math.max(...data.map((d) => d.value), 0));
  const slot = data.length ? (width - 16) / data.length : 0;
  const bw = Math.max(4, Math.min(28, slot * 0.58));
  const plotH = height - 22;
  return (
    <View onLayout={(e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width))} testID={testID} accessible accessibilityLabel="Bar chart. Tap a bar to read it.">
      {width > 0 ? (
        <Svg width={width} height={height}>
          {[0.5, 1].map((f) => <Line key={f} x1={8} x2={width - 8} y1={8 + (plotH - 8) * (1 - f)} y2={8 + (plotH - 8) * (1 - f)} stroke={c.border} strokeWidth={1} strokeDasharray="3 5" />)}
          {data.map((d, i) => {
            const h = (d.value / max) * (plotH - 8);
            const x = 8 + slot * i + (slot - bw) / 2;
            return <AnimatedRect key={d.label + i} x={x} width={bw} rx={Math.min(8, bw / 2)} fill={color ?? c.chart[0]} opacity={sel === null || sel === i ? 1 : 0.35}
              y={grow.interpolate({ inputRange: [0, 1], outputRange: [plotH, plotH - Math.max(h, d.value > 0 ? 2 : 0)] })} height={grow.interpolate({ inputRange: [0, 1], outputRange: [0, Math.max(h, d.value > 0 ? 2 : 0)] })} />;
          })}
        </Svg>
      ) : <View style={{ height }} />}
      {width > 0 ? (
        <View style={{ position: "absolute", left: 8, right: 8, top: 0, height: plotH, flexDirection: "row" }}>
          {data.map((d, i) => <Pressable key={d.label + i} onPress={() => setSel(sel === i ? null : i)} accessibilityRole="button" accessibilityLabel={`${d.label}: ${format(d.value)}`} style={{ flex: 1 }} />)}
        </View>
      ) : null}
      {sel !== null && data[sel] ? (
        <View pointerEvents="none" style={{ position: "absolute", top: 0, left: Math.min(Math.max(8 + slot * sel + slot / 2 - 46, 0), Math.max(0, width - 92)), width: 92, alignItems: "center", paddingVertical: 4, borderRadius: radius.sm, backgroundColor: c.solid, borderWidth: 1, borderColor: c.border }}>
          <Text variant="caption" tone="muted">{data[sel]!.label}</Text>
          <Text variant="label">{format(data[sel]!.value)}</Text>
        </View>
      ) : null}
      <View style={{ flexDirection: "row", paddingHorizontal: 8 }}>
        {data.map((d, i) => <View key={d.label + i} style={{ flex: 1, alignItems: "center" }}><Text variant="caption" tone={sel === i ? "normal" : "muted"} numberOfLines={1}>{d.label}</Text></View>)}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------------------------------------ donut */
/** A ring that sweeps round; the legend rows are buttons — tap one and its slice stays bright. */
export function Donut({ items, size = 150, centerTop, centerBottom, format = (n) => String(n), testID }: { items: { label: string; value: number; color?: string }[]; size?: number; centerTop?: string; centerBottom?: string; format?: (n: number) => string; testID?: string }) {
  const { c } = useTheme();
  const [sel, setSel] = useState<number | null>(null);
  const sweep = useDraw(JSON.stringify(items), 900);
  const stroke = Math.round(size * 0.16);
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const segs = segments(items.map((i) => i.value));
  const total = items.reduce((n, i) => n + i.value, 0);
  return (
    <View testID={testID} style={{ flexDirection: "row", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
      <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
        <Svg width={size} height={size} style={{ transform: [{ rotate: "-90deg" }] }}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.glass} strokeWidth={stroke} fill="none" />
          {segs.map((s, i) => (
            <AnimatedCircle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={items[i]!.color ?? c.chart[i % c.chart.length]} strokeWidth={sel === i ? stroke + 4 : stroke} opacity={sel === null || sel === i ? 1 : 0.3} strokeLinecap="butt"
              strokeDasharray={[Math.max(0, s.length * circ - 2), circ]} strokeDashoffset={sweep.interpolate({ inputRange: [0, 1], outputRange: [-s.start * circ + circ * 0.0, -s.start * circ] })} />
          ))}
        </Svg>
        <View style={{ position: "absolute", alignItems: "center" }}>
          <Text variant="heading">{sel !== null && items[sel] ? format(items[sel]!.value) : centerTop ?? format(total)}</Text>
          <Text variant="caption" tone="muted" numberOfLines={1}>{sel !== null && items[sel] ? items[sel]!.label : centerBottom ?? "total"}</Text>
        </View>
      </View>
      <View style={{ flex: 1, minWidth: 140, gap: 6 }}>
        {items.map((it, i) => (
          <Pressable key={it.label} onPress={() => setSel(sel === i ? null : i)} accessibilityRole="button" accessibilityLabel={`${it.label}: ${format(it.value)}`} style={{ flexDirection: "row", alignItems: "center", gap: 8, opacity: sel === null || sel === i ? 1 : 0.5 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: it.color ?? c.chart[i % c.chart.length] }} />
            <Text variant="label" style={{ flex: 1 }} numberOfLines={1}>{it.label}</Text>
            <Text variant="label" tone="muted">{format(it.value)}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------------------------------------ meter + ranked bars */
/** A bar filled to `value` (0–1) that grows in; turns amber then red as it fills when `warn` is set (a limit being used up). */
export function Meter({ value, color, warn = false, height = 8 }: { value: number; color?: string; warn?: boolean; height?: number }) {
  const { c } = useTheme();
  const v = Math.max(0, Math.min(1, value));
  const t = useDraw(v, 700);
  const tone = color ?? (warn ? (v >= 1 ? c.danger : v >= 0.8 ? c.warn : c.primary) : c.primary);
  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(v * 100) }} style={{ height, borderRadius: height, backgroundColor: c.glass, overflow: "hidden" }}>
      <Animated.View style={{ height, borderRadius: height, backgroundColor: tone, width: t.interpolate({ inputRange: [0, 1], outputRange: ["0%", `${v * 100}%`] }) }} />
    </View>
  );
}

export function RankedBars({ rows, format = (n) => String(n), onPress }: { rows: { id?: string; label: string; value: number; note?: string }[]; format?: (n: number) => string; onPress?: (id: string) => void }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <View style={{ gap: 12 }}>
      {rows.map((r, i) => (
        <Pressable key={(r.id ?? r.label) + i} disabled={!onPress || !r.id} onPress={() => r.id && onPress?.(r.id)} accessibilityRole="button" style={{ gap: 5 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
            <Text variant="label" style={{ flex: 1 }} numberOfLines={1}>{i + 1}. {r.label}</Text>
            <Text variant="label">{format(r.value)}</Text>
          </View>
          <Meter value={r.value / max} color={undefined} />
          {r.note ? <Text variant="caption" tone="muted">{r.note}</Text> : null}
        </Pressable>
      ))}
    </View>
  );
}
