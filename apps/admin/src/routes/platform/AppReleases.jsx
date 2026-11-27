import { useRef, useState } from "react";
import { APP_CATALOG, APP_IDS, APP_REFRESH, MAX_APK_MB, formatBytes, parseAppVersion } from "@rasoipulse/config-schema";
import { Archive, Check, Copy, Download, ExternalLink, Eye, EyeOff, Globe, Lock, Pencil, RefreshCw, Rocket, ShieldAlert, Smartphone, Trash2, Upload } from "lucide-react";
import * as api from "../../lib/api";
import { uploadApk, versionFromFileName } from "../../lib/uploadApk";
import { useAppReleases, useAppSettings, usePlatformMutation } from "../../lib/usePlatform";
import { Button, Card, Checkbox, Empty, Field, Modal, Note, PageHeader, Pill, TextInput, Toast } from "../../ui";
import { fmtDate, muted } from "./shared";

const STATUS = {
  draft: { label: "Draft", tone: "neutral" },
  published: { label: "Published", tone: "ok" },
  withdrawn: { label: "Withdrawn", tone: "warn" },
};

/**
 * The staff app (Rasoi Pulse OMA): upload a new APK, decide whether staff may skip the update or must install it first, and see how
 * many times each version was downloaded. What is "published" here is exactly what the phones are told about when they start, and what
 * the website's /app page lets people download.
 */
export function AppReleases() {
  const [app, setApp] = useState(() => { try { const a = new URLSearchParams(window.location.search).get("app"); return APP_IDS.includes(a) ? a : "oma"; } catch { return "oma"; } });
  const meta = APP_CATALOG[app];
  const q = useAppReleases(app);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);
  const data = q.data;
  const releases = data?.releases ?? [];

  return (
    <>
      <PageHeader
        title="App Management"
        icon={<Smartphone size={23} />}
        subtitle="One page for every Rasoi Pulse app. Choose the app, upload a new version, decide whether staff can skip it or must install it first, and share its download page."
        action={
          <Button onClick={() => setCreating(true)}>
            <Upload size={15} aria-hidden="true" /> New version
          </Button>
        }
      />

      <div role="tablist" aria-label="Apps" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        {APP_IDS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={id === app}
            data-testid={`app-tab-${id}`}
            onClick={() => { setApp(id); setCreating(false); setEditing(null); }}
            style={{ ...appTab, ...(id === app ? appTabOn : {}) }}
          >
            <Smartphone size={15} aria-hidden="true" /> {APP_CATALOG[id].name}
            <span style={{ opacity: 0.7, fontWeight: 500 }}>· {APP_CATALOG[id].tagline}</span>
          </button>
        ))}
      </div>

      {q.isLoading ? (
        <Card>
          <p style={muted}>Loading…</p>
        </Card>
      ) : q.error ? (
        <Toast kind="error">{q.error.message}</Toast>
      ) : (
        <>
          <Summary data={data} />
          <AppVisibility app={app} meta={meta} />
          {meta.usesRefreshInterval !== false ? <RefreshInterval app={app} meta={meta} /> : null}
          <Card>
            {releases.length === 0 ? (
              <Empty icon={<Smartphone size={34} />} title="No version uploaded yet">
                Press “New version”, choose the .apk file, and publish it. Phones will then be offered it the next time they open the app.
              </Empty>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {releases.map((r) => (
                  <Release key={r.id} release={r} newest={r.id === releases[0].id} onEdit={() => setEditing(r)} />
                ))}
              </div>
            )}
          </Card>
        </>
      )}

      {creating ? <NewVersion data={data} app={app} meta={meta} onClose={() => setCreating(false)} /> : null}
      {editing ? <EditNotes release={editing} onClose={() => setEditing(null)} /> : null}
    </>
  );
}

/**
 * Public or private. A PUBLIC app is in the list of apps on the website (the /apps page and the home page); a PRIVATE one is not listed anywhere,
 * but its own page still opens for anyone who has the link, so a team can download it (search engines are told to skip it). Every app has the
 * button; the Admin and Business apps start private.
 */
function AppVisibility({ app, meta }) {
  const q = useAppSettings();
  const setting = q.data?.settings.find((s) => s.app === app);
  const [copied, setCopied] = useState(false);
  const set = usePlatformMutation((isPublic) => api.setAppVisibility(app, isPublic));
  if (!setting) return null;
  const isPublic = setting.public;
  const toggle = () => {
    if (!isPublic && !window.confirm(`Make ${meta.name} public? It will appear in the list of apps on the website, where anyone can see it and download it.`)) return;
    set.mutate(!isPublic);
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(setting.pageUrl); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* the link is also shown to copy by hand */ }
  };
  return (
    <div style={{ marginBottom: 14 }}>
      <Card>
        <div data-testid="app-visibility" style={{ display: "flex", flexWrap: "wrap", gap: "14px 28px", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ minWidth: 0, flex: "1 1 320px" }}>
            <div style={label}>
              {isPublic ? <Globe size={12} aria-hidden="true" style={{ verticalAlign: "-1px", marginRight: 5 }} /> : <Lock size={12} aria-hidden="true" style={{ verticalAlign: "-1px", marginRight: 5 }} />}
              Visibility
            </div>
            <div style={{ fontSize: 14.5, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }} data-testid="app-visibility-now">
              <Pill tone={isPublic ? "ok" : "neutral"}>{isPublic ? "Public" : "Private"}</Pill>
              <span>{isPublic ? `${meta.name} is in the list of apps on the website.` : `${meta.name} is not in the list of apps on the website.`}</span>
            </div>
            <p style={{ ...muted, margin: "6px 0 0", fontSize: 13, lineHeight: 1.5 }}>
              {isPublic
                ? "Anyone who visits the website can see this app and download it."
                : "It is not listed anywhere, and search engines are told to skip it. Only people who have its link can open the page and download it — share the link with your team:"}
            </p>
            {!isPublic ? (
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 6 }}>
                <code data-testid="app-visibility-link" style={{ fontSize: 12.5, overflowWrap: "anywhere" }}>{setting.pageUrl}</code>
                <Button variant="outline" onClick={copy} data-testid="app-visibility-copy" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                  <Copy size={13} aria-hidden="true" /> {copied ? "Copied" : "Copy link"}
                </Button>
              </div>
            ) : null}
          </div>
          <Button variant={isPublic ? "outline" : undefined} onClick={toggle} disabled={set.isPending} data-testid="app-visibility-toggle">
            {set.isPending ? "Saving…" : isPublic ? "Make private" : "Make public"}
          </Button>
        </div>
        {set.error ? <Toast kind="error">{set.error.message}</Toast> : null}
      </Card>
    </div>
  );
}

/** What each app's refresh covers, in the words of the people who use it (shown under the number). */
const REFRESH_COVERS = {
  oma: "the table board and the list of orders",
  kda: "the kitchen board (new orders and their timers)",
  rda: "the list of deliveries (new delivery requests)",
};

/**
 * How often THIS app asks the server for new data. One number per app: the delivery app set to 15 asks for new deliveries every 15 seconds.
 * The server states it in every answer it gives the app, so a change reaches each phone with its very next request, with no new version to install
 * (an app version made before this setting existed keeps asking at its own fixed pace until it is updated).
 */
function RefreshInterval({ app, meta }) {
  const q = useAppSettings();
  const setting = q.data?.settings.find((s) => s.app === app);
  if (!setting) return q.error ? <Toast kind="error">{q.error.message}</Toast> : null;
  // keyed by the app: switching tabs starts a fresh box, while a save keeps its "Saved." note
  return <RefreshForm key={app} app={app} meta={meta} setting={setting} />;
}

function RefreshForm({ app, meta, setting }) {
  const [text, setText] = useState(String(setting.refreshSeconds));
  const save = usePlatformMutation((seconds) => api.saveAppSettings(app, seconds));
  const n = Number(text);
  const valid = text.trim() !== "" && Number.isInteger(n) && n >= APP_REFRESH.min && n <= APP_REFRESH.max;
  const changed = valid && n !== setting.refreshSeconds;
  const problem = text.trim() === "" ? "" : !Number.isInteger(n) ? `Enter a whole number of seconds, from ${APP_REFRESH.min} to ${APP_REFRESH.max}.` : n < APP_REFRESH.min ? `At least ${APP_REFRESH.min} seconds: asking more often only loads the server.` : n > APP_REFRESH.max ? `At most ${APP_REFRESH.max} seconds.` : "";
  return (
    <div style={{ marginBottom: 14 }}>
    <Card>
      <div data-testid="app-refresh" style={{ display: "flex", flexWrap: "wrap", gap: "14px 28px", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div style={{ minWidth: 0, flex: "1 1 280px" }}>
          <div style={label}>
            <RefreshCw size={12} aria-hidden="true" style={{ verticalAlign: "-1px", marginRight: 5 }} />
            Refresh interval
          </div>
          <div style={{ fontSize: 14.5 }} data-testid="app-refresh-now">
            {meta.code} asks the server for new data every <strong>{setting.refreshSeconds} seconds</strong>
            <span style={muted}>{setting.isDefault ? " (the default)" : ""}</span>
          </div>
          <p style={{ ...muted, margin: "6px 0 0", fontSize: 13, lineHeight: 1.5 }}>
            This covers {REFRESH_COVERS[app] ?? "everything the app refreshes by itself"}. A longer wait means fewer requests to the server but new things show later. Slower lists (for example today’s totals, or the dishes that
            can’t be ordered) keep their own slower pace, and never refresh faster than this. Phones pick up a change with their next request. Each app has its own setting.
          </p>
        </div>
        <form
          style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}
          onSubmit={(e) => {
            e.preventDefault();
            if (changed && !save.isPending) save.mutate(n);
          }}
        >
          <Field label="Seconds between refreshes" hint={`Default ${APP_REFRESH.default}. From ${APP_REFRESH.min} to ${APP_REFRESH.max}.`} style={{ width: 190 }}>
            <TextInput type="number" inputMode="numeric" min={APP_REFRESH.min} max={APP_REFRESH.max} step={1} value={text} onChange={(e) => { setText(e.target.value); save.reset(); }} data-testid="refresh-seconds" aria-invalid={problem ? "true" : undefined} />
          </Field>
          <Button type="submit" disabled={!changed || save.isPending} data-testid="refresh-save">
            {save.isPending ? "Saving…" : "Save"}
          </Button>
          {n !== APP_REFRESH.default || setting.refreshSeconds !== APP_REFRESH.default ? (
            <Button type="button" variant="outline" onClick={() => { setText(String(APP_REFRESH.default)); save.reset(); }} data-testid="refresh-default">
              Use the default ({APP_REFRESH.default})
            </Button>
          ) : null}
        </form>
      </div>
      {problem ? <Toast kind="error"><span data-testid="refresh-problem">{problem}</span></Toast> : null}
      {save.error ? <Toast kind="error"><span data-testid="refresh-error">{save.error.message}</span></Toast> : null}
      {save.isSuccess && !save.isPending ? <Toast kind="ok"><span data-testid="refresh-saved">Saved. {meta.code} now asks every {save.variables ?? setting.refreshSeconds} seconds.</span></Toast> : null}
    </Card>
    </div>
  );
}

/** What phones are being told right now, and the page people download from. */
function Summary({ data }) {
  const [copied, setCopied] = useState(false);
  const latest = data.latest;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(data.pageUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* the link is shown, so it can still be selected by hand */
    }
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }} data-testid="app-summary">
      <Card>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "14px 28px", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={label}>Phones are offered</div>
            {latest ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={bigVersion}>{latest.version}</span>
                <span style={muted}>
                  {formatBytes(latest.size)} · published {fmtDate(latest.publishedAt)}
                </span>
              </div>
            ) : (
              <div style={{ ...muted, fontSize: 14 }}>Nothing yet, since no version is published.</div>
            )}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={label}>Download page for staff</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <a href={data.pageUrl} target="_blank" rel="noreferrer" style={link}>
                {data.pageUrl.replace(/^https?:\/\//, "")} <ExternalLink size={13} aria-hidden="true" />
              </a>
              <Button variant="outline" onClick={copy} aria-label="Copy the download page link">
                {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />} {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>
        </div>
      </Card>
      {data.forcedBelow ? (
        <Note icon={<ShieldAlert size={17} />}>
          <strong>Update required.</strong> Every phone running a version older than <strong>{data.forcedBelow.version}</strong> is stopped at a screen that says
          “update first”. They cannot sign in until they install it.
        </Note>
      ) : (
        <Note icon={<Smartphone size={17} />}>
          Updates are <strong>optional</strong> right now: staff see a pop-up with “Update” and “Later”. Switch on <strong>Required</strong> for a version to make
          every older phone update before it can be used.
        </Note>
      )}
    </div>
  );
}

function Release({ release: r, newest, onEdit }) {
  const patch = usePlatformMutation((body) => api.updateAppRelease(r.id, body));
  const remove = usePlatformMutation(() => api.deleteAppRelease(r.id));
  const [more, setMore] = useState(false);
  const st = STATUS[r.status] ?? STATUS.draft;
  const busy = patch.isPending || remove.isPending;
  const error = patch.error ?? remove.error;

  return (
    <div style={{ ...box, ...(newest ? boxNewest : {}) }} data-testid={`release-${r.version}`}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ ...bigVersion, fontSize: 17 }}>{r.version}</span>
        <Pill tone={st.tone}>{st.label}</Pill>
        {r.force ? (
          <Pill tone="error" icon={<ShieldAlert size={11} aria-hidden="true" />}>
            Update required
          </Pill>
        ) : null}
        <span style={{ ...muted, fontSize: 12.5, marginLeft: "auto", fontVariantNumeric: "tabular-nums" }}>
          {formatBytes(r.size)} · {r.downloads} download{r.downloads === 1 ? "" : "s"} · {r.publishedAt ? `published ${fmtDate(r.publishedAt)}` : `uploaded ${fmtDate(r.createdAt)}`}
        </span>
      </div>

      {r.notes ? <p style={notesText}>{r.notes}</p> : <p style={{ ...muted, margin: "8px 0 0", fontSize: 13 }}>No release notes.</p>}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 12 }}>
        {r.status === "published" ? (
          <Button variant="outline" disabled={busy} onClick={() => patch.mutate({ status: "withdrawn" })}>
            <EyeOff size={14} aria-hidden="true" /> Withdraw
          </Button>
        ) : (
          <Button disabled={busy} onClick={() => patch.mutate({ status: "published" })}>
            <Rocket size={14} aria-hidden="true" /> {r.status === "withdrawn" ? "Publish again" : "Publish"}
          </Button>
        )}
        <Checkbox
          checked={r.force}
          disabled={busy}
          onChange={(force) => patch.mutate({ force })}
          label="Required"
          info="Staff on an older version cannot use the app until they install this one. Leave it off to let them choose “Later”."
        />
        <span style={{ flex: 1 }} />
        <Button variant="outline" onClick={onEdit} disabled={busy}>
          <Pencil size={14} aria-hidden="true" /> Notes
        </Button>
        <a href={r.downloadUrl} style={{ ...linkButton, ...(r.status !== "published" ? disabledLink : {}) }} aria-disabled={r.status !== "published"} title={r.status === "published" ? "Download the file" : "Only published versions can be downloaded"} onClick={(e) => r.status !== "published" && e.preventDefault()}>
          <Download size={14} aria-hidden="true" /> APK
        </a>
        <Button variant="outline" onClick={() => setMore(!more)} aria-expanded={more} aria-label="Details of this file">
          <Archive size={14} aria-hidden="true" /> File
        </Button>
        <Button
          variant="outline"
          disabled={busy}
          style={{ color: "var(--tone-danger)" }}
          aria-label={`Delete ${r.version}`}
          onClick={() => {
            if (window.confirm(`Delete ${r.version}? The file is removed from the server and nobody can download it again.${r.status === "published" ? " It is published right now." : ""}`)) remove.mutate();
          }}
        >
          <Trash2 size={14} aria-hidden="true" />
        </Button>
      </div>

      {more ? (
        <dl style={facts}>
          <dt style={muted}>File name</dt>
          <dd style={fact}>{r.fileName}</dd>
          <dt style={muted}>Build number</dt>
          <dd style={fact}>{r.versionCode}</dd>
          <dt style={muted}>SHA-256</dt>
          <dd style={{ ...fact, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12, overflowWrap: "anywhere" }}>{r.sha256}</dd>
        </dl>
      ) : null}
      {error ? <Toast kind="error">{error.message}</Toast> : null}
    </div>
  );
}

function EditNotes({ release, onClose }) {
  const [notes, setNotes] = useState(release.notes);
  const save = usePlatformMutation((body) => api.updateAppRelease(release.id, body));
  return (
    <Modal onClose={onClose} width={560} panelStyle={{ padding: 24, overflowY: "auto" }} ariaLabel={`Release notes for ${release.version}`}>
      <h2 style={modalTitle}>Release notes · {release.version}</h2>
      <p style={{ ...muted, margin: "0 0 12px" }}>Staff read this in the update pop-up and on the download page. Say what changed, in a line or two.</p>
      <textarea value={notes} onChange={(e) => setNotes(e.target.value.slice(0, 3000))} rows={7} style={textarea} aria-label="Release notes" />
      <div style={{ ...muted, fontSize: 12, textAlign: "right" }}>{notes.length} / 3000</div>
      {save.error ? <Toast kind="error">{save.error.message}</Toast> : null}
      <div style={modalButtons}>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={save.isPending || notes === release.notes} onClick={() => save.mutate({ notes }, { onSuccess: onClose })}>
          {save.isPending ? "Saving…" : "Save notes"}
        </Button>
      </div>
    </Modal>
  );
}

/** Choose the .apk, name the version, say whether it is required, then send it up in pieces with a progress bar. */
function NewVersion({ data, app, meta, onClose }) {
  const [file, setFile] = useState(null);
  const [version, setVersion] = useState("");
  const [notes, setNotes] = useState("");
  const [force, setForce] = useState(false);
  const [publish, setPublish] = useState(true);
  const [progress, setProgress] = useState(null); // { sent, total, piece, pieces }
  const [stage, setStage] = useState("form"); // form | sending | finishing
  const [error, setError] = useState("");
  const [done, setDone] = useState(null);
  const cancel = useRef(null);
  const pick = useRef(null);
  const save = usePlatformMutation(({ uploadId, body }) => api.completeAppUpload(uploadId, body));

  const tooBig = file && file.size > (data?.maxBytes ?? MAX_APK_MB * 1024 * 1024);
  const parsed = parseAppVersion(version);
  const code = parsed?.build ?? 0;
  const clash = parsed && data?.releases.find((r) => r.versionCode === code);
  const newest = data?.releases[0]?.versionCode ?? 0;
  const versionProblem = !version ? "" : !parsed ? "Use the form v-YY.MM.DD-NNN, for example v-26.11.27-003." : parsed.legacy ? "That is the old form. Use v-YY.MM.DD-NNN, for example v-26.11.27-003." : clash ? `Build ${code} already exists (${clash.version}). Each build number can be used once.` : "";
  const versionWarning = parsed && !versionProblem && code < newest ? `Build ${code} is lower than the newest one (${newest}). Phones are only offered a higher build number, so nobody will be offered this.` : "";
  const ready = file && !tooBig && parsed && !clash && stage === "form";
  const busy = stage !== "form";

  const choose = (f) => {
    setError("");
    if (!f) return;
    if (!/\.apk$/i.test(f.name)) {
      setFile(null);
      setError("That is not an .apk file.");
      return;
    }
    setFile(f);
    const v = versionFromFileName(f.name);
    if (v && !version) setVersion(v);
  };

  const send = async () => {
    setError("");
    setStage("sending");
    setProgress({ sent: 0, total: file.size, piece: 0, pieces: 0 });
    const abort = new AbortController();
    cancel.current = abort;
    try {
      const { uploadId } = await uploadApk(file, { onProgress: setProgress, signal: abort.signal, app });
      setStage("finishing");
      const res = await save.mutateAsync({ uploadId, body: { version: version.trim(), notes, force, publish } });
      setDone(res.release);
    } catch (e) {
      setStage("form");
      setProgress(null);
      if (e?.name === "AbortError") setError("Upload cancelled.");
      else setError(e?.status === 409 && e.details?.code === "upload_incomplete" ? "Some pieces did not arrive. Please try again." : (e?.message ?? "The upload failed. Please try again."));
    } finally {
      cancel.current = null;
    }
  };

  const pct = progress && progress.total ? Math.min(100, Math.round((progress.sent / progress.total) * 100)) : 0;
  // while a file is going up the button stops the upload and leaves the form open (to try again); otherwise it closes the pop-up
  const close = () => {
    if (stage === "sending" && cancel.current) cancel.current.abort();
    else onClose();
  };

  if (done) {
    return (
      <Modal onClose={onClose} width={520} panelStyle={{ padding: 24, overflowY: "auto" }} ariaLabel="Version uploaded">
        <div style={{ textAlign: "center", padding: "6px 0 2px" }}>
          <div style={okBadge}>
            <Check size={26} aria-hidden="true" />
          </div>
          <h2 style={{ ...modalTitle, marginTop: 12 }}>{done.version} is {done.status === "published" ? "live" : "saved as a draft"}</h2>
          <p style={{ ...muted, margin: "6px 0 0" }}>
            {done.status === "published"
              ? done.force
                ? "Every older phone must install it before it can be used."
                : "Staff phones will offer it the next time the app opens. They can choose Later."
              : "Nobody can see it yet. Press Publish on the version when you are ready."}
          </p>
        </div>
        <div style={{ ...modalButtons, justifyContent: "center" }}>
          <Button onClick={onClose}>Done</Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal onClose={busy ? () => undefined : close} closeOnOverlay={!busy} width={600} panelStyle={{ padding: 24, overflowY: "auto" }} ariaLabel="New app version">
      <h2 style={modalTitle}>New version of {meta.name}</h2>

      <input ref={pick} type="file" accept=".apk,application/vnd.android.package-archive" hidden onChange={(e) => choose(e.target.files?.[0])} />
      <button
        type="button"
        disabled={busy}
        onClick={() => pick.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (!busy) choose(e.dataTransfer.files?.[0]);
        }}
        style={{ ...drop, ...(file ? dropFilled : {}) }}
      >
        <Upload size={22} aria-hidden="true" />
        {file ? (
          <>
            <strong style={{ overflowWrap: "anywhere" }}>{file.name}</strong>
            <span style={muted}>{formatBytes(file.size)} · press to choose another</span>
          </>
        ) : (
          <>
            <strong>Choose the .apk file</strong>
            <span style={muted}>or drop it here · up to {formatBytes(data?.maxBytes ?? MAX_APK_MB * 1024 * 1024)}</span>
          </>
        )}
      </button>
      {tooBig ? <Toast kind="error">That file is {formatBytes(file.size)}. The most allowed is {formatBytes(data.maxBytes)}.</Toast> : null}

      <div style={{ display: "grid", gap: 14, marginTop: 14 }}>
        <Field label="Version" style={{ maxWidth: "none", marginBottom: 0 }} hint="Year, month, day and a build number: v-YY.MM.DD-NNN. The build number must be higher than the last one.">
          <TextInput value={version} onChange={(e) => setVersion(e.target.value.trim().toLowerCase())} placeholder="v-26.11.27-003" disabled={busy} aria-invalid={Boolean(versionProblem)} />
          {versionProblem ? <span style={{ color: "var(--tone-danger)", fontSize: 12.5 }}>{versionProblem}</span> : null}
          {versionWarning ? <span style={{ color: "var(--tone-warning)", fontSize: 12.5 }}>{versionWarning}</span> : null}
        </Field>
        <Field label="What is new" style={{ maxWidth: "none", marginBottom: 0 }} hint="Shown to staff in the update pop-up and on the download page.">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value.slice(0, 3000))} rows={4} style={textarea} disabled={busy} placeholder="Faster menu, fixed the table list…" />
        </Field>
        <div style={{ display: "grid", gap: 10 }}>
          <Checkbox checked={force} onChange={setForce} disabled={busy} label="Update required" info="Staff on an older version are stopped at an “update first” screen and cannot use the app until they install this one." />
          <Checkbox checked={publish} onChange={setPublish} disabled={busy} label="Publish now" info="Off keeps it as a draft: uploaded, but invisible to phones and the website until you press Publish." />
        </div>
        {force && publish ? <Note icon={<ShieldAlert size={17} />}>Every phone on an older version will be blocked until it updates. Be sure the file works before you publish.</Note> : null}
      </div>

      {busy ? (
        <div style={{ marginTop: 16 }} role="status" aria-live="polite" data-testid="upload-progress">
          <div style={track} aria-hidden="true">
            <div style={{ ...fill, width: `${stage === "finishing" ? 100 : pct}%` }} />
          </div>
          <div style={{ ...muted, fontSize: 13, marginTop: 6, display: "flex", justifyContent: "space-between", fontVariantNumeric: "tabular-nums" }}>
            <span>{stage === "finishing" ? "Checking the file…" : `Sending ${formatBytes(progress?.sent ?? 0)} of ${formatBytes(file.size)}`}</span>
            <span>{stage === "finishing" ? "" : `${pct}%`}</span>
          </div>
        </div>
      ) : null}
      {error ? <Toast kind="error">{error}</Toast> : null}

      <div style={modalButtons}>
        <Button variant="outline" onClick={close} disabled={stage === "finishing"}>
          {stage === "sending" ? "Cancel upload" : "Close"}
        </Button>
        <Button disabled={!ready || Boolean(versionProblem)} onClick={send}>
          {busy ? "Uploading…" : publish ? (
            <>
              <Rocket size={14} aria-hidden="true" /> Upload and publish
            </>
          ) : (
            <>
              <Eye size={14} aria-hidden="true" /> Upload as draft
            </>
          )}
        </Button>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ styles */

const appTab = { display: "inline-flex", alignItems: "center", gap: 7, font: "inherit", fontSize: 13.5, fontWeight: 650, padding: "8px 14px", borderRadius: 999, border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-text)", cursor: "pointer" };
const appTabOn = { background: "var(--color-text)", borderColor: "var(--color-text)", color: "var(--color-bg)" };
const label = { fontSize: 11.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: 4 };
const bigVersion = { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 20, fontWeight: 700, letterSpacing: "-0.01em" };
const link = { display: "inline-flex", alignItems: "center", gap: 6, color: "var(--color-primary)", fontWeight: 600, fontSize: 14, textDecoration: "none", overflowWrap: "anywhere" };
const box = { border: "1px solid var(--color-border)", borderRadius: 12, padding: "14px 16px", background: "var(--color-bg)" };
const boxNewest = { borderColor: "var(--color-primary)" };
const notesText = { margin: "10px 0 0", fontSize: 14, whiteSpace: "pre-wrap", lineHeight: 1.5 };
const linkButton = { display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, border: "1px solid var(--color-border)", textDecoration: "none", color: "var(--color-text)", fontSize: 13, fontWeight: 600 };
const disabledLink = { opacity: 0.5, filter: "grayscale(1)", cursor: "not-allowed" };
const facts = { display: "grid", gridTemplateColumns: "110px minmax(0, 1fr)", gap: "6px 12px", margin: "12px 0 0", fontSize: 13.5 };
const fact = { margin: 0 };
const modalTitle = { fontFamily: "var(--font-heading)", fontSize: 20, margin: "0 0 10px" };
const modalButtons = { display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18, flexWrap: "wrap" };
const textarea = { width: "100%", boxSizing: "border-box", font: "inherit", fontSize: 14, padding: "9px 11px", borderRadius: 8, border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-text)", resize: "vertical" };
const drop = { width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "22px 14px", borderRadius: 12, border: "2px dashed var(--color-border)", background: "var(--color-surface)", color: "var(--color-text)", font: "inherit", fontSize: 14, cursor: "pointer" };
const dropFilled = { borderStyle: "solid", borderColor: "var(--color-primary)" };
const track = { height: 10, borderRadius: 999, background: "var(--color-border)", overflow: "hidden" };
const fill = { height: "100%", borderRadius: 999, background: "var(--color-primary)", transition: "width 0.2s ease" };
const okBadge = { width: 54, height: 54, borderRadius: "50%", margin: "0 auto", display: "grid", placeItems: "center", background: "var(--tone-success-wash)", color: "var(--tone-success)" };
