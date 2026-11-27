/**
 * The app's live connection to the server: ONE WebSocket that tells the app "something changed", so it asks for new data only then
 * (instead of every few seconds). This file is plain TypeScript (no React, no phone APIs) so every rule below can be tested.
 *
 * What the connection does, in words:
 *  - connects when started, and says `onResync` each time it is (re)connected — the app then loads everything once, so a change that
 *    happened while the line was down is never missed;
 *  - passes on every `{ type: "changed", what: [...] }` message (`onChange`); the server never sends data, only what to load again;
 *  - when the line drops it tries again by itself — after 1 s, 2 s, 4 s … up to 30 s (a little random, so a restaurant's tablets don't all
 *    knock at the same moment after the server restarts) — and reports `"reconnecting"` the whole time, so the screen can show a loader;
 *  - the server sends a small "tick" every 20 s; a line that has said nothing for 55 s is dead (a phone that slept, a Wi-Fi that dropped
 *    silently) and is replaced;
 *  - `wake()` (the app came back to the front, the internet came back) reconnects at once instead of waiting out the pause;
 *  - when the SERVER refuses live updates (the platform switched them off, an old server, "not allowed", too many connects) the status is
 *    `"fallback"`: the app goes back to asking on a timer, and quietly tries again every minute.
 */

export type LiveStatus = "idle" | "connecting" | "live" | "reconnecting" | "fallback";

/** The few things of a WebSocket the connection uses (the phone's WebSocket has them all; a test passes a stand-in). */
export interface SocketLike {
  onopen: ((event?: unknown) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: ((event: { message?: string }) => void) | null;
  onclose: ((event: { code?: number; reason?: string }) => void) | null;
  close(code?: number, reason?: string): void;
}

export interface LiveOptions {
  /** where to connect, or null while there is nothing to connect for (nobody signed in) */
  url(): string | null;
  /** the headers of the connection (the sign-in goes here, never in the address) */
  headers(): Record<string, string>;
  /** the server says these kinds of data changed */
  onChange(what: string[]): void;
  /** connected (the first time or again): load everything once */
  onResync(): void;
  onStatus(status: LiveStatus): void;
  createSocket?: (url: string, headers: Record<string, string>) => SocketLike;
  random?: () => number;
  now?: () => number;
  /** the pauses and limits, in milliseconds (tests make them small) */
  backoffBaseMs?: number;
  backoffMaxMs?: number;
  silentAfterMs?: number;
  fallbackRetryMs?: number;
  checkEveryMs?: number;
}

/** Close codes the server uses: 4401 signed out · 4403 store switched off · 4410 the platform switched live updates off. */
const REFUSED_CODES = new Set([4401, 4403, 4410]);

/**
 * Did the SERVER say no (so asking again at once is pointless), as opposed to the line simply dropping?
 * A refused upgrade shows up as an error like "Expected HTTP 101 response but was '503 Service Unavailable'"; a restarting server
 * (nginx: 502 / 504) is NOT a refusal — the line will be back in a moment.
 */
export function isRefusal(message: string | undefined, code?: number): boolean {
  if (code !== undefined && REFUSED_CODES.has(code)) return true;
  const text = String(message ?? "");
  if (/\b(502|504)\b|bad gateway|gateway time-?out/i.test(text)) return false;
  if (/Expected HTTP 101 response but was/i.test(text)) return true;
  return /\b(400|401|403|404|429|503)\b/.test(text) && /(unauthori[sz]ed|forbidden|not found|bad request|too many|unavailable)/i.test(text);
}

/** The phone's own WebSocket. Its third argument (the headers — how the sign-in travels without being put in the address) is a React Native feature the DOM types don't know. */
type PhoneSocket = new (url: string, protocols?: string[] | null, options?: { headers: Record<string, string> }) => SocketLike;
const defaultSocket = (url: string, headers: Record<string, string>): SocketLike => new (WebSocket as unknown as PhoneSocket)(url, null, { headers });

export function createLiveConnection(options: LiveOptions) {
  const base = options.backoffBaseMs ?? 1000;
  const cap = options.backoffMaxMs ?? 30_000;
  const silentAfter = options.silentAfterMs ?? 55_000;
  const refusedRetry = options.fallbackRetryMs ?? 60_000;
  const checkEvery = options.checkEveryMs ?? 10_000;
  const random = options.random ?? Math.random;
  const now = options.now ?? Date.now;

  let status: LiveStatus = "idle";
  let running = false;
  let socket: SocketLike | null = null;
  let attempt = 0;
  let lastHeard = 0;
  let lastError: string | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let watchTimer: ReturnType<typeof setInterval> | null = null;

  const setStatus = (next: LiveStatus) => {
    if (next === status) return;
    status = next;
    options.onStatus(next);
  };
  const clearRetry = () => {
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
  };
  const schedule = (ms: number) => {
    clearRetry();
    retryTimer = setTimeout(open, ms);
  };
  const dropSocket = () => {
    const old = socket;
    socket = null;
    if (!old) return;
    old.onopen = old.onmessage = old.onerror = old.onclose = null;
    try { old.close(); } catch { /* already closed */ }
  };

  /** the line is gone (or never came): refused → ask on a timer and try again in a minute; otherwise try again soon, a little later each time */
  function lost(message?: string, code?: number) {
    if (!running) return;
    if (isRefusal(message, code)) {
      setStatus("fallback");
      schedule(refusedRetry);
      return;
    }
    setStatus("reconnecting");
    const wait = Math.min(cap, base * 2 ** attempt) * (0.5 + 0.5 * random());
    attempt += 1;
    schedule(wait);
  }

  function open() {
    clearRetry();
    if (!running) return;
    const url = options.url();
    if (!url) {
      setStatus("idle");
      return;
    }
    // the very first try shows "connecting"; every try after a loss stays "reconnecting" (no flicker between the two), and a refused
    // connection stays "fallback" while it keeps trying quietly
    if (status === "idle") setStatus("connecting");
    let ws: SocketLike;
    try {
      ws = (options.createSocket ?? defaultSocket)(url, options.headers());
    } catch (e) {
      lost(e instanceof Error ? e.message : String(e));
      return;
    }
    socket = ws;
    lastError = undefined;
    ws.onopen = () => {
      if (socket !== ws) return;
      attempt = 0;
      lastHeard = now();
      setStatus("live");
      options.onResync();
    };
    ws.onmessage = (event) => {
      if (socket !== ws) return;
      lastHeard = now();
      let message: unknown;
      try { message = JSON.parse(String(event.data)); } catch { return; }
      const m = message as { type?: unknown; what?: unknown };
      if (m?.type === "changed" && Array.isArray(m.what)) options.onChange(m.what.filter((w): w is string => typeof w === "string"));
    };
    ws.onerror = (event) => {
      if (socket !== ws) return;
      lastError = event?.message;
    };
    ws.onclose = (event) => {
      if (socket !== ws) return;
      socket = null;
      lost(lastError ?? event?.reason, event?.code);
    };
  }

  /** a line that has said nothing for too long is dead: replace it */
  function watch() {
    if (status !== "live" || !socket) return;
    if (now() - lastHeard <= silentAfter) return;
    dropSocket();
    lost("silent");
  }

  return {
    get status() { return status; },
    start() {
      if (running) return;
      running = true;
      attempt = 0;
      watchTimer = setInterval(watch, checkEvery);
      open();
    },
    stop() {
      running = false;
      clearRetry();
      if (watchTimer) clearInterval(watchTimer);
      watchTimer = null;
      dropSocket();
      attempt = 0;
      setStatus("idle");
    },
    /** the app is in front again, or the internet is back: don't wait out the pause (and don't trust a line that went quiet) */
    wake() {
      if (!running) return;
      if (status === "live") {
        if (now() - lastHeard > silentAfter / 2) { dropSocket(); attempt = 0; setStatus("reconnecting"); open(); }
        return;
      }
      if (status === "idle") { open(); return; }
      // reconnecting / fallback: try now; connecting: leave the attempt that is already under way
      if (status === "connecting") return;
      dropSocket();
      attempt = 0;
      open();
    },
  };
}
export type LiveConnection = ReturnType<typeof createLiveConnection>;
