"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** True when the visitor's device asks for less motion — slideshows then stop moving by themselves. */
export function useReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = typeof window !== "undefined" ? window.matchMedia?.("(prefers-reduced-motion: reduce)") : null;
    if (!mq) return undefined;
    const on = () => setReduce(mq.matches);
    on();
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return reduce;
}

/** False while the browser tab is in the background, so nothing keeps animating where nobody can see it. */
function usePageVisible() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const on = () => setVisible(document.visibilityState !== "hidden");
    on();
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, []);
  return visible;
}

/**
 * The state behind every slideshow: which slide is showing, next / previous / jump, an optional timer that
 * advances it, and the handlers that pause the timer while someone is pointing at (or focused in) it and let a
 * finger swipe between slides. The timer never runs for visitors who ask for reduced motion, for a hidden tab,
 * or when there is only one slide.
 *
 * @param {number} count how many slides
 * @param {{ autoplay?: boolean, intervalMs?: number }} [options]
 */
export function useSlides(count, { autoplay = false, intervalMs = 5000 } = {}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduce = useReducedMotion();
  const visible = usePageVisible();
  const touchX = useRef(null);

  // the slide list can shrink while someone is on the last slide (the editor removes one)
  useEffect(() => {
    setIndex((i) => (count > 0 && i >= count ? 0 : i));
  }, [count]);

  const next = useCallback(() => setIndex((i) => (count ? (i + 1) % count : 0)), [count]);
  const prev = useCallback(() => setIndex((i) => (count ? (i - 1 + count) % count : 0)), [count]);

  const running = autoplay && count > 1 && !paused && !reduce && visible;
  useEffect(() => {
    if (!running) return undefined;
    // a new timer for each slide: moving by hand restarts the wait instead of cutting it short
    const timer = setTimeout(next, Math.max(1500, intervalMs));
    return () => clearTimeout(timer);
  }, [running, index, intervalMs, next]);

  const bind = {
    onMouseEnter: () => setPaused(true),
    onMouseLeave: () => setPaused(false),
    onFocus: () => setPaused(true),
    onBlur: () => setPaused(false),
    onTouchStart: (e) => {
      touchX.current = e.touches?.[0]?.clientX ?? null;
    },
    onTouchEnd: (e) => {
      const start = touchX.current;
      touchX.current = null;
      const end = e.changedTouches?.[0]?.clientX;
      if (start === null || end === undefined) return;
      const dx = end - start;
      if (Math.abs(dx) > 40) (dx < 0 ? next : prev)();
    },
  };

  return { index, setIndex, next, prev, running, bind };
}
