import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/**
 * Is the phone asking for less motion? (Android: Settings → Accessibility → "Remove animations", or the animation scales set to off.)
 * `Animated` does NOT look at this by itself, so every endless or decorative movement in the app asks here first: when it is on, the background
 * stands still, placeholders do not shimmer, and lists, numbers and charts appear at once instead of moving in.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled?.().then((on) => { if (live) setReduced(Boolean(on)); }, () => undefined);
    const sub = AccessibilityInfo.addEventListener?.("reduceMotionChanged", (on) => setReduced(Boolean(on)));
    return () => { live = false; sub?.remove?.(); };
  }, []);
  return reduced;
}
