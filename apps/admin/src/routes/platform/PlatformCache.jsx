import { useMemo, useState } from "react";
import { useNavigate } from "../../lib/nav";
import { ChevronDown, ChevronRight, Database, Eraser, Pause, Play, RefreshCw } from "lucide-react";
import * as api from "../../lib/api";
import { useCacheEntries, usePlatformMutation } from "../../lib/usePlatform";
import { Button, Card, PageHeader, Table, Td, Th, Toast } from "../../ui";
import { duration } from "./CachePanels";
import { ExpireDialog } from "./CacheExpire";
import { CacheEntryModal } from "./CacheViewer";
import { bytes, count, span } from "./viz/format";
import { muted } from "./shared";
import "./viz/viz.css";

const items = (n) => `${count(n)} ${n === 1 ? "item" : "items"}`;
const total = (rows) => ({ n: rows.length, bytes: rows.reduce((n, r) => n + r.bytes, 0) });

/** Remembered items as a small table: what it is, how big, how old, when it reloads. Open one to see its data. */
function Items({ rows, onOpen, testId = "cache-entries" }) {
  return (
    <Table minWidth={560}>
      <thead>
        <tr>
          <Th>Item</Th>
          <Th align="right">Size</Th>
          <Th>Remembered</Th>
          <Th>Reloads in</Th>
        </tr>
      </thead>
      <tbody data-testid={testId}>
        {rows.map((r) => (
          <tr key={r.key} className="cv-row" data-testid="cache-entry-row" onClick={() => onOpen(r.key)}>
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
            <Td align="right" nowrap>{bytes(r.bytes)}</Td>
            <Td nowrap>{span(r.ageSeconds)} ago</Td>
            <Td nowrap>{r.expiresInSeconds > 0 ? span(r.expiresInSeconds) : "next visit"}</Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

const expireBtn = { padding: "5px 10px", fontSize: 12.5, display: "inline-flex", gap: 5, alignItems: "center" };

/**
 * Cache — what the API is remembering, grouped by where it belongs:
 *   Admin Panel Cache   what belongs to no store (this console's numbers, the website's pages and prices …)
 *   Store Cache         open it to see the stores; open a store to see its cache outlet by outlet
 * Every "Expire" says first what it will drop. Looking never changes the cache.
 */
export function PlatformCache() {
  const navigate = useNavigate();
  const [live, setLive] = useState(true);
  const q = useCacheEntries(live);
  const d = q.data;

  const [storesOpen, setStoresOpen] = useState(false);
  const [openStore, setOpenStore] = useState(null);
  const [openKey, setOpenKey] = useState(null);
  const [ask, setAsk] = useState(null);
  const expire = usePlatformMutation((a) => api.expireCache({ scope: a.scope, storeId: a.storeId, outletId: a.outletId }).then((r) => ({ ...r.result, label: a.done }))); // the server answers { result: { removed, … }, cache }

  const groups = useMemo(() => {
    if (!d) return null;
    const admin = d.entries.filter((r) => !r.store);
    const stores = d.stores.map((s) => {
      const rows = d.entries.filter((r) => r.store?.id === s.id);
      const outlets = new Map();
      for (const r of rows) if (r.outlet) outlets.set(r.outlet.id, { id: r.outlet.id, name: r.outlet.name, rows: [] });
      for (const r of rows) if (r.outlet) outlets.get(r.outlet.id).rows.push(r);
      return { ...s, rows, outlets: [...outlets.values()].sort((a, b) => a.name.localeCompare(b.name)), whole: rows.filter((r) => !r.outlet) };
    });
    return { admin, stores };
  }, [d]);

  const header = (
    <PageHeader
      title="Cache"
      icon={<Database size={23} />}
      subtitle="What the API remembers, grouped by where it belongs."
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
              if (!live) void q.refetch();
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

  if (!d || !groups) {
    return (
      <>
        {header}
        <p style={muted}>{q.isError ? `Couldn't read the cache: ${q.error.message}` : "Reading the cache…"}</p>
      </>
    );
  }

  const all = total(d.entries);
  const adminTotal = total(groups.admin);
  const storeRows = groups.stores.flatMap((s) => s.rows);
  const storeTotal = total(storeRows);
  const result = expire.data;
  const confirm = () => {
    expire.mutate(ask, { onSuccess: () => setAsk(null) });
  };

  return (
    <>
      {header}
      <div className="dash viz">
        <Card>
          <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }} data-testid="cache-summary">
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{ fontWeight: 650 }}>
                {items(all.n)} remembered · {bytes(all.bytes)}
              </div>
              <div style={muted}>
                {d.enabled ? `Each item is remembered for ${duration(d.ttlSeconds)}, then the next visit reloads it.` : "The memory is switched off: every visit reads the database."}{" "}
                <button type="button" className="viz-btn" onClick={() => navigate("/platform/settings")}>
                  Change
                </button>
              </div>
            </div>
            <Button variant="outline" disabled={expire.isPending} onClick={() => setAsk({ scope: "all", entries: d.entries, done: "Everything" })} style={expireBtn} data-testid="cache-expire-all">
              <Eraser size={13} /> Expire everything
            </Button>
          </div>
          {expire.error ? <Toast kind="error">{expire.error.message}</Toast> : null}
          {result ? (
            <Toast kind="ok">
              <span data-testid="cache-expired">
                {result.label}: {items(result.removed)} cleared. The next visit loads fresh data.
              </span>
            </Toast>
          ) : null}
        </Card>

        <Card
          title="Admin Panel Cache"
          subtitle="What belongs to no store: this console's numbers, the website's pages and prices, and “no store has this address” answers."
          action={
            <Button variant="outline" disabled={expire.isPending} onClick={() => setAsk({ scope: "admin", entries: groups.admin, done: "Admin panel cache" })} style={expireBtn} data-testid="cache-expire-admin">
              <Eraser size={13} /> Expire admin panel cache
            </Button>
          }
        >
          <div data-testid="cache-admin-group">
            {groups.admin.length === 0 ? (
              <p style={muted} data-testid="cache-admin-empty">Nothing is remembered here right now.</p>
            ) : (
              <>
                <p style={{ ...muted, marginTop: 0 }}>{items(adminTotal.n)} · {bytes(adminTotal.bytes)}</p>
                <Items rows={groups.admin} onOpen={setOpenKey} testId="cache-admin-entries" />
              </>
            )}
          </div>
        </Card>

        <Card>
          <button
            type="button"
            onClick={() => setStoresOpen((v) => !v)}
            aria-expanded={storesOpen}
            data-testid="cache-store-toggle"
            style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, width: "100%" }}
          >
            {storesOpen ? <ChevronDown size={18} aria-hidden /> : <ChevronRight size={18} aria-hidden />}
            <span style={{ flex: 1 }}>
              <span style={{ display: "block", fontWeight: 650, fontSize: 16 }}>Store Cache</span>
              <span style={{ ...muted, display: "block" }}>
                {groups.stores.length === 0 ? "No store has anything remembered right now." : `${groups.stores.length} ${groups.stores.length === 1 ? "store" : "stores"} · ${items(storeTotal.n)} · ${bytes(storeTotal.bytes)} — open it to pick a store`}
              </span>
            </span>
          </button>

          {storesOpen ? (
            <div data-testid="cache-store-group" style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              {groups.stores.length === 0 ? <p style={muted} data-testid="cache-stores-empty">Stores appear here once someone opens them.</p> : null}
              {groups.stores.map((s) => {
                const on = openStore === s.id;
                return (
                  <div key={s.id} data-testid="cache-store-row" data-store={s.name} style={{ border: "1px solid var(--color-border)", borderRadius: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => setOpenStore(on ? null : s.id)}
                        aria-expanded={on}
                        data-testid="cache-store-open"
                        style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 200 }}
                      >
                        {on ? <ChevronDown size={16} aria-hidden /> : <ChevronRight size={16} aria-hidden />}
                        <span>
                          <b>{s.name}</b>
                          <span style={{ ...muted, display: "block", fontSize: 12.5 }}>
                            {items(s.entries)} · {bytes(s.bytes)} · {s.outlets.length} {s.outlets.length === 1 ? "outlet" : "outlets"}
                          </span>
                        </span>
                      </button>
                      <Button variant="outline" disabled={expire.isPending} onClick={() => setAsk({ scope: "store", storeId: s.id, name: s.name, entries: s.rows, done: s.name })} style={expireBtn} data-testid="cache-expire-store">
                        <Eraser size={13} /> Expire this store
                      </Button>
                    </div>

                    {on ? (
                      <div data-testid="cache-outlet-list" style={{ padding: "0 12px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
                        {s.outlets.map((o) => (
                          <div key={o.id} data-testid="cache-outlet-group" data-outlet={o.name} style={{ background: "var(--color-surface-2, rgba(127,127,127,.06))", borderRadius: 10, padding: 10 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
                              <div style={{ flex: 1, minWidth: 160 }}>
                                <b>{o.name}</b> <span style={muted}>outlet · {items(o.rows.length)} · {bytes(total(o.rows).bytes)}</span>
                              </div>
                              <Button
                                variant="outline"
                                disabled={expire.isPending}
                                onClick={() => setAsk({ scope: "outlet", storeId: s.id, outletId: o.id, name: `${o.name} · ${s.name}`, entries: o.rows, done: `${o.name} (${s.name})` })}
                                style={expireBtn}
                                data-testid="cache-expire-outlet"
                              >
                                <Eraser size={13} /> Expire this outlet
                              </Button>
                            </div>
                            <Items rows={o.rows} onOpen={setOpenKey} testId="cache-outlet-entries" />
                          </div>
                        ))}
                        {s.whole.length > 0 ? (
                          <div data-testid="cache-whole-store" style={{ background: "var(--color-surface-2, rgba(127,127,127,.06))", borderRadius: 10, padding: 10 }}>
                            <div style={{ marginBottom: 6 }}>
                              <b>The whole store</b> <span style={muted}>not tied to one outlet · {items(s.whole.length)} — its look, plan and web addresses. “Expire this store” drops these too.</span>
                            </div>
                            <Items rows={s.whole} onOpen={setOpenKey} testId="cache-whole-entries" />
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}
        </Card>
        <p className="viz-note">
          This is the memory of the API server you're connected to. “Expire this store” and “Expire everything” also reach other API servers sharing the database within about 30 seconds; “Expire this outlet” and
          “Expire admin panel cache” act on this server.
        </p>
      </div>
      {ask ? <ExpireDialog ask={ask} kinds={d.kinds} busy={expire.isPending} error={expire.error?.message} onConfirm={confirm} onClose={() => setAsk(null)} /> : null}
      {openKey ? <CacheEntryModal entryKey={openKey} onClose={() => setOpenKey(null)} /> : null}
    </>
  );
}
