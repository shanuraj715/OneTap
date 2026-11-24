import { useEffect, useState } from "react";
import { Link, useNavigate } from "../../lib/nav";
import { ArrowRight, Database, Eraser, Eye } from "lucide-react";
import * as api from "../../lib/api";
import { useCacheOverview, useStoreCache, useStores, usePlatformMutation } from "../../lib/usePlatform";
import { Button, Card, Field, Note, Select, TextInput, Toast } from "../../ui";
import { ago, bytes, count, dateTime } from "./viz/format";
import { muted, row } from "./shared";
import { CacheEntryModal } from "./CacheViewer";

/** "5 minutes", "1 hour", "30 seconds" — and "off" for 0. */
export function duration(seconds) {
  if (seconds <= 0) return "off";
  if (seconds < 60) return `${seconds} ${seconds === 1 ? "second" : "seconds"}`;
  if (seconds < 3600) {
    const m = Math.round(seconds / 60);
    return seconds % 60 === 0 ? `${m} ${m === 1 ? "minute" : "minutes"}` : `${seconds} seconds`;
  }
  const h = seconds / 3600;
  return Number.isInteger(h) ? `${h} ${h === 1 ? "hour" : "hours"}` : `${Math.round(seconds / 60)} minutes`;
}

const PRESETS = [
  { seconds: 30, label: "30 s" },
  { seconds: 60, label: "1 min" },
  { seconds: 300, label: "5 min" },
  { seconds: 900, label: "15 min" },
  { seconds: 3600, label: "1 hour" },
  { seconds: 0, label: "Off" },
];

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
  const stores = useStores();
  const c = q.data?.cache;

  const [seconds, setSeconds] = useState("");
  useEffect(() => {
    if (c) setSeconds(String(c.ttlSeconds));
  }, [c?.ttlSeconds]); // eslint-disable-line react-hooks/exhaustive-deps
  const valid = /^\d+$/.test(seconds) && Number(seconds) <= 86_400;

  const save = usePlatformMutation(() => api.setCacheTtl(Number(seconds)));
  const expire = usePlatformMutation((body) => api.expireCache(body));
  const [confirmAll, setConfirmAll] = useState(false);
  const [pick, setPick] = useState("");

  const allStores = stores.data?.stores ?? [];
  const busy = expire.isPending;
  const result = expire.data?.result;

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
          <TextInput type="number" min={0} max={86400} value={seconds} onChange={(e) => setSeconds(e.target.value)} style={{ width: 120 }} aria-label="Seconds to remember" />
          <span style={muted}>= {valid ? duration(Number(seconds)) : "—"}</span>
          {PRESETS.map((p) => (
            <Button key={p.label} variant="outline" onClick={() => setSeconds(String(p.seconds))} style={Number(seconds) === p.seconds ? { boxShadow: "0 0 0 1px var(--color-primary)" } : undefined}>
              {p.label}
            </Button>
          ))}
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

      {c ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, margin: "14px 0" }}>
          <Stat label="Working" value={c.stats.hitRate === null ? "—" : `${Math.round(c.stats.hitRate * 100)}%`} note="of lookups answered from memory" />
          <Stat label="Remembered now" value={count(c.stats.entries)} note={bytes(c.stats.bytes)} />
          <Stat label="Saved a trip" value={count(c.stats.hits + c.stats.coalesced)} note={`${count(c.stats.misses)} had to ask the database`} />
          <Stat label="Last expired" value={c.lastExpiredAt ? ago(c.lastExpiredAt) : "never"} note="everything, by hand" />
        </div>
      ) : (
        <p style={muted}>{q.isError ? q.error.message : "Loading…"}</p>
      )}
      {c ? (
        <p style={{ ...muted, marginTop: -4 }}>
          Counting since the API started ({ago(c.stats.since)}). {c.enabled ? `Remembering for ${duration(c.ttlSeconds)}.` : "The memory is switched off: every visit reads the database."}
        </p>
      ) : null}

      <Note icon={<Eraser size={16} />}>
        <strong>Expire the cache</strong> to make the next visitor load fresh data. Use it after changing something outside the console, or
        to force a refresh. It can be done for every store at once, or for just one.
      </Note>

      <div style={{ ...row, marginTop: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontWeight: 600 }}>Every store</div>
          <div style={muted}>Clears everything remembered, and tells the marketing website to refresh too.</div>
        </div>
        {confirmAll ? (
          <>
            <span style={{ fontSize: 13 }}>Expire everything?</span>
            <Button
              disabled={busy}
              onClick={() => {
                expire.mutate({ scope: "all" });
                setConfirmAll(false);
              }}
            >
              Yes, expire everything
            </Button>
            <Button variant="outline" onClick={() => setConfirmAll(false)}>
              Cancel
            </Button>
          </>
        ) : (
          <Button variant="outline" disabled={busy} onClick={() => setConfirmAll(true)}>
            Expire everything
          </Button>
        )}
      </div>

      <div style={{ ...row, marginTop: 8, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontWeight: 600 }}>One store</div>
          <div style={muted}>Clears only what is remembered for the store you pick.</div>
        </div>
        <Select value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Store to expire" style={{ minWidth: 200 }}>
          <option value="">Choose a store…</option>
          {allStores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        <Button variant="outline" disabled={!pick || busy} onClick={() => expire.mutate({ scope: "store", storeId: pick })}>
          Expire this store
        </Button>
      </div>

      {expire.error ? <Toast kind="error">{expire.error.message}</Toast> : null}
      {result ? (
        <Toast kind="ok">
          {result.scope === "all" ? "Everything was expired" : `${result.store.name} was expired`} — {count(result.removed)} {result.removed === 1 ? "item" : "items"} cleared. The next visitor loads fresh data.
        </Toast>
      ) : null}

      {c && c.stores.length > 0 ? (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Stores in memory</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {c.stores.map((s) => (
              <div key={s.id} style={row}>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ fontWeight: 600 }}>{s.name}</div>
                  <div style={muted}>
                    {s.entries} {s.entries === 1 ? "item" : "items"} · {bytes(s.bytes)} · last expired {s.lastExpiredAt ? ago(s.lastExpiredAt) : "never"}
                  </div>
                </div>
                <Button variant="outline" disabled={busy} onClick={() => expire.mutate({ scope: "store", storeId: s.id })}>
                  Expire
                </Button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <p style={{ ...muted, marginTop: 14 }}>
        This is the memory of the API server you're connected to. If several API servers share one database, each has its own; an
        expiry reaches the others within about 30 seconds.
      </p>
    </Card>
  );
}

function Stat({ label, value, note }) {
  return (
    <div style={{ padding: "10px 12px", border: "1px solid var(--color-border)", borderRadius: 10 }}>
      <div style={muted}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 650 }}>{value}</div>
      <div style={{ ...muted, fontSize: 11.5 }}>{note}</div>
    </div>
  );
}

/* ------------------------------------------------------------- a store's page */

/** One store's tab: what is remembered for it right now, and a button to expire just that. */
export function StoreCacheCard({ store }) {
  const [viewKey, setViewKey] = useState(null);
  const q = useStoreCache(store.id);
  const expire = usePlatformMutation(() => api.expireCache({ scope: "store", storeId: store.id }));
  const c = q.data?.cache;
  const result = expire.data?.result;

  return (
    <Card
      title={`Cache — ${store.name}`}
      icon={<Database size={16} />}
      subtitle="What Rasoi Pulse is remembering for this store so its pages open fast. Expire it to make the next visitor load everything fresh."
      action={
        <Button disabled={expire.isPending} onClick={() => expire.mutate()} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
          <Eraser size={14} /> {expire.isPending ? "Expiring…" : "Expire this store's cache"}
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
