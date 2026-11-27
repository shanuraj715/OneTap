import { useEffect, useState } from "react";
import { Link, useNavigate } from "../../lib/nav";
import { ArrowRight, Database, Eraser, Eye } from "lucide-react";
import * as api from "../../lib/api";
import { useCacheOverview, useStoreCache, usePlatformMutation } from "../../lib/usePlatform";
import { Button, Card, Field, Note, TextInput, Toast } from "../../ui";
import { ExpireDialog } from "./CacheExpire";
import { ago, bytes, count, dateTime } from "./viz/format";
import { muted, row } from "./shared";
import { CacheEntryModal } from "./CacheViewer";

/** "30 seconds", "15 minutes", "1 hour", "1 hour 30 minutes", "1 minute 30 seconds" — and "off" for 0. A fraction of a second is rounded; something that isn't a number is "—". */
export function duration(seconds) {
  if (seconds === null || seconds === undefined || seconds === "") return "—"; // no value is not "off"
  const total = Math.round(Number(seconds));
  if (!Number.isFinite(total) || total < 0) return "—";
  if (total === 0) return "off";
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const part = (n, one, many) => (n ? `${n} ${n === 1 ? one : many}` : "");
  return [part(h, "hour", "hours"), part(m, "minute", "minutes"), part(s, "second", "seconds")].filter(Boolean).join(" ");
}

/** What each kind of cached entry is, in words. */
const KINDS = {
  host: "Which store a web address belongs to",
  store: "The store's look, settings and outlets",
  menu: "An outlet's menu",
  outlet: "Which store an outlet belongs to",
  plan: "The plan and its limits",
  cap: "How busy the kitchen is",
  brandslug: "Which store a short name belongs to",
};

const when = (iso) => (iso ? `${ago(iso)} (${dateTime(iso)})` : "never");

/* ------------------------------------------------------------- settings page */

/** Platform settings → Cache: how long data is remembered, how well that is working, and expiring it. */
export function CacheSettingsCard() {
  const navigate = useNavigate();
  const q = useCacheOverview();
  const c = q.data?.cache;

  const [seconds, setSeconds] = useState("");
  useEffect(() => {
    if (c) setSeconds(String(c.ttlSeconds));
  }, [c?.ttlSeconds]); // eslint-disable-line react-hooks/exhaustive-deps
  const valid = /^\d+$/.test(seconds) && Number(seconds) <= 86_400;

  const save = usePlatformMutation(() => api.setCacheTtl(Number(seconds)));

  return (
    <Card
      title="Cache"
      icon={<Database size={16} />}
      subtitle="So pages open fast, Rasoi Pulse remembers each store's look, settings and menu for a while instead of reading the database for every visitor. When the time is up, the next visitor loads it fresh and the memory fills up again."
      action={
        <Button variant="outline" onClick={() => navigate("/platform/cache")} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
          <Eye size={14} /> View what's cached
        </Button>
      }
    >
      <Field label="Remember for" hint="Seconds · 0 turns the memory off · up to 86,400 (a day)">
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <TextInput type="number" min={0} max={86400} value={seconds} onChange={(e) => setSeconds(e.target.value)} style={{ width: 120 }} aria-label="Seconds to remember" data-testid="cache-lifetime-input" />
          <span style={muted} data-testid="cache-lifetime-text">= {valid ? duration(Number(seconds)) : "—"}</span>
          <Button disabled={!valid || save.isPending || (c && Number(seconds) === c.ttlSeconds)} onClick={() => save.mutate()}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </Field>
      {save.error ? <Toast kind="error">{save.error.message}</Toast> : null}
      {save.isSuccess && !save.isPending ? <Toast kind="ok">Saved — it applies from the next visitor.</Toast> : null}
      <p style={muted}>
        Changes made in this console — a menu item, a theme, a plan, a price — show up straight away whatever this is set to; they clear the
        old copy themselves. The time only decides how long a change made some other way (for example straight in the database) can take to
        appear. Orders always read prices from the database, never from this memory.
      </p>

      <p style={{ ...muted, marginTop: 4 }} data-testid="cache-lifetime-now">
        {c ? (c.enabled ? `Right now: remembering for ${duration(c.ttlSeconds)}.` : "Right now the memory is switched off: every visit reads the database.") : q.isError ? q.error.message : "Loading…"}
      </p>
      <Note icon={<Eraser size={16} />}>
        <strong>Expiring the cache</strong> (so the next visit loads fresh data) is done on the Cache page: for the admin panel, for one outlet, for one store, or for everything. Each one tells you what it will drop before it does anything.{" "}
        <button type="button" className="viz-btn" onClick={() => navigate("/platform/cache")}>
          Open the Cache page
        </button>
      </Note>
    </Card>
  );
}

/* ------------------------------------------------------------- a store's page */

/** One store's tab: what is remembered for it right now, and a button to expire just that. */
export function StoreCacheCard({ store }) {
  const [viewKey, setViewKey] = useState(null);
  const q = useStoreCache(store.id);
  const expire = usePlatformMutation(() => api.expireCache({ scope: "store", storeId: store.id }));
  const [asking, setAsking] = useState(false);
  const c = q.data?.cache;
  const result = expire.data;

  return (
    <Card
      title={`Cache — ${store.name}`}
      icon={<Database size={16} />}
      subtitle="What Rasoi Pulse is remembering for this store so its pages open fast. Expire it to make the next visitor load everything fresh."
      action={
        <Button disabled={expire.isPending || !c} onClick={() => setAsking(true)} style={{ display: "inline-flex", gap: 6, alignItems: "center" }} data-testid="store-cache-expire">
          <Eraser size={14} /> Expire this store's cache
        </Button>
      }
    >
      {!c ? (
        <p style={muted}>{q.isError ? q.error.message : "Loading…"}</p>
      ) : (
        <>
          <p style={{ ...muted, marginTop: 0 }}>
            {c.enabled ? `Remembered for ${duration(c.ttlSeconds)} (Platform settings → Cache).` : "The memory is switched off in Platform settings, so nothing is kept."} Last expired by hand: {when(c.lastExpiredAt)}.
          </p>
          {c.entries.length === 0 ? (
            <p style={muted}>Nothing is remembered for this store right now. It is remembered the next time someone opens it.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {c.entries.map((e) => (
                <div key={e.key} style={row}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontWeight: 600 }}>{KINDS[e.kind] ?? e.kind}</div>
                    <div style={muted}>
                      remembered {e.ageSeconds < 5 ? "just now" : `${duration(e.ageSeconds)} ago`} · {bytes(e.bytes)}
                    </div>
                  </div>
                  <span style={muted}>{e.expiresInSeconds > 0 ? `reloads after ${duration(e.expiresInSeconds)}` : "reloads at the next visit"}</span>
                  <Button variant="outline" onClick={() => setViewKey(e.key)} aria-label={`View the data: ${KINDS[e.kind] ?? e.kind}`} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                    <Eye size={14} /> View data
                  </Button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {expire.error ? <Toast kind="error">{expire.error.message}</Toast> : null}
      {result ? (
        <Toast kind="ok">
          Expired — {count(result.removed)} {result.removed === 1 ? "item" : "items"} cleared. The next visitor loads fresh data.
        </Toast>
      ) : null}
      {viewKey ? <CacheEntryModal entryKey={viewKey} onClose={() => setViewKey(null)} /> : null}
      {asking && c ? (
        <ExpireDialog
          ask={{ scope: "store", name: store.name, entries: c.entries.map((e) => ({ ...e, label: KINDS[e.kind] ?? e.kind })) }}
          busy={expire.isPending}
          error={expire.error?.message}
          onConfirm={() => expire.mutate(undefined, { onSuccess: () => setAsking(false) })}
          onClose={() => setAsking(false)}
        />
      ) : null}
    </Card>
  );
}

/* ------------------------------------------------------------ the dashboard */

/** One line for the dashboard: how well the cache is working, and a way in to what it holds. */
export function CacheStrip() {
  const q = useCacheOverview();
  const c = q.data?.cache;
  return (
    <Link to="/platform/cache" className="viz viz-tile srv-strip" title="See what is cached">
      <div style={{ minWidth: 150 }}>
        <div className="viz-tile-label">Cache</div>
        {c ? (
          <div className="viz-tile-value">
            {c.enabled ? (c.stats.hitRate === null ? "—" : `${Math.round(c.stats.hitRate * 100)}%`) : "Off"}
            <span style={{ fontSize: 13, fontWeight: 500, color: "var(--viz-ink-muted)", marginLeft: 8 }}>{c.enabled ? "of lookups answered from memory" : "every visit reads the database"}</span>
          </div>
        ) : (
          <div className="viz-tile-note" style={{ marginTop: 6 }}>{q.isError ? "Couldn't read the cache just now." : "Reading…"}</div>
        )}
      </div>
      {c ? (
        <div className="srv-strip-facts">
          <span>
            Remembering <b>{count(c.stats.entries)}</b> {c.stats.entries === 1 ? "item" : "items"}
          </span>
          <span>
            Size <b>{bytes(c.stats.bytes)}</b>
          </span>
          {c.enabled ? (
            <span>
              Kept for <b>{duration(c.ttlSeconds)}</b>
            </span>
          ) : null}
        </div>
      ) : null}
      <span style={{ color: "var(--viz-ink-muted)", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12.5 }}>
        View <ArrowRight size={14} aria-hidden />
      </span>
    </Link>
  );
}
