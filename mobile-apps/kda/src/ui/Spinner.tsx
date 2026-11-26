import { useEffect, useState } from "react";
import { Animated, Easing, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useTheme } from "./theme";

/** A spinning ring for "working on it" (a button, a screen loading). */
export function Spinner({ size = 24, color, label = "Loading" }: { size?: number; color?: string; label?: string }) {
  const { c } = useTheme();
  const [turn] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(turn, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [turn]);
  const ring = color ?? c.primary;
  return (
    <Animated.View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      style={{ width: size, height: size, transform: [{ rotate: turn.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }] }}
    >
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Circle cx={12} cy={12} r={9} stroke={ring} strokeOpacity={0.2} strokeWidth={3} fill="none" />
        <Circle cx={12} cy={12} r={9} stroke={ring} strokeWidth={3} strokeLinecap="round" strokeDasharray="14 60" fill="none" />
      </Svg>
    </Animated.View>
  );
}

/** Three dots that pulse one after another — a lighter "working" mark for inline text ("Sending order…"). */
export function LoadingDots({ color, size = 8 }: { color?: string; size?: number }) {
  const { c } = useTheme();
  const [dots] = useState(() => [0, 1, 2].map(() => new Animated.Value(0.3)));
  useEffect(() => {
    const loops = dots.map((v, i) =>
      Animated.loop(Animated.sequence([Animated.delay(i * 160), Animated.timing(v, { toValue: 1, duration: 320, useNativeDriver: true }), Animated.timing(v, { toValue: 0.3, duration: 320, useNativeDriver: true }), Animated.delay((2 - i) * 160)])),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [dots]);
  return (
    <View accessibilityRole="progressbar" accessibilityLabel="Loading" style={{ flexDirection: "row", gap: size * 0.6 }}>
      {dots.map((v, i) => (
        <Animated.View key={i} style={{ width: size, height: size, borderRadius: size, backgroundColor: color ?? c.primary, opacity: v }} />
      ))}
    </View>
  );
}

/** A whole screen (or a block) that is loading: the ring and a short line. */
export function LoadingBlock({ label = "Loading…" }: { label?: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 }}>
      <Spinner size={36} label={label} />
    </View>
  );
}
