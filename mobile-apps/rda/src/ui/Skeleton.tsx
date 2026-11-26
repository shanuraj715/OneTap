import { useEffect, useState } from "react";
import { Animated, View, type DimensionValue, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "./theme";

/** A grey block that gently pulses where content is about to appear (so the screen keeps its shape while loading). */
export function Skeleton({ width = "100%", height = 16, radius = 8, style }: { width?: DimensionValue; height?: number; radius?: number; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const [pulse] = useState(() => new Animated.Value(0.45));
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }), Animated.timing(pulse, { toValue: 0.45, duration: 700, useNativeDriver: true })]));
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return <Animated.View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[{ width, height, borderRadius: radius, backgroundColor: c.surfaceAlt, opacity: pulse }, style]} />;
}

/** The shape of a table card while the tables load. */
export function TableCardSkeleton({ width }: { width?: number }) {
  return (
    <View style={{ width, padding: 12, gap: 8 }}>
      <Skeleton width="50%" height={22} />
      <Skeleton width="70%" height={14} />
      <Skeleton width="40%" height={14} />
    </View>
  );
}
