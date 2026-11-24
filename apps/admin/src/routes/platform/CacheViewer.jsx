import { useMemo, useState } from "react";
import { Check, ChevronRight, Copy, Database, Download, Eraser, Lock, RefreshCw, X } from "lucide-react";
import * as api from "../../lib/api";
import { useCacheEntry, usePlatformMutation } from "../../lib/usePlatform";
import { Button, Modal, Note, Tabs } from "../../ui";
import { bytes, count, dateTime, span } from "./viz/format";
import "./viz/viz.css";

/* ------------------------------------------------------------------ the data tree */

/** What the API puts where it hid a secret. */
export const HIDDEN = "••• hidden";
const PAGE = 100; // children drawn at a time: a menu of 500 items shouldn't put 500 rows on screen at once
const LONG_TEXT = 180;

const kindOf = (v) => (v === null ? "null" : Array.isArray(v) ? "array" : typeof v);

/** A one-line peek at what is inside a closed object or list: `{ id, name, price, … +6 }`, `[ 30 items ]`. */
function preview(v) {
  if (Array.isArray(v)) return v.length === 0 ? "[ ]" : `[ ${count(v.length)} ${v.length === 1 ? "item" : "items"} ]`;
  const keys = Object.keys(v);
  if (keys.length === 0) return "{ }";
  const shown = [];
  let length = 0;
  for (const k of keys) {
    if (shown.length >= 6 || length + k.length > 54) break;
    shown.push(k);
    length += k.length + 2;
  }
  return `{ ${shown.join(", ")}${shown.length < keys.length ? `, … +${keys.length - shown.length}` : ""} }`;
}

function Scalar({ value, kind, full, onToggle }) {
  if (kind === "null") return <span className="cv-null">null</span>;
  if (kind === "boolean") return <span className="cv-bool">{String(value)}</span>;
  if (kind === "number") return <span className="cv-num">{String(value)}</span>;
  if (value === HIDDEN) {
    return (
      <span className="cv-hidden" title="Hidden for safety: the field's name suggests a secret.">
        <Lock size={11} aria-hidden /> hidden
      </span>
    );
  }
  const long = value.length > LONG_TEXT;
  return (
    <>
      <span className="cv-str">"{long && !full ? `${value.slice(0, LONG_TEXT)}…` : value}"</span>
      {long ? (
        <button type="button" className="cv-more inline" onClick={onToggle}>
          {full ? "show less" : `show all ${count(value.length)} characters`}
        </button>
      ) : null}
    </>
  );
}

/** One value in the tree. Objects and lists open and close; only what is open is drawn. */
function Node({ name, isIndex, value, depth, openDepth }) {
  const kind = kindOf(value);
  const container = kind === "array" || kind === "object";
  const [open, setOpen] = useState(depth < openDepth);
  const [limit, setLimit] = useState(PAGE);
  const [full, setFull] = useState(false);
  const label = name === null ? null : <span className={isIndex ? "cv-index" : "cv-key"}>{name}</span>;

  if (!container) {
    return (
      <div className="cv-line">
        {label}
        {label ? <span className="cv-colon">:</span> : null}
        <Scalar value={value} kind={kind} full={full} onToggle={() => setFull((f) => !f)} />
      </div>
    );
  }

  const entries = kind === "array" ? value.map((v, i) => [i, v]) : Object.entries(value);
  const empty = entries.length === 0;
  const rest = entries.length - limit;
  return (
    <div className="cv-branch">
      <button type="button" className="cv-toggle" aria-expanded={empty ? undefined : open} disabled={empty} onClick={() => setOpen((o) => !o)}>
        <ChevronRight size={13} className={`cv-caret${open && !empty ? " open" : ""}${empty ? " none" : ""}`} aria-hidden />
        {label}
        {label ? <span className="cv-colon">:</span> : null}
        <span className="cv-sum">{open && !empty ? (kind === "array" ? "[" : "{") : preview(value)}</span>
      </button>
      {open && !empty ? (
        <div className="cv-children">
          {entries.slice(0, limit).map(([k, v]) => (
            <Node key={k} name={String(k)} isIndex={kind === "array"} value={v} depth={depth + 1} openDepth={openDepth} />
          ))}
          {rest > 0 ? (
            <button type="button" className="cv-more" onClick={() => setLimit((l) => l + 200)}>
              Show {Math.min(200, rest)} more ({count(rest)} left)
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Cached data as a tree you can open and close. `openDepth` = how many levels start open. */
export function JsonTree({ value, openDepth = 1 }) {
  return (
    <div className="cv-tree">
      <Node name={null} value={value} depth={0} openDepth={openDepth} />
    </div>
  );
}

/* ------------------------------------------------------------------ small helpers */

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    /* no clipboard permission (or an insecure page): fall back to the old way */
  }
  try {
    const box = document.createElement("textarea");
    box.value = text;
    box.setAttribute("readonly", "");
    box.style.cssText = "position:fixed;opacity:0;top:0;left:0";
    document.body.appendChild(box);
    box.select();
    const done = document.execCommand("copy");
    box.remove();
    return done;
  } catch {
    return false;
  }
}

function download(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Why there is no data, in words. */
function notFoundText(kind) {
  if (kind === "host") return "No store uses this web address, so there is nothing to show. Rasoi Pulse remembers that answer for up to a minute, so people (or bots) trying made-up addresses don't make the database work every time.";
  if (kind === "brandslug") return "No store has this short name. Rasoi Pulse remembers that answer for up to a minute.";
  return "The answer was “nothing found”. Rasoi Pulse remembers that for up to a minute, so asking again and again doesn't make the database work every time.";
}

function Fact({ label, children, title }) {
  return (
    <div className="cv-fact" title={title}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------ the dialog */

/**
 * What is remembered under one cache key, shown read-only: where it belongs, how big and old it is, when it
 * reloads, how often it has been used — and the data itself, as a tree or as plain JSON. Opening it never
 * changes the cache. Secret-looking fields are already hidden by the API.
 */
export function CacheEntryModal({ entryKey, onClose }) {
  const q = useCacheEntry(entryKey);
  const e = q.data?.entry;
  const [view, setView] = useState("tree");
  const [openDepth, setOpenDepth] = useState(1);
  const [version, setVersion] = useState(0);
  const [copied, setCopied] = useState(false);
  const expire = usePlatformMutation(() => api.expireCache({ scope: "store", storeId: e.store.id }));
  const pretty = useMemo(() => (e && view === "raw" ? JSON.stringify(e.value, null, 2) : ""), [e, view]);
  const gone = q.isError && q.error?.status === 404;
  const big = (e?.shownChars ?? 0) > 300_000;
  const expired = e && e.ageSeconds > e.lifetimeSeconds;

  const open = (depth) => {
    setOpenDepth(depth);
    setVersion((v) => v + 1);
  };
  const copy = async () => {
    if (await copyText(JSON.stringify(e.value, null, 2))) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  return (
    <Modal onClose={onClose} width={940} ariaLabel={e ? `${e.label}: ${e.subject}` : "Cached item"}>
      <div className="viz cv-modal">
        <div className="cv-head">
          <Database size={18} aria-hidden style={{ flexShrink: 0, marginTop: 3 }} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 className="cv-title">{e ? `${e.label} · ${e.subject}` : "Cached item"}</h2>
            <p className="cv-what">{e ? e.what : q.isPending ? "Reading it…" : ""}</p>
          </div>
          <button type="button" className="viz-btn" onClick={onClose} aria-label="Close">
            <X size={14} />
          </button>
        </div>

        <div className="cv-body">
          {q.isPending ? <p className="cv-state">Reading the cached item…</p> : null}
          {gone ? (
            <div className="cv-state">
              <strong>That item isn't in the cache any more.</strong>
              <p>It expired or was replaced a moment ago. The next visitor loads it fresh. Close this and refresh the list.</p>
            </div>
          ) : q.isError ? (
            <div className="cv-state">
              <strong>Couldn't read it.</strong>
              <p>{q.error.message}</p>
            </div>
          ) : null}

          {expire.isSuccess ? (
            <div className="cv-state">
              <strong>Done — {expire.data.result.store.name}'s cache was expired.</strong>
              <p>
                {count(expire.data.result.removed)} {expire.data.result.removed === 1 ? "item" : "items"} cleared. The next visitor loads fresh data, and it shows up in the list again.
              </p>
            </div>
          ) : e ? (
            <>
              <dl className="cv-facts">
                <Fact label="Store">{e.store ? e.store.name : "Whole platform (not one store)"}</Fact>
                <Fact label="Size" title={`${count(e.bytes)} bytes`}>
                  {bytes(e.bytes)}
                </Fact>
                <Fact label="Remembered" title={dateTime(e.cachedAt)}>
                  {span(e.ageSeconds)} ago
                </Fact>
                <Fact label="Reloads">{e.expiresInSeconds > 0 ? `in ${span(e.expiresInSeconds)}` : "at the next visit"}</Fact>
                <Fact label="Used" title="How many times it saved a database read">
                  {count(e.uses)} {e.uses === 1 ? "time" : "times"}
                  {e.uses > 0 ? <span className="cv-faint"> · last {span(e.idleSeconds)} ago</span> : null}
                </Fact>
                <Fact label="Kept for">
                  {span(e.lifetimeSeconds)}
                  {e.ownLifetime ? <span className="cv-faint"> · fixed for this kind of item</span> : e.notFound ? <span className="cv-faint"> · shorter for “not found”</span> : null}
                </Fact>
              </dl>

              {expired ? <p className="viz-note cv-note">It is past its lifetime. It stays here until the next visitor reloads it (or it is tidied away within a minute).</p> : null}
              {e.hiddenFields > 0 ? (
                <p className="viz-note cv-note">
                  <Lock size={12} aria-hidden style={{ verticalAlign: -1, marginRight: 5 }} />
                  {e.hiddenFields} {e.hiddenFields === 1 ? "field looks" : "fields look"} like {e.hiddenFields === 1 ? "a secret" : "secrets"} and {e.hiddenFields === 1 ? "is" : "are"} hidden.
                </p>
              ) : null}
              {e.trimmed ? (
                <p className="viz-note cv-note">This item is large ({bytes(e.bytes)}), so long lists and texts are cut short here. The copy the server holds is complete.</p>
              ) : null}

              {e.notFound ? (
                <Note>{notFoundText(e.kind)}</Note>
              ) : (
                <>
                  <div className="cv-bar">
                    <Tabs
                      value={view}
                      onChange={setView}
                      tabs={[
                        { id: "tree", label: "Tree" },
                        { id: "raw", label: "Plain JSON" },
                      ]}
                    />
                    <div className="cv-bar-actions">
                      {view === "tree" ? (
                        <>
                          <button type="button" className="viz-btn" onClick={() => open(big ? 3 : 99)}>
                            Open all
                          </button>
                          <button type="button" className="viz-btn" onClick={() => open(1)}>
                            Close all
                          </button>
                        </>
                      ) : null}
                      <button type="button" className="viz-btn" onClick={copy}>
                        {copied ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />} {copied ? "Copied" : "Copy"}
                      </button>
                      <button type="button" className="viz-btn" onClick={() => download(`${e.key.replace(/[^a-z0-9._-]+/gi, "_").slice(0, 80)}.json`, JSON.stringify(e.value, null, 2))}>
                        <Download size={13} aria-hidden /> Download
                      </button>
                      <button type="button" className="viz-btn" onClick={() => q.refetch()} disabled={q.isFetching} title="Read it again from the cache">
                        <RefreshCw size={13} aria-hidden /> {q.isFetching ? "Reading…" : "Refresh"}
                      </button>
                    </div>
                  </div>
                  {view === "tree" ? <JsonTree key={`${version}`} value={e.value} openDepth={openDepth} /> : <pre className="cv-raw" tabIndex={0}>{pretty}</pre>}
                </>
              )}

              <details className="cv-tech">
                <summary>Technical details</summary>
                <dl className="cv-facts" style={{ marginTop: 8 }}>
                  <Fact label="Cache key">
                    <code>{e.key}</code>
                  </Fact>
                  <Fact label="Cleared along with">
                    {e.tags.length ? e.tags.map((t) => <code key={t} className="cv-chip">{t}</code>) : <span className="cv-faint">nothing in particular</span>}
                  </Fact>
                  <Fact label="Exact size">{count(e.bytes)} bytes</Fact>
                  <Fact label="Remembered at">{dateTime(e.cachedAt)}</Fact>
                </dl>
              </details>
            </>
          ) : null}
        </div>

        <div className="cv-foot">
          {e?.store && !expire.isSuccess ? (
            <Button variant="outline" disabled={expire.isPending} onClick={() => expire.mutate()} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
              <Eraser size={14} /> {expire.isPending ? "Expiring…" : `Expire ${e.store.name}'s cache`}
            </Button>
          ) : (
            <span />
          )}
          {expire.error ? <span className="cv-err">{expire.error.message}</span> : null}
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  );
}
