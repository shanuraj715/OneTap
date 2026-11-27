import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { toasts } from "@/ui/toast-store";

/** What went wrong, in a sentence (a 403 says it's the role, not a fault). */
export const messageOf = (e: unknown) => ((e as { status?: number })?.status === 403 ? "Your role can't do this." : e instanceof Error ? e.message : "Something went wrong. Try again.");

/**
 * A change the person asked for: it runs, says "done" (or why not) in a toast, and the lists it affected load again.
 * `invalidate` names what changed so the screens behind it never show the old answer.
 */
export function useAction<V>(run: (v: V) => Promise<unknown>, opts: { done: string | ((v: V) => string); invalidate?: QueryKey[]; onDone?: (v: V) => void }) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: (_r, v) => {
      toasts.ok(typeof opts.done === "function" ? opts.done(v) : opts.done);
      for (const queryKey of opts.invalidate ?? []) void qc.invalidateQueries({ queryKey });
      opts.onDone?.(v);
    },
    onError: (e) => { toasts.error(messageOf(e)); },
  });
}
