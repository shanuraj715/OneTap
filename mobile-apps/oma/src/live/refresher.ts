import type { QueryClient, QueryKey } from "@tanstack/react-query";

/**
 * Turns "these kinds of data changed" into fresh answers from the server, without a burst of changes piling up requests:
 * the first change is asked for at once; further changes of the same kind within a second are asked for ONCE, when that second
 * is over (so the screen always ends up showing what the server holds, and a busy hour can't keep restarting the same request).
 */
export function createRefresher(
  client: Pick<QueryClient, "invalidateQueries">,
  keysFor: (what: string, outletId: string) => QueryKey[],
  everything: (outletId: string) => QueryKey[],
  options: { minGapMs?: number; now?: () => number } = {},
) {
  const gap = options.minGapMs ?? 1000;
  const now = options.now ?? Date.now;
  const last = new Map<string, number>();
  const waiting = new Map<string, ReturnType<typeof setTimeout>>();

  const run = (id: string, keyList: QueryKey[]) => {
    last.set(id, now());
    for (const queryKey of keyList) void client.invalidateQueries({ queryKey }).catch(() => undefined);
  };
  const ask = (id: string, keyList: QueryKey[]) => {
    if (waiting.has(id)) return; // a refresh is already booked for the end of this second — it will see the newest data
    const since = now() - (last.get(id) ?? -Infinity);
    if (since >= gap) return run(id, keyList);
    waiting.set(id, setTimeout(() => { waiting.delete(id); run(id, keyList); }, gap - since));
  };

  return {
    /** the server said these kinds of data changed */
    changed(what: string[], outletId: string) {
      for (const kind of new Set(what)) {
        const keyList = keysFor(kind, outletId);
        if (keyList.length) ask(`${kind}:${outletId}`, keyList);
      }
    },
    /** (re)connected: everything is loaded again, once, now */
    resync(outletId: string) {
      // everything is being loaded right now: a catch-up booked for one kind of this outlet would only repeat it
      for (const [id, timer] of waiting) if (id.endsWith(`:${outletId}`)) { clearTimeout(timer); waiting.delete(id); }
      run(`all:${outletId}`, everything(outletId));
    },
    /** forget everything booked (the person signed out) */
    stop() {
      for (const timer of waiting.values()) clearTimeout(timer);
      waiting.clear();
      last.clear();
    },
  };
}
