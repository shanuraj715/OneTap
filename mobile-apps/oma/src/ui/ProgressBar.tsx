import { useEffect, useState } from "react";
import { Animated, Easing, View, type LayoutChangeEvent } from "react-native";
import { useIsFetching, useIsMutating } from "@tanstack/react-query";
import { useTheme } from "./theme";

export interface ProgressBarProps {
  /** 0 to 1. Leave it out for "working, no idea how long" (a bar that slides along). */
  value?: number;
  height?: number;
  tone?: "primary" | "success" | "warning" | "danger";
  label?: string;
}

/** A progress bar: filled to `value`, or sliding when there is no value. */
export function ProgressBar({ value, height = 6, tone = "primary", label = "Progress" }: ProgressBarProps) {
  const { c } = useTheme();
  const color = { primary: c.primary, success: c.success, warning: c.warning, danger: c.danger }[tone];
  const [width, setWidth] = useState(0);
  const [fill] = useState(() => new Animated.Value(0));
  const [slide] = useState(() => new Animated.Value(0));
  const clamped = value === undefined ? undefined : Math.min(1, Math.max(0, value));

  useEffect(() => {
    if (clamped === undefined) return;
    Animated.timing(fill, { toValue: clamped, duration: 250, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [clamped, fill]);

  useEffect(() => {
    if (clamped !== undefined || width === 0) return;
    slide.setValue(0);
    const loop = Animated.loop(Animated.timing(slide, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [clamped, slide, width]);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const barWidth = width * 0.4;
  return (
    <View
      onLayout={onLayout}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={clamped === undefined ? undefined : { min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={{ height, borderRadius: height, backgroundColor: c.surfaceAlt, overflow: "hidden" }}
    >
      {clamped === undefined ? (
        <Animated.View style={{ width: barWidth, height, borderRadius: height, backgroundColor: color, transform: [{ translateX: slide.interpolate({ inputRange: [0, 1], outputRange: [-barWidth, width] }) }] }} />
      ) : (
        <Animated.View style={{ height, borderRadius: height, backgroundColor: color, width: fill.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }} />
      )}
    </View>
  );
}

/**
 * A thin bar across the very top of the screen while the app is talking to the server (loading tables, sending an order). It waits a
 * moment before appearing so quick answers don't make it flicker. Put it once, at the top of the app.
 */
export function TopProgress({ active, delayMs = 200 }: { active: boolean; delayMs?: number }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => setShown(true), delayMs);
    // when the work ends (or the wait is interrupted) the bar goes away, and the next job waits its moment again
    return () => { clearTimeout(t); setShown(false); };
  }, [active, delayMs]);
  if (!active || !shown) return null;
  return (
    <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 1000 }} testID="top-progress">
      <ProgressBar height={3} label="Working" />
    </View>
  );
}

/** The top bar wired to the app's server calls: on while anything is loading or being sent. */
export function QueryProgress() {
  const busy = useIsFetching() + useIsMutating() > 0;
  return <TopProgress active={busy} />;
}
