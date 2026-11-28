import { useId } from "react";
import { View } from "react-native";
import Svg, { ClipPath, Defs, G, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { Text } from "./primitives";
import { useTheme } from "./theme";

// the same rounded five-point star the web uses (storefront and admin panel): the points are drawn, then a round-joined stroke softens them
const STAR = "M12 3.1l2.55 5.35 5.85.78-4.27 4.06 1.07 5.8L12 16.2 6.8 19.1l1.07-5.8L3.6 9.23l5.85-.78z";
const SHINE = "M12 5.6l1.5 3.15 3.45.46-1.6 1.5";
const lighter = (hex: string, mix = 0.28) => {
  const n = parseInt(hex.replace("#", "").slice(0, 6), 16);
  const f = (v: number) => Math.round(v + (255 - v) * mix);
  return `#${[f((n >> 16) & 255), f((n >> 8) & 255), f(n & 255)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
};

/** One star filled from 0 to 1 (a fraction fills it from the left): a soft gradient in the app's colour with a small shine; an empty one is a faint tint. */
function Star({ fill, size, color, id }: { fill: number; size: number; color: string; id: string }) {
  const f = Math.max(0, Math.min(1, fill));
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Defs>
        <LinearGradient id={`${id}g`} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={lighter(color)} /><Stop offset="1" stopColor={color} /></LinearGradient>
        <ClipPath id={`${id}c`}><Rect x="0" y="0" width={24 * f} height="24" /></ClipPath>
      </Defs>
      <Path d={STAR} fill={color} fillOpacity={0.13} stroke={color} strokeOpacity={0.38} strokeWidth={1.4} strokeLinejoin="round" />
      {f > 0 ? (
        <G clipPath={`url(#${id}c)`}>
          <Path d={STAR} fill={`url(#${id}g)`} stroke={`url(#${id}g)`} strokeWidth={1.6} strokeLinejoin="round" />
          <Path d={SHINE} fill="none" stroke="#FFFFFF" strokeOpacity={0.55} strokeWidth={1.1} strokeLinecap="round" strokeLinejoin="round" />
        </G>
      ) : null}
    </Svg>
  );
}

/**
 * Five stars in the app's own colour — never the stock yellow. `value` may have decimals (4.3 fills a third of the fifth star). Read only.
 * The label says it in words for screen readers: "4.3 out of 5 stars".
 */
export function Stars({ value, size = 16, color, showValue = false, testID }: { value: number; size?: number; color?: string; showValue?: boolean; testID?: string }) {
  const { c } = useTheme();
  const tint = color ?? c.primary;
  const v = Math.max(0, Math.min(5, Number.isFinite(value) ? value : 0));
  const base = `s${useId().replace(/[^a-zA-Z0-9]/g, "")}`; // (each drawing needs its own gradient names)
  return (
    <View testID={testID} accessible accessibilityRole="image" accessibilityLabel={`${Math.round(v * 10) / 10} out of 5 stars`} style={{ flexDirection: "row", alignItems: "center", gap: Math.max(1, Math.round(size * 0.1)) }}>
      {[1, 2, 3, 4, 5].map((n) => <Star key={n} fill={v - (n - 1)} size={size} color={tint} id={`${base}${n}`} />)}
      {showValue ? <Text variant="label" style={{ marginLeft: 4 }}>{(Math.round(v * 10) / 10).toFixed(1)}</Text> : null}
    </View>
  );
}
