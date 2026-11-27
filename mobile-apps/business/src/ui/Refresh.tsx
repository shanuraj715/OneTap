import { useEffect, useMemo, useState } from "react";
import { Animated, Easing, Platform, RefreshControl, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewProps } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReducedMotion } from "./motion";
import { Glass } from "./primitives";
import { useTheme } from "./theme";

/** How far (in px) a finger must pull past the top before letting go refreshes (iPhone and iPad; Android decides this itself). */
export const PULL_AT = 72;
/** How far below the top of the screen the loader sits: under the title, not up against the status bar. */
export const LOADER_TOP = 132;

/**
 * Pull down to refresh, drawn by US instead of by the phone's own spinner (a small circle at the very top, white on white in light mode and a
 * poor match for the glass look). The phone's own pull gesture still decides WHEN to refresh; its spinner is made invisible and pushed away.
 *  - iPhone / iPad: the scroll position tells how far the finger has pulled; the loader grows in as you pull, and letting go past `PULL_AT` refreshes.
 *  - Android: the system refresh control does the gesture (we can't see the finger); the loader appears when the refresh starts.
 * Returns the props for the ScrollView, and the pull distance for the loader.
 */
export function usePullToRefresh(onRefresh: (() => void) | undefined, refreshing: boolean): { scrollProps: Partial<ScrollViewProps>; pull: Animated.Value } {
  const [pull] = useState(() => new Animated.Value(0));
  const scrollProps = useMemo<Partial<ScrollViewProps>>(() => {
    if (!onRefresh) return {};
    if (Platform.OS === "ios") {
      return {
        bounces: true, alwaysBounceVertical: true, scrollEventThrottle: 16,
        onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => pull.setValue(Math.max(0, -e.nativeEvent.contentOffset.y)),
        onScrollEndDrag: (e: NativeSyntheticEvent<NativeScrollEvent>) => { if (!refreshing && -e.nativeEvent.contentOffset.y >= PULL_AT) onRefresh(); },
      };
    }
    return { refreshControl: <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["transparent"]} tintColor="transparent" progressBackgroundColor="transparent" progressViewOffset={-160} /> };
  }, [onRefresh, refreshing, pull]);
  return { scrollProps, pull };
}

/**
 * The loader: a frosted capsule with a turning arc. The arc is dark in light mode and light in dark mode (the theme's own text colour), so it reads on
 * either. It fades and grows in while a refresh runs and out when it is done.
 */
export function RefreshIndicator({ refreshing, pull }: { refreshing: boolean; pull: Animated.Value }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [appear] = useState(() => new Animated.Value(0));
  const [spin] = useState(() => new Animated.Value(0));
  const [mounted, setMounted] = useState(false);
  if (refreshing && !mounted) setMounted(true); // Android draws it only while it is needed; iOS keeps it so it can follow the finger

  useEffect(() => {
    Animated.timing(appear, { toValue: refreshing ? 1 : 0, duration: refreshing ? 200 : 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(({ finished }) => { if (finished && !refreshing && Platform.OS !== "ios") setMounted(false); });
  }, [refreshing, appear]);
  useEffect(() => {
    if (!refreshing || reduced) { spin.setValue(0); return; }
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 850, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [refreshing, reduced, spin]);

  if (!mounted && Platform.OS !== "ios") return null;
  const pulled = pull.interpolate({ inputRange: [0, PULL_AT], outputRange: [0, 1], extrapolate: "clamp" });
  const show = Animated.add(appear, pulled).interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: "clamp" });
  const turn = Animated.add(spin, pulled.interpolate({ inputRange: [0, 1], outputRange: [0, 0.6] })).interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  return (
    <Animated.View pointerEvents="none" testID="refresh-indicator" accessibilityLiveRegion="polite" accessibilityLabel={refreshing ? "Refreshing" : undefined}
      style={{ position: "absolute", top: insets.top + LOADER_TOP, left: 0, right: 0, alignItems: "center", opacity: show, transform: [{ translateY: show.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] }) }, { scale: show.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }}>
      <Glass strong radiusSize={28} padding={12}>
        <Animated.View style={{ transform: [{ rotate: turn }] }}>
          <Svg width={28} height={28} viewBox="0 0 28 28">
            <Circle cx="14" cy="14" r="11" stroke={c.text} strokeOpacity={0.18} strokeWidth="3" fill="none" />
            <Circle testID="refresh-arc" cx="14" cy="14" r="11" stroke={c.text} strokeWidth="3" strokeLinecap="round" strokeDasharray="38 70" fill="none" />
          </Svg>
        </Animated.View>
      </Glass>
    </Animated.View>
  );
}
