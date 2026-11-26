import { createStore } from "zustand/vanilla";
import type { Api } from "@/api/endpoints";
import { updateRequiredSchema, type Release, type WhatsNew } from "@/api/schemas";
import { APP_BUILD } from "@/lib/config";

/**
 * Is there a newer version of the app? Asked when the app opens (before anyone signs in) and again when the app comes back to the front
 * after a long time away. Three answers matter:
 *   current   nothing newer exists
 *   available a newer version exists; the person may choose "Later"
 *   required  a newer version is marked required (by the platform admin): the app can't be used until it is installed
 * A check that can't reach the server changes nothing — a bad connection never blocks anyone — except that a sign-in refused by the server
 * with "update required" (426) puts the app straight into "required".
 */
export type UpdateStatus = "unknown" | "current" | "available" | "required";

export interface UpdateState {
  status: UpdateStatus;
  latest: Release | null;
  whatsNew: WhatsNew[];
  /** the web page to download the app from (opens in the phone's browser) */
  pageUrl: string | null;
  checking: boolean;
  /** when the last SUCCESSFUL check finished (ms), or null */
  checkedAt: number | null;
  /** the person pressed "Later" for this build number: don't ask again until the app is opened next */
  postponed: number | null;
  /** why the last check failed, for the "Check for updates" button to say (null when it worked) */
  error: string | null;
  /** `manual` = the person asked (Account → Check for updates): ask even about a version they said "Later" to */
  check(manual?: boolean): Promise<UpdateStatus>;
  later(): void;
  /** the server refused a sign-in with "update required" */
  markRequired(details: Record<string, unknown>): void;
  /** it has been a long while since the last good answer */
  isStale(): boolean;
}

/** Coming back after this long away asks again (a phone left on a shelf overnight may never be closed). */
export const RECHECK_AFTER_MS = 30 * 60_000;

export interface UpdateDeps { api: () => Api; build?: number; now?: () => number }

export function createUpdateStore({ api, build = APP_BUILD, now = Date.now }: UpdateDeps) {
  return createStore<UpdateState>()((set, get) => ({
    status: "unknown",
    latest: null,
    whatsNew: [],
    pageUrl: null,
    checking: false,
    checkedAt: null,
    postponed: null,
    error: null,

    async check(manual = false) {
      if (get().checking) return get().status;
      set({ checking: true, error: null });
      try {
        const answer = await api().checkForUpdate(build);
        set({
          status: !answer.updateAvailable ? "current" : answer.force ? "required" : "available",
          latest: answer.updateAvailable ? answer.latest : null,
          whatsNew: answer.updateAvailable ? answer.whatsNew : [],
          pageUrl: answer.pageUrl,
          checkedAt: now(),
          checking: false,
          postponed: manual ? null : get().postponed,
        });
      } catch (e) {
        set({ checking: false, error: e instanceof Error ? e.message : "Couldn't check for updates." });
      }
      return get().status;
    },

    later() {
      const { status, latest } = get();
      if (status === "available" && latest) set({ postponed: latest.versionCode });
    },

    markRequired(details) {
      const parsed = updateRequiredSchema.safeParse(details);
      if (!parsed.success) return;
      set({ status: "required", latest: parsed.data.latest ?? get().latest, whatsNew: [], pageUrl: parsed.data.pageUrl });
    },

    isStale() {
      const at = get().checkedAt;
      return at === null || now() - at > RECHECK_AFTER_MS;
    },
  }));
}
export type UpdateStore = ReturnType<typeof createUpdateStore>;

/** Should the "new version" pop-up be showing? Only for an optional update the person hasn't said "Later" to. */
export const shouldOfferUpdate = (s: Pick<UpdateState, "status" | "latest" | "postponed">): boolean => s.status === "available" && !!s.latest && s.postponed !== s.latest.versionCode;
