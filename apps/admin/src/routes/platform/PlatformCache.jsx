import { useMemo, useState } from "react";
import { useNavigate } from "../../lib/nav";
import { Database, Eraser, Pause, Play, RefreshCw } from "lucide-react";
import * as api from "../../lib/api";
import { useCacheEntries, usePlatformMutation } from "../../lib/usePlatform";
import { Button, Card, PageHeader, Select, Table, Td, TextInput, Th, Toast } from "../../ui";
import { duration } from "./CachePanels";
import { CacheEntryModal } from "./CacheViewer";
import { ago, bytes, count, span } from "./viz/format";
import { muted } from "./shared";
import "./viz/viz.css";

const PAGE = 50;

const SORTS = {
  store: { label: "Store, then kind", fn: null },
  newest: { label: "Newest first", fn: (a, b) => a.ageSeconds - b.ageSeconds },
  oldest: { label: "Oldest first", fn: (a, b) => b.ageSeconds - a.ageSeconds },
  largest: { label: "Largest first", fn: (a, b) => b.bytes - a.bytes },
  used: { label: "Most used first", fn: (a, b) => b.uses - a.uses },
  soon: { label: "Reloads soonest", fn: (a, b) => a.expiresInSeconds - b.expiresInSeconds },
};

/**
 * Cache — everything the API is remembering right now, for which store, how big and old each item is, when it
 * reloads and how often it has been used. Open an item to see its data. Looking changes nothing: it never counts
 * as a use and never refreshes an item. (Expiring is in Settings → Cache, and from an item's dialog.)
 */
export function PlatformCache() {
  const navigate = useNavigate();
  const [live, setLive] = useState(true);
  const q = useCacheEntries(live);
  const d = q.data;

  const [store, setStore] = useState("all");
  const [kind, setKind] = useState("all");
  const [text, setText] = useState("");
  const [sort, setSort] = useState("store");
  const [shown, setShown] = useState(PAGE);
  const [openKey, setOpenKey] = useState(null);
  // clearing ONE store's remembered data (the same action as on the store's own page)
  const clearStore = usePlatformMutation((s) => api.expireCache({ scope: "store", storeId: s.id }).then((r) => ({ ...r, name: s.name })));

  const filtered = useMemo(() => {
    if (!d) return [];
    const needle = text.trim().toLowerCase();
    let rows = d.entries.filter(
      (r) =>
        (store === "all" || (store === "platform" ? !r.store : r.store?.id === store)) &&
        (kind === "all" || r.kind === kind) &&
        (!needle || `${r.label} ${r.subject} ${r.store?.name ?? ""} ${r.outlet?.name ?? ""} ${r.key}`.toLowerCase().includes(needle)),
    );
    if (SORTS[sort].fn) rows = [...rows].sort(SORTS[sort].fn);
    return rows;
  }, [d, store, kind, text, sort]);

  const filtering = store !== "all" || kind !== "all" || text.trim() !== "";
  const clear = () => {
    setStore("all");
    setKind("all");
    setText("");
    setShown(PAGE);
  };
  const change = (set) => (e) => {
    set(e.target.value);
    setShown(PAGE);
  };

  const header = (
    <PageHeader
      title="Cache"
      icon={<Database size={23} />}
      subtitle="What the API remembers right now, and when each item reloads."
      action={
        <div className="cv-actions">
          <span className={`viz srv-live ${live && !q.isError ? "" : "off"}`} title={live ? "Refreshing every few seconds" : "Paused"}>
            <i />
            {q.isError ? "Can't reach the server" : live ? (q.isFetching ? "Updating…" : "Live") : "Paused"}
          </span>
          <Button variant="outline" onClick={() => void q.refetch()} disabled={q.isFetching} style={{ display: "inline-flex", gap: 6, alignItems: "center", marginRight: 8 }} title="Read the cache again now">
            <RefreshCw size={13} /> <span className="cv-label">Refresh</span>
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (!live) void q.refetch(); // coming back: show the present, not what it looked like when you paused
              setLive((v) => !v);
            }}
            style={{ display: "inline-flex", gap: 6, alignItems: "center" }}
          >
            {live ? <Pause size={13} /> : <Play size={13} />} <span className="cv-label">{live ? "Pause" : "Resume"}</span>
          </Button>
        </div>
      }
    />
  );

  if (!d) {
    return (
      <>
        {header}
        <p style={muted}>{q.isError ? `Couldn't read the cache: ${q.error.message}` : "Reading the cache…"}</p>
      </>
    );
  }

  const { totals, limits, stats } = d;
  const visible = filtered.slice(0, shown);

  return (
    <>
      {header}
      <div className="dash viz">
        <div className="cv-tiles">
          <div className="viz-tile">
            <div className="viz-tile-label">Remembered now</div>
            <div className="viz-tile-value">
              {count(totals.entries)} <span className="cv-faint">{totals.entries === 1 ? "item" : "items"}</span>
            </div>
            <div className="viz-tile-note">
              {bytes(totals.bytes)} of {bytes(limits.maxBytes)} allowed · room for {count(limits.maxEntries)} items
            </div>
          </div>
          <div className="viz-tile">
            <div className="viz-tile-label">Working</div>
            <div className="viz-tile-value">{stats.hitRate === null ? "—" : `${Math.round(stats.hitRate * 100)}%`}</div>
            <div className="viz-tile-note">
              of lookups answered from memory · {count(stats.hits)} saved a database read, {count(stats.misses)} didn't
            </div>
          </div>
          <div className="viz-tile">
            <div className="viz-tile-label">Remembers for</div>
            <div className="viz-tile-value">{d.enabled ? duration(d.ttlSeconds) : "Off"}</div>
            <div className="viz-tile-foot">
              <span className="viz-tile-note">{d.enabled ? "then the next visitor reloads it" : "every visit reads the database"}</span>
              <button type="button" className="viz-btn" onClick={() => navigate("/platform/settings")}>
                Change
              </button>
            </div>
          </div>
          <div className="viz-tile">
            <div className="viz-tile-label">Last expired by hand</div>
            <div className="viz-tile-value">{d.lastExpiredAt ? ago(d.lastExpiredAt) : "never"}</div>
            <div className="viz-tile-note">everything at once (Settings → Cache)</div>
          </div>
        </div>

        <Card
          title="Store by store"
          subtitle="What is remembered for each store, and a way to clear just that store's memory — its next visitor then loads everything fresh. Other stores are not touched."
        >
          {d.stores.length === 0 ? (
            <p style={muted} data-testid="cache-stores-empty">No store has anything remembered right now.</p>
          ) : (
            <Table minWidth={520}>
              <thead>
                <tr>
                  <Th>Store</Th>
                  <Th align="right" width={90}>Items</Th>
                  <Th align="right" width={110}>Size</Th>
                  <Th width={290}> </Th>
                </tr>
              </thead>
              <tbody>
                {d.stores.map((s) => (
                  <tr key={s.id} data-testid="cache-store-row" data-store={s.name}>
                    <Td>
                      <strong>{s.name}</strong>
                    </Td>
                    <Td align="right">{count(s.entries)}</Td>
                    <Td align="right">{bytes(s.bytes)}</Td>
                    <Td align="right">
                      <span style={{ display: "inline-flex", gap: 8 }}>
                        <Button variant="outline" onClick={() => { setStore(s.id); setShown(PAGE); }} style={{ padding: "5px 10px", fontSize: 12.5 }} data-testid="cache-store-view">
                          View items
                        </Button>
                        <Button variant="outline" disabled={clearStore.isPending} onClick={() => clearStore.mutate(s)} style={{ padding: "5px 10px", fontSize: 12.5, display: "inline-flex", gap: 5, alignItems: "center" }} data-testid="cache-store-clear">
                          <Eraser size={13} /> Clear this store's cache
                        </Button>
                      </span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          {d.platformWide.entries > 0 ? (
            <p style={{ ...muted, margin: "10px 0 0", fontSize: 12.5 }}>
              Not tied to one store: {count(d.platformWide.entries)} {d.platformWide.entries === 1 ? "item" : "items"} ({bytes(d.platformWide.bytes)}) — web addresses, the website and this console's own numbers.
            </p>
          ) : null}
          {clearStore.error ? <Toast kind="error">{clearStore.error.message}</Toast> : null}
          {clearStore.data ? (
            <Toast kind="ok">
              <span data-testid="cache-store-cleared">
                {clearStore.data.name}: {count(clearStore.data.result.removed)} {clearStore.data.result.removed === 1 ? "item" : "items"} cleared. Its next visitor loads fresh data.
              </span>
            </Toast>
          ) : null}
        </Card>

        <Card
          title="Everything that is remembered"
          subtitle="Open an item to see the data itself. Looking never changes the cache — it doesn't count as a use or refresh anything."
        >
          <div className="cv-filters">
            <label>
              Store
              <Select value={store} onChange={change(setStore)} aria-label="Filter by store" style={{ minWidth: 190 }}>
                <option value="all">All stores</option>
                {d.stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.entries})
                  </option>
                ))}
                {d.platformWide.entries > 0 ? <option value="platform">Whole platform ({d.platformWide.entries})</option> : null}
              </Select>
            </label>
            <label>
              Kind
              <Select value={kind} onChange={change(setKind)} aria-label="Filter by kind" style={{ minWidth: 190 }}>
                <option value="all">All kinds</option>
                {d.kinds.map((k) => (
                  <option key={k.kind} value={k.kind}>
                    {k.label} ({k.entries})
                  </option>
                ))}
              </Select>
            </label>
            <label className="grow">
              Search
              <TextInput value={text} onChange={change(setText)} placeholder="An address, a store, an outlet…" aria-label="Search the cache" />
            </label>
            <label>
              Sort
              <Select value={sort} onChange={change(setSort)} aria-label="Sort by" style={{ minWidth: 160 }}>
                {Object.entries(SORTS).map(([id, s]) => (
                  <option key={id} value={id}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </label>
            {filtering ? (
              <Button variant="outline" onClick={clear}>
                Clear filters
              </Button>
            ) : null}
          </div>

          {totals.entries === 0 ? (
            <div className="cv-empty">
              <strong>Nothing is remembered right now</strong>
              {d.enabled
                ? "Items appear here as visitors open stores and as you use the console — and after “Expire everything” they fill up again."
                : "The cache is switched off (Settings → Cache), so nothing new is kept."}
            </div>
          ) : filtered.length === 0 ? (
            <div className="cv-empty">
              <strong>Nothing matches</strong>
              Try a different store or kind, or clear the filters.
            </div>
          ) : (
            <>
              <Table minWidth={760}>
                <thead>
                  <tr>
                    <Th>Item</Th>
                    <Th>Store</Th>
                    <Th align="right">Size</Th>
                    <Th>Remembered</Th>
                    <Th>Reloads in</Th>
                    <Th align="right">Used</Th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => (
                    <tr key={r.key} className="cv-row" onClick={() => setOpenKey(r.key)}>
                      <Td>
                        <button type="button" className="cv-item" aria-label={`Show the data: ${r.label}, ${r.subject}`}>
                          <b>
                            {r.label}
                            {r.notFound ? (
                              <>
                                {" "}
                                <i className="cv-pill">not found</i>
                              </>
                            ) : null}
                          </b>
                          <span>{r.subject}</span>
                        </button>
                      </Td>
                      <Td>{r.store ? r.store.name : <span style={muted}>Whole platform</span>}</Td>
                      <Td align="right" nowrap>
                        {bytes(r.bytes)}
                      </Td>
                      <Td nowrap>{span(r.ageSeconds)} ago</Td>
                      <Td nowrap>{r.expiresInSeconds > 0 ? span(r.expiresInSeconds) : "next visit"}</Td>
                      <Td align="right" nowrap>
                        {count(r.uses)}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
                <span style={muted}>
                  Showing {count(visible.length)} of {count(filtered.length)}
                  {filtering ? ` (${count(totals.entries)} in all)` : ""}
                </span>
                {filtered.length > shown ? (
                  <Button variant="outline" onClick={() => setShown((n) => n + PAGE)}>
                    Show {Math.min(PAGE, filtered.length - shown)} more
                  </Button>
                ) : null}
              </div>
            </>
          )}
          <p className="viz-note" style={{ marginTop: 14 }}>
            This is the memory of the API server you're connected to. If several API servers share one database, each has its own; an expiry reaches the others within about 30 seconds.
          </p>
        </Card>
      </div>
      {openKey ? <CacheEntryModal entryKey={openKey} onClose={() => setOpenKey(null)} /> : null}
    </>
  );
}
