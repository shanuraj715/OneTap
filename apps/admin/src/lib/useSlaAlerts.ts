import { useEffect, useMemo, useRef, useState } from "react";
import { evaluateSla, type SlaBreach, type SlaSettings } from "@onetap/config-schema";
import type { AdminOrder } from "./api";

/**
 * A short, deliberately unpleasant two-tone chime.
 *
 * Built with the Web Audio API rather than an audio file so it ships with no
 * asset and no network request — a sound that fails to load is a missed order.
 */
function playChime(): void {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    const now = ctx.currentTime;

    for (const [i, freq] of [880, 660].entries()) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      // Short envelope, so it cuts through kitchen noise without ringing on.
      gain.gain.setValueAtTime(0.0001, now + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.22, now + i * 0.18 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.18 + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + i * 0.18);
      osc.stop(now + i * 0.18 + 0.18);
    }
    setTimeout(() => void ctx.close(), 800);
  } catch {
    // Autoplay policy, no audio device — the visible banner still fires.
  }
}

export interface SlaState {
  breaches: SlaBreach[];
  /** breaches the user has waved away, by order id */
  dismissed: Set<string>;
  dismiss: (orderId: string) => void;
  dismissAll: () => void;
  /** true once the browser has let us make a sound */
  soundReady: boolean;
}

const REPEAT_MS = 60_000;

/**
 * Watches every open order against the outlet's configured limits and surfaces
 * the ones that have been sitting too long.
 *
 * Recomputed on a ticking clock rather than only when orders change, because
 * the whole point is to notice an order that nothing is happening to.
 */
export function useSlaAlerts(orders: AdminOrder[], sla: SlaSettings | undefined): SlaState {
  const [now, setNow] = useState(() => Date.now());
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [soundReady, setSoundReady] = useState(false);
  // When each order was last alerted about, so a repeat alert doesn't fire
  // every single tick.
  const lastAlertRef = useRef<Map<string, number>>(new Map());

  // A one-second tick keeps the elapsed timers honest without re-fetching.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(t);
  }, []);

  // Browsers refuse to make noise until the user has interacted with the page.
  useEffect(() => {
    const unlock = () => setSoundReady(true);
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const breaches = useMemo(() => {
    if (!sla?.enabled) return [];
    return orders
      .map((o) => evaluateSla(o, sla, now))
      .filter((b): b is SlaBreach => b !== null)
      .sort((a, b) => b.waitedMinutes - a.waitedMinutes);
  }, [orders, sla, now]);

  // An order that gets dismissed and then breaches a *different* rule (it was
  // accepted late, and is now cooking late) should speak up again.
  const activeKeys = breaches.map((b) => `${b.orderId}:${b.rule}`).join(",");
  useEffect(() => {
    setDismissed((prev) => {
      const live = new Set(breaches.map((b) => b.orderId));
      const next = new Set([...prev].filter((id) => live.has(id)));
      return next.size === prev.size ? prev : next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKeys]);

  const audible = breaches.filter((b) => !dismissed.has(b.orderId));

  useEffect(() => {
    if (!sla?.enabled || !sla.sound || !soundReady || !audible.length) return;

    const map = lastAlertRef.current;
    const dueForAlert = audible.some((b) => {
      const key = `${b.orderId}:${b.rule}`;
      const last = map.get(key);
      if (last === undefined) return true;
      return sla.repeatAlert && now - last > REPEAT_MS;
    });
    if (!dueForAlert) return;

    for (const b of audible) map.set(`${b.orderId}:${b.rule}`, now);
    playChime();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKeys, soundReady, sla?.enabled, sla?.sound, sla?.repeatAlert]);

  return {
    breaches: audible,
    dismissed,
    dismiss: (orderId) => setDismissed((prev) => new Set(prev).add(orderId)),
    dismissAll: () => setDismissed(new Set(breaches.map((b) => b.orderId))),
    soundReady,
  };
}
