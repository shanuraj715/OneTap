import { useEffect, useState } from "react";

/** The current time, refreshed every `everyMs` while `enabled` (a countdown, "seated 12 min" that keeps counting). */
export function useNow(everyMs = 30_000, enabled = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(timer);
  }, [everyMs, enabled]);
  return now;
}
