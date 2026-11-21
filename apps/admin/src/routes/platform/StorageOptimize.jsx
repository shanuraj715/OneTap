import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ImageDown, Loader, ScanSearch } from "lucide-react";
import * as api from "../../lib/api";
import { useOptimizeScan, useStorageOptimize, usePlatformMutation } from "../../lib/usePlatform";
import { Button, Card, Checkbox, Note, Select, Toast } from "../../ui";
import { ago, bytes, count } from "./viz/format";
import { muted } from "./shared";

/**
 * Optimize pictures: find the pictures the stores use that are bigger than the size limit (Storage → Image compression →
 * "Target max size"), show them in a grid, and compress the chosen ones with the saved compression settings.
 */

const PAGE = 48;
const NONE = [];
const KIND_LABEL = { "menu-items": "Dish picture", categories: "Category picture", banners: "Banner", logos: "Logo", logo: "Logo", pages: "Page picture", website: "Website picture", store: "Store picture" };
const kindLabel = (k) => KIND_LABEL[k] ?? `${String(k).charAt(0).toUpperCase()}${String(k).slice(1).replace(/-/g, " ")}`;
const STATUS_TEXT = { running: "Optimizing…", done: "Finished", done_with_errors: "Finished — some pictures had problems", failed: "Stopped by an error", cancelled: "Cancelled", interrupted: "Interrupted" };
const STAGES = [
  ["reading", "Compressing the pictures"],
  ["links", "Updating the stores' addresses"],
  ["cleanup", "Removing the big originals"],
];
const FORMAT = { webp: "WebP", avif: "AVIF", jpeg: "JPEG", original: "original format" };

export function OptimizeCard() {
  const scanQ = useOptimizeScan();
  const jobQ = useStorageOptimize();
  const scanM = usePlatformMutation(api.scanForOptimizing);
  const start = usePlatformMutation(api.startStorageOptimize);
  const cancel = usePlatformMutation(api.cancelStorageOptimize);
  const scan = scanM.data?.scan ?? scanQ.data?.scan ?? null;
  const job = jobQ.data?.current;
  const running = job?.status === "running";

  const [picked, setPicked] = useState(() => new Set());
  const [store, setStore] = useState("");
  const [deleteOriginals, setDeleteOriginals] = useState(true);
  const [shown, setShown] = useState(PAGE);

  const pictures = scan?.pictures ?? NONE;
  const stores = useMemo(() => {
    const by = new Map();
    for (const p of pictures) by.set(p.brandId, { id: p.brandId, name: p.brandName, files: (by.get(p.brandId)?.files ?? 0) + 1 });
    return [...by.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [pictures]);
  const visible = useMemo(() => (store ? pictures.filter((p) => p.brandId === store) : pictures), [pictures, store]);
  const chosen = useMemo(() => visible.filter((p) => picked.has(p.key)), [visible, picked]);
  const allPicked = visible.length > 0 && chosen.length === visible.length;

  // a new list (after a scan) or another store: forget choices that are no longer in it, and start from the top
  useEffect(() => {
    setPicked((s) => {
      const keep = new Set(pictures.map((p) => p.key));
      const n = new Set([...s].filter((k) => keep.has(k)));
      return n.size === s.size ? s : n;
    });
  }, [pictures]);
  useEffect(() => setShown(PAGE), [store, scan?.scannedAt]);
  useEffect(() => {
    if (store && !stores.some((s) => s.id === store)) setStore("");
  }, [stores, store]);

  // when a run ends, look again, so the grid shows what is still big
  const wasRunning = useRef(false);
  useEffect(() => {
    if (wasRunning.current && !running && job) scanM.mutate();
    wasRunning.current = running;
  }, [running]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (key) => setPicked((s) => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  const toggleAll = (on) => setPicked((s) => { const n = new Set(s); for (const p of visible) { if (on) n.add(p.key); else n.delete(p.key); } return n; });

  const total = chosen.reduce((n, p) => n + p.size, 0);
  const go = () => {
    const del = deleteOriginals ? "The big originals are DELETED once nothing uses them any more." : "The big originals are kept (they keep using the space).";
    if (window.confirm(`Optimize ${count(chosen.length)} picture${chosen.length === 1 ? "" : "s"} (${bytes(total)})?\n\nEach one is compressed to the saved size / quality / format and the stores' addresses are updated. ${del}\n\nThis can't be undone — compression is lossy.`)) {
      start.mutate({ keys: chosen.map((p) => p.key), options: { deleteOriginals } });
    }
  };

  const pct = job?.plan?.files ? Math.min(100, Math.round(((job.progress.done ?? 0) / Math.max(1, job.plan.files)) * 100)) : 0;
  const stageIndex = STAGES.findIndex(([id]) => id === job?.stage);
  const saved = (job?.progress?.bytesBefore ?? 0) - (job?.progress?.bytesAfter ?? 0);

  return (
    <Card
      title="Optimize pictures"
      icon={<ImageDown size={16} />}
      subtitle="Finds pictures that are bigger than the size limit in “Image compression” (uploaded before it was set, or never compressed) and compresses them the same way new uploads are. Looking changes nothing."
      action={
        <Button onClick={() => scanM.mutate()} disabled={scanM.isPending || running} data-testid="optimize-scan" style={{ display: "inline-flex", gap: 6, alignItems: "center", whiteSpace: "nowrap" }}>
          {scanM.isPending ? <Loader size={14} className="ot-spin" /> : <ScanSearch size={14} />} {scanM.isPending ? "Looking…" : scan ? "Scan again" : "Find big pictures"}
        </Button>
      }
    >
      {scanM.error ? <Toast kind="error">{scanM.error.message}</Toast> : null}
      {start.error ? <Toast kind="error">{start.error.message}</Toast> : null}

      {!scan ? (
        <p style={muted}>{scanM.isPending ? "Looking at the pictures the stores use…" : "Press “Find big pictures” to see which pictures are over the limit."}</p>
      ) : scan.noLimit ? (
        <Note>
          <span data-testid="optimize-nolimit">No size limit is set, so no picture counts as too big. Put a number (KB) in <strong>Target max size</strong> under “Image compression”, save it, and scan again.</span>
        </Note>
      ) : (
        <>
          <div style={tiles} data-testid="optimize-summary">
            <div style={tile}>
              <div style={muted}>Pictures in use</div>
              <strong style={big} data-testid="optimize-checked">{count(scan.checked.files)}</strong>
              <div style={muted}>{bytes(scan.checked.bytes)} · {scan.storage}</div>
            </div>
            <div style={{ ...tile, ...(scan.over.files ? tileWarn : null) }}>
              <div style={muted}>Bigger than {bytes(scan.limitBytes)}</div>
              <strong style={big} data-testid="optimize-over">{count(scan.over.files)}</strong>
              <div style={muted}>{scan.over.files ? bytes(scan.over.bytes) : "nothing to do"}</div>
            </div>
            <div style={tile}>
              <div style={muted}>Will free at least</div>
              <strong style={big} data-testid="optimize-frees">{bytes(scan.atLeastFrees)}</strong>
              <div style={muted}>each one ends at or under the limit</div>
            </div>
          </div>
          <p style={{ ...muted, margin: "10px 0 0" }}>
            Limits used: {bytes(scan.limitBytes)} · longest side {count(scan.processing.maxDimension)} px · {FORMAT[scan.processing.format] ?? scan.processing.format}, quality {scan.processing.quality} · scanned {ago(scan.scannedAt)}
            {scan.settled ? ` · ${count(scan.settled)} already as small as they can get (not listed)` : ""}
          </p>
          {scan.partial ? <Toast kind="info">There are too many files to list in one go — only part of the storage was looked at. Optimize what is listed, then scan again.</Toast> : null}

          {scan.over.files === 0 ? (
            <Toast kind="ok">Every picture the stores use is within the limit — nothing to optimize.</Toast>
          ) : (
            <>
              <div style={toolbar} data-testid="optimize-toolbar">
                <Checkbox checked={allPicked} onChange={toggleAll} label={`Select all${store ? " of this store" : ""} (${count(visible.length)})`} disabled={running || !visible.length} />
                <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13.5 }}>
                  <span style={muted}>Store</span>
                  <Select value={store} onChange={(e) => setStore(e.target.value)} data-testid="optimize-store" aria-label="Show one store's pictures" style={{ minWidth: 190 }}>
                    <option value="">All stores ({count(pictures.length)})</option>
                    {stores.map((s) => (
                      <option key={s.id} value={s.id}>{s.name} ({count(s.files)})</option>
                    ))}
                  </Select>
                </label>
                <span style={{ ...muted, marginLeft: "auto" }} data-testid="optimize-selected">
                  {chosen.length ? `${count(chosen.length)} selected · ${bytes(total)}` : "Nothing selected"}
                </span>
              </div>

              <div style={grid} data-testid="optimize-grid">
                {visible.slice(0, shown).map((p) => {
                  const on = picked.has(p.key);
                  return (
                    <label key={p.key} data-testid="optimize-pic" data-key={p.key} data-picked={on ? "true" : "false"} style={{ ...pic, ...(on ? picOn : null), cursor: running ? "default" : "pointer" }}>
                      <span style={thumbBox}>
                        <img src={p.url} alt="" loading="lazy" decoding="async" style={thumb} />
                        <span style={tick}>
                          <input type="checkbox" checked={on} disabled={running} onChange={() => toggle(p.key)} aria-label={`Select ${kindLabel(p.kind)} of ${p.brandName}`} style={{ accentColor: "var(--color-primary)", width: 16, height: 16, margin: 0 }} />
                        </span>
                        <span style={sizeBadge}>{bytes(p.size)}</span>
                      </span>
                      <span style={caption}>
                        <strong style={{ ...clip, fontSize: 12.5 }} title={p.brandName}>{p.brandName}</strong>
                        <span style={{ ...muted, ...clip, fontSize: 12 }} title={p.outletName}>{p.outletName}</span>
                        <span style={{ ...muted, ...clip, fontSize: 12 }}>{kindLabel(p.kind)}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
              {visible.length > shown ? (
                <div style={{ textAlign: "center", marginTop: 12 }}>
                  <Button variant="outline" onClick={() => setShown((n) => n + PAGE)} data-testid="optimize-more">Show more ({count(visible.length - shown)} left)</Button>
                </div>
              ) : null}
              {scan.more ? <p style={muted}>{count(scan.more)} more big pictures are not listed here (the biggest {count(pictures.length)} are). Optimize these, then scan again for the rest.</p> : null}

              <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center", marginTop: 18 }}>
                <Checkbox checked={deleteOriginals} onChange={setDeleteOriginals} label="Delete the big originals afterwards (frees the space)" info="The compressed picture is saved as a new file and every store's address is switched to it. With this ticked the old big file is then deleted — only once nothing refers to it any more. Untick it to keep the originals (they keep using the space)." />
                <Button onClick={go} disabled={!chosen.length || running || start.isPending} data-testid="optimize-start" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                  <ImageDown size={14} /> {chosen.length ? `Optimize ${count(chosen.length)} picture${chosen.length === 1 ? "" : "s"}` : "Optimize"}
                </Button>
                {!chosen.length && !running ? <span style={muted}>Choose pictures first (or “Select all”).</span> : null}
              </div>
            </>
          )}
        </>
      )}

      {job ? (
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--color-border)" }} data-testid="optimize-job" data-status={job.status}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <strong>{STATUS_TEXT[job.status] ?? job.status}</strong>
            <span style={muted}>{count(job.plan.files ?? 0)} picture{job.plan.files === 1 ? "" : "s"} · started {ago(job.startedAt)}</span>
            {running ? (
              <Button variant="outline" onClick={() => cancel.mutate(job.id)} disabled={cancel.isPending || job.cancelRequested} data-testid="optimize-cancel" style={{ marginLeft: "auto" }}>
                {job.cancelRequested ? "Stopping…" : "Cancel"}
              </Button>
            ) : null}
          </div>
          {running ? (
            <>
              <ol style={{ display: "flex", gap: 6, flexWrap: "wrap", listStyle: "none", padding: 0, margin: "10px 0 6px" }}>
                {STAGES.filter(([id]) => id !== "cleanup" || job.options?.deleteOriginals).map(([id, label]) => {
                  const i = STAGES.findIndex(([x]) => x === id);
                  return (
                    <li key={id} data-testid={`optimize-stage-${id}`} data-state={i < stageIndex ? "done" : i === stageIndex ? "now" : "next"} style={{ ...stagePill, ...(i === stageIndex ? stageNow : i < stageIndex ? stageDone : null) }}>
                      {i < stageIndex ? <Check size={11} /> : i === stageIndex ? <Loader size={11} className="ot-spin" /> : null} {label}
                    </li>
                  );
                })}
              </ol>
              <div style={track} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progress"><div style={{ ...fill, width: `${pct}%` }} /></div>
            </>
          ) : null}
          <p style={{ ...muted, margin: "8px 0 0", fontVariantNumeric: "tabular-nums" }} data-testid="optimize-progress">
            {count(job.progress.done ?? 0)} of {count(job.plan.files ?? 0)} looked at · {count(job.progress.optimized ?? 0)} optimized · {count(job.progress.unchanged ?? 0)} already as small as possible · {count(job.progress.failed ?? 0)} failed
            {job.progress.skipped ? ` · ${count(job.progress.skipped)} changed meanwhile (left as they were)` : ""} · {count(job.progress.linksUpdated ?? 0)} addresses updated
            {job.options?.deleteOriginals ? ` · ${count(job.progress.deleted ?? 0)} originals deleted` : ""}
          </p>
          {!running && job.progress.optimized ? (
            <Toast kind="ok">
              <span data-testid="optimize-result">
                {count(job.progress.optimized)} picture{job.progress.optimized === 1 ? "" : "s"} went from {bytes(job.progress.bytesBefore)} to {bytes(job.progress.bytesAfter)} — {bytes(Math.max(0, saved))} smaller
                {job.options?.deleteOriginals ? "" : " (the originals were kept, so the space is only freed once they are deleted)"}.
              </span>
            </Toast>
          ) : null}
          {job.error ? <Toast kind={job.status === "interrupted" ? "info" : "error"}>{job.error}</Toast> : null}
          {job.failures.length > 0 ? (
            <details style={{ marginTop: 8 }} open={job.status !== "running"}>
              <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--tone-danger)" }}>{job.failures.length} problem{job.failures.length === 1 ? "" : "s"}</summary>
              <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 12.5, lineHeight: 1.6 }} data-testid="optimize-failures">
                {job.failures.slice(0, 20).map((f, i) => (
                  <li key={i}><code style={{ overflowWrap: "anywhere" }}>{f.key}</code> — {f.error}</li>
                ))}
              </ul>
              <p style={muted}>Those pictures were left exactly as they were and still work.</p>
            </details>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

/* ----------------------------------------------------------------------- styles */

const tiles = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 };
const tile = { border: "1px solid var(--color-border)", borderRadius: 12, padding: "11px 13px", background: "var(--color-bg)", display: "flex", flexDirection: "column", gap: 2 };
const tileWarn = { borderColor: "var(--tone-warning)", background: "color-mix(in srgb, var(--tone-warning) 8%, var(--color-bg))" };
const big = { fontSize: 22, fontFamily: "var(--font-heading)", fontVariantNumeric: "tabular-nums" };
const toolbar = { display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", margin: "18px 0 12px", paddingBottom: 12, borderBottom: "1px solid var(--color-border)" };
const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(136px, 1fr))", gap: 12 };
const pic = { display: "flex", flexDirection: "column", border: "1px solid var(--color-border)", borderRadius: 12, overflow: "hidden", background: "var(--color-bg)", minWidth: 0 };
const picOn = { borderColor: "var(--color-primary)", boxShadow: "0 0 0 1px var(--color-primary)" };
const thumbBox = { position: "relative", display: "block", aspectRatio: "4 / 3", background: "var(--color-surface)" };
const thumb = { width: "100%", height: "100%", objectFit: "cover", display: "block" };
const tick = { position: "absolute", top: 8, left: 8, display: "grid", placeItems: "center", width: 24, height: 24, borderRadius: 7, background: "color-mix(in srgb, var(--color-bg) 88%, transparent)" };
const sizeBadge = { position: "absolute", right: 8, bottom: 8, fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: "color-mix(in srgb, var(--color-bg) 90%, transparent)", color: "var(--color-text)", fontVariantNumeric: "tabular-nums" };
const caption = { display: "flex", flexDirection: "column", gap: 1, padding: "8px 10px 10px", minWidth: 0 };
const clip = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" };
const stagePill = { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 99, border: "1px solid var(--color-border)", color: "var(--color-text-muted)" };
const stageNow = { color: "var(--color-primary)", borderColor: "var(--color-primary)", background: "color-mix(in srgb, var(--color-primary) 8%, var(--color-bg))" };
const stageDone = { color: "var(--tone-success)", borderColor: "var(--tone-success)" };
const track = { height: 8, borderRadius: 99, background: "var(--color-surface)", border: "1px solid var(--color-border)", overflow: "hidden" };
const fill = { height: "100%", background: "var(--color-primary)", transition: "width 300ms" };
