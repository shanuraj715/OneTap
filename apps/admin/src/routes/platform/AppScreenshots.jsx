import { useRef, useState } from "react";
import { SCREENSHOT_DEVICES, SCREENSHOT_DEVICE_INFO, SCREENSHOT_THEMES, screenshotShapeProblem } from "@rasoipulse/config-schema";
import { ArrowDown, ArrowUp, ExternalLink, Eye, EyeOff, ImageIcon, Moon, Pencil, Plus, Smartphone, Sun, Tablet, Trash2, Upload } from "lucide-react";
import * as api from "../../lib/api";
import { useAppShots, usePlatformMutation } from "../../lib/usePlatform";
import { Button, Card, Checkbox, Field, Modal, Pill, Select, TextInput, Toast } from "../../ui";
import { muted } from "./shared";

/**
 * Screenshots on an app's page of the website ("See it"). Per app: whether the section shows, its heading and intro, which device comes first — and the
 * screenshots themselves: each is a screen of the app (title, caption) with a picture for every device (a tablet held sideways, a tablet held upright, a phone) in
 * light and in dark. A visitor sees the device they pick, in the look their browser is in (or the one they pick), so a screenshot needs only the pictures it has:
 * a missing slot falls back to the other look, and a device with no picture anywhere isn't offered.
 */
const DEVICE_ICON = { "tablet-landscape": <Tablet size={14} aria-hidden="true" style={{ rotate: "90deg" }} />, "tablet-portrait": <Tablet size={14} aria-hidden="true" />, phone: <Smartphone size={14} aria-hidden="true" /> };
const deviceName = (d) => `${SCREENSHOT_DEVICE_INFO[d].label}${SCREENSHOT_DEVICE_INFO[d].sub ? ` · ${SCREENSHOT_DEVICE_INFO[d].sub.toLowerCase()}` : ""}`;

export function AppScreenshots({ app, meta }) {
  const q = useAppShots(app);
  const data = q.data;
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [asking, setAsking] = useState(null);
  const [problem, setProblem] = useState("");
  const move = usePlatformMutation((ids) => api.orderAppShots(app, ids));
  const patch = usePlatformMutation(({ id, body }) => api.updateAppShot(id, body));
  const remove = usePlatformMutation((id) => api.deleteAppShot(id));
  if (q.error) return <Toast kind="error">{q.error.message}</Toast>;
  if (!data) return <div style={{ marginBottom: 14 }}><Card><p style={muted}>Loading the screenshots…</p></Card></div>;
  const shots = data.shots;
  const pictures = shots.reduce((n, s) => n + Object.values(s.images).reduce((m, by) => m + Object.keys(by).length, 0), 0);
  const devicesWith = SCREENSHOT_DEVICES.filter((d) => shots.some((s) => s.enabled && s.images[d]));
  const swap = (i, j) => {
    const ids = shots.map((s) => s.id);
    [ids[i], ids[j]] = [ids[j], ids[i]];
    move.mutate(ids);
  };
  const fail = (e) => setProblem(e?.message ?? "Something went wrong.");

  return (
    <div style={{ marginBottom: 14 }}>
      <Card>
        <div data-testid="app-shots">
          <div style={head}>
            <div style={{ minWidth: 0, flex: "1 1 320px" }}>
              <div style={label}>
                <ImageIcon size={12} aria-hidden="true" style={{ verticalAlign: "-1px", marginRight: 5 }} />
                Screenshots on the website
              </div>
              <div style={{ fontSize: 14.5 }} data-testid="shots-summary">
                {shots.length === 0
                  ? `${meta.code} has no screenshots yet, so its page has no screenshots section.`
                  : `${shots.length} screenshot${shots.length === 1 ? "" : "s"}, ${pictures} picture${pictures === 1 ? "" : "s"} · ${data.section.enabled ? (devicesWith.length ? `shown on the page for ${devicesWith.map((d) => deviceName(d).toLowerCase()).join(", ")}` : "none is shown yet (hidden, or no picture)") : "the section is switched off"}`}
              </div>
              <p style={{ ...muted, margin: "6px 0 0", lineHeight: 1.5 }}>
                Visitors pick a device and a look (light, dark or Auto, which follows their browser). Put a picture in each slot you have; a missing one falls back to the other look, and a device with no picture isn't offered.
              </p>
            </div>
            <Button onClick={() => setAdding(true)} data-testid="shots-add"><Plus size={15} aria-hidden="true" /> Add a screenshot</Button>
          </div>

          <SectionForm key={app} app={app} meta={meta} section={data.section} limits={data.limits} />

          {shots.length === 0 ? (
            <p style={{ ...muted, margin: "14px 0 0" }}>Press “Add a screenshot”, give it a title, then put a picture in each slot.</p>
          ) : (
            <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
              {shots.map((s, i) => (
                <ShotCard
                  key={s.id}
                  n={i}
                  shot={s}
                  first={i === 0}
                  last={i === shots.length - 1}
                  busy={move.isPending || patch.isPending}
                  onUp={() => swap(i, i - 1)}
                  onDown={() => swap(i, i + 1)}
                  onToggle={() => patch.mutate({ id: s.id, body: { enabled: !s.enabled } }, { onError: fail })}
                  onEdit={() => setEditing(s)}
                  onRemove={() => setAsking(s)}
                  onProblem={setProblem}
                />
              ))}
            </div>
          )}
          {problem ? <Toast kind="error"><span data-testid="shots-error">{problem}</span></Toast> : null}
          {move.error ? <Toast kind="error">{move.error.message}</Toast> : null}
        </div>
      </Card>

      {adding ? <ShotForm onClose={() => setAdding(false)} limits={data.limits} onSave={(body) => api.createAppShot(app, body)} /> : null}
      {editing ? <ShotForm shot={editing} onClose={() => setEditing(null)} limits={data.limits} onSave={(body) => api.updateAppShot(editing.id, body)} /> : null}
      {asking ? (
        <Modal onClose={remove.isPending ? () => undefined : () => setAsking(null)} width={440} panelStyle={{ padding: 22 }} ariaLabel="Remove the screenshot">
          <h2 style={modalTitle}>Remove “{asking.title}”?</h2>
          <p style={{ ...muted, margin: "0 0 14px", lineHeight: 1.55 }}>
            It disappears from the app's page on the website, and the pictures you uploaded for it are deleted. {asking.builtIn ? "(The pictures that come with the website stay in its files; they are just no longer used.) " : ""}This can't be undone.
          </p>
          {remove.error ? <Toast kind="error">{remove.error.message}</Toast> : null}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Button variant="outline" onClick={() => setAsking(null)} disabled={remove.isPending}>Cancel</Button>
            <Button onClick={() => remove.mutate(asking.id, { onSuccess: () => setAsking(null) })} disabled={remove.isPending} data-testid="shot-remove-confirm">{remove.isPending ? "Removing…" : "Remove it"}</Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

/** the section's switch, heading, intro and first device */
function SectionForm({ app, meta, section, limits }) {
  const [heading, setHeading] = useState(section.heading ?? "");
  const [intro, setIntro] = useState(section.intro ?? "");
  const [device, setDevice] = useState(section.defaultDevice);
  const save = usePlatformMutation((body) => api.saveAppShotsSection(app, body));
  const changed = heading !== (section.heading ?? "") || intro !== (section.intro ?? "") || device !== section.defaultDevice;
  return (
    <div style={sectionBox} data-testid="shots-section">
      <Checkbox
        checked={section.enabled}
        onChange={(v) => save.mutate({ enabled: v })}
        label={`Show the screenshots section on ${meta.code}'s page`}
      />
      <form
        style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", marginTop: 10, opacity: section.enabled ? 1 : 0.55 }}
        onSubmit={(e) => { e.preventDefault(); if (changed && !save.isPending) save.mutate({ heading: heading.trim(), intro: intro.trim(), defaultDevice: device }); }}
      >
        <Field label="Heading" hint={`Empty = “${section.usualHeading}”`}>
          <TextInput value={heading} maxLength={limits.heading} onChange={(e) => { setHeading(e.target.value); save.reset(); }} placeholder={section.usualHeading} style={{ width: "100%", boxSizing: "border-box" }} data-testid="shots-heading" />
        </Field>
        <Field label="Shown first" hint="The device the page opens on (if it has a picture).">
          <Select style={{ width: "100%", boxSizing: "border-box" }} value={device} onChange={(e) => { setDevice(e.target.value); save.reset(); }} data-testid="shots-device">
            {SCREENSHOT_DEVICES.map((d) => <option key={d} value={d}>{deviceName(d)}</option>)}
          </Select>
        </Field>
        <div style={{ gridColumn: "1 / -1" }}>
          <Field label="Line under the heading" hint="Empty = the usual line.">
            <TextInput value={intro} maxLength={limits.intro} onChange={(e) => { setIntro(e.target.value); save.reset(); }} placeholder={section.usualIntro} style={{ width: "100%", boxSizing: "border-box" }} data-testid="shots-intro" />
          </Field>
        </div>
        <div style={{ gridColumn: "1 / -1", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <Button type="submit" disabled={!changed || save.isPending} data-testid="shots-save">{save.isPending ? "Saving…" : "Save"}</Button>
          {meta.pageUrl ? <a href={`${meta.pageUrl}#screens`} target="_blank" rel="noreferrer" style={link} data-testid="shots-view">View on the website <ExternalLink size={13} aria-hidden="true" /></a> : null}
          {save.isSuccess && !save.isPending && !changed ? <span style={{ ...muted, color: "var(--color-success, #15803d)" }} data-testid="shots-saved">Saved.</span> : null}
        </div>
      </form>
      {save.error ? <Toast kind="error"><span data-testid="shots-section-error">{save.error.message}</span></Toast> : null}
    </div>
  );
}

/** one screenshot: its words, and a slot for each device × look */
function ShotCard({ n, shot, first, last, busy, onUp, onDown, onToggle, onEdit, onRemove, onProblem }) {
  return (
    <div style={{ ...shotBox, opacity: shot.enabled ? 1 : 0.7 }} data-testid={`shot-card-${n}`}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap", justifyContent: "space-between" }}>
        <div style={{ minWidth: 0, flex: "1 1 280px" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <strong style={{ fontSize: 15 }} data-testid={`shot-title-${n}`}>{shot.title}</strong>
            {!shot.enabled ? <Pill tone="warn">Hidden</Pill> : null}
            {shot.builtIn ? <Pill tone="neutral">Came with the website</Pill> : null}
          </div>
          <div style={{ ...muted, marginTop: 3, lineHeight: 1.45 }} data-testid={`shot-caption-${n}`}>{shot.caption || "No caption yet."}</div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Button variant="outline" onClick={onUp} disabled={first || busy} aria-label={`Move “${shot.title}” up`} title="Move up" data-testid={`shot-up-${n}`}><ArrowUp size={14} aria-hidden="true" /></Button>
          <Button variant="outline" onClick={onDown} disabled={last || busy} aria-label={`Move “${shot.title}” down`} title="Move down" data-testid={`shot-down-${n}`}><ArrowDown size={14} aria-hidden="true" /></Button>
          <Button variant="outline" onClick={onToggle} disabled={busy} data-testid={`shot-enabled-${n}`} title={shot.enabled ? "Hide it from the page (keeps the pictures)" : "Show it on the page"}>
            {shot.enabled ? <Eye size={14} aria-hidden="true" /> : <EyeOff size={14} aria-hidden="true" />} {shot.enabled ? "Shown" : "Hidden"}
          </Button>
          <Button variant="outline" onClick={onEdit} data-testid={`shot-edit-${n}`}><Pencil size={14} aria-hidden="true" /> Edit</Button>
          <Button variant="outline" onClick={onRemove} aria-label={`Remove “${shot.title}”`} data-testid={`shot-remove-${n}`}><Trash2 size={14} aria-hidden="true" /></Button>
        </div>
      </div>
      <div style={slotGrid}>
        {SCREENSHOT_DEVICES.map((d) => (
          <div key={d} style={{ minWidth: 0 }}>
            <div style={{ ...muted, display: "flex", alignItems: "center", gap: 6, fontWeight: 650, marginBottom: 6 }}>{DEVICE_ICON[d]} {deviceName(d)}</div>
            <div style={{ display: "flex", gap: 8 }}>
              {SCREENSHOT_THEMES.map((t) => <Slot key={t} n={n} shot={shot} device={d} theme={t} onProblem={onProblem} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** one picture slot: the picture (or a dashed box), upload / replace, remove */
function Slot({ n, shot, device, theme, onProblem }) {
  const file = useRef(null);
  const img = shot.images[device]?.[theme];
  const up = usePlatformMutation((f) => api.uploadAppShotImage(shot.id, device, theme, f));
  const del = usePlatformMutation(() => api.removeAppShotImage(shot.id, device, theme));
  const info = SCREENSHOT_DEVICE_INFO[device];
  const wrong = img ? screenshotShapeProblem(device, img.width, img.height) : "";
  const id = `${n}-${device}-${theme}`;
  const choose = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    onProblem("");
    up.mutate(f, { onError: (err) => onProblem(`${deviceName(device)}, ${theme}: ${err.message}`) });
  };
  return (
    <div style={{ width: Math.round((THUMB * info.width) / info.height), maxWidth: "100%", minWidth: 0 }} data-testid={`slot-${id}`} data-filled={img ? "true" : "false"}>
      <div style={{ ...frame, width: "100%", background: theme === "dark" ? "#14131c" : "#f3f4fa" }}>
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img.src} alt={`${shot.title}, ${deviceName(device)}, ${theme}`} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top", display: "block" }} data-testid={`slot-img-${id}`} />
        ) : (
          <span style={{ ...muted, display: "grid", placeItems: "center", height: "100%", textAlign: "center", padding: 4 }}>
            {theme === "dark" ? <Moon size={16} aria-hidden="true" /> : <Sun size={16} aria-hidden="true" />}
            <span style={{ fontSize: 11 }}>No {theme} picture</span>
          </span>
        )}
        {up.isPending ? <span style={busyVeil}>Uploading…</span> : null}
      </div>
      <input ref={file} type="file" accept="image/*" hidden onChange={choose} data-testid={`slot-file-${id}`} aria-label={`${img ? "Replace" : "Upload"} the ${theme} picture for ${deviceName(device)}`} />
      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
        <Button variant="outline" onClick={() => file.current?.click()} disabled={up.isPending || del.isPending} style={{ flex: 1, minWidth: 0, justifyContent: "center", padding: "5px 6px", fontSize: 12 }} data-testid={`slot-upload-${id}`} title={img ? "Replace the picture" : "Upload a picture"}>
          <Upload size={12} aria-hidden="true" />{info.width > info.height ? <>&nbsp;{img ? "Replace" : "Upload"}</> : null}
        </Button>
        {img ? (
          <Button variant="outline" onClick={() => del.mutate(undefined, { onError: (err) => onProblem(err.message) })} disabled={up.isPending || del.isPending} aria-label={`Remove the ${theme} picture for ${deviceName(device)}`} style={{ padding: "5px 8px" }} data-testid={`slot-remove-${id}`}>
            <Trash2 size={12} aria-hidden="true" />
          </Button>
        ) : null}
      </div>
      {img ? <div style={{ ...muted, fontSize: 11, marginTop: 4 }}>{img.width} × {img.height}{img.uploaded ? " · uploaded" : ""}</div> : null}
      {wrong ? <div style={{ fontSize: 11, marginTop: 3, color: "var(--color-warning, #b45309)", lineHeight: 1.35 }} data-testid={`slot-shape-${id}`}>{wrong}</div> : null}
    </div>
  );
}

/** adding a screenshot, or changing its words */
function ShotForm({ shot, onClose, onSave, limits }) {
  const editing = Boolean(shot);
  const [title, setTitle] = useState(shot?.title ?? "");
  const [caption, setCaption] = useState(shot?.caption ?? "");
  const [alt, setAlt] = useState(shot?.alt ?? "");
  const save = usePlatformMutation((body) => onSave(body));
  const ready = title.trim().length >= 2 && !save.isPending;
  return (
    <Modal onClose={save.isPending ? () => undefined : onClose} width={540} panelStyle={{ padding: 24, overflowY: "auto" }} ariaLabel={editing ? "Edit the screenshot" : "Add a screenshot"}>
      <h2 style={modalTitle}>{editing ? "Edit the screenshot" : "Add a screenshot"}</h2>
      <form
        style={{ display: "flex", flexDirection: "column", gap: 12 }}
        data-testid="shot-form"
        onSubmit={(e) => { e.preventDefault(); if (ready) save.mutate({ title: title.trim(), caption: caption.trim(), alt: alt.trim() }, { onSuccess: onClose }); }}
      >
        <Field label="Title" hint="What the screen is for, for example “Every table at a glance”.">
          <TextInput value={title} maxLength={limits.title} onChange={(e) => { setTitle(e.target.value); save.reset(); }} autoFocus data-testid="shot-form-title" />
        </Field>
        <Field label="Caption" hint="One or two sentences next to the picture.">
          <textarea value={caption} maxLength={limits.caption} rows={3} onChange={(e) => setCaption(e.target.value)} style={textarea} data-testid="shot-form-caption" />
        </Field>
        <Field label="What is on the screen" hint="For people who can't see the picture (screen readers). The device and the look are added for you.">
          <TextInput value={alt} maxLength={limits.alt} onChange={(e) => setAlt(e.target.value)} data-testid="shot-form-alt" />
        </Field>
        {save.error ? <Toast kind="error"><span data-testid="shot-form-error">{save.error.message}</span></Toast> : null}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button type="button" variant="outline" onClick={onClose} disabled={save.isPending}>Cancel</Button>
          <Button type="submit" disabled={!ready} data-testid="shot-form-save">{save.isPending ? "Saving…" : editing ? "Save" : "Add it"}</Button>
        </div>
      </form>
    </Modal>
  );
}

const label = { fontSize: 11.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: 4 };
const head = { display: "flex", flexWrap: "wrap", gap: "12px 24px", alignItems: "flex-start", justifyContent: "space-between" };
const modalTitle = { margin: "0 0 12px", fontSize: 18 };
const sectionBox = { marginTop: 14, padding: "12px 14px", border: "1px solid var(--color-border)", borderRadius: 12, background: "var(--color-bg)" };
const shotBox = { border: "1px solid var(--color-border)", borderRadius: 12, padding: "12px 14px", background: "var(--color-bg)" };
const THUMB = 150; // the height of every picture's box (px): its width follows the device's shape
const slotGrid = { display: "flex", flexWrap: "wrap", gap: "16px 26px", marginTop: 12 };
const frame = { position: "relative", overflow: "hidden", borderRadius: 8, border: "1px solid var(--color-border)", height: THUMB, flex: "none" };
const busyVeil = { position: "absolute", inset: 0, display: "grid", placeItems: "center", background: "rgba(0,0,0,0.45)", color: "#fff", fontSize: 12, fontWeight: 650 };
const link = { display: "inline-flex", alignItems: "center", gap: 6, color: "var(--color-primary)", fontWeight: 600, fontSize: 13.5, textDecoration: "none" };
const textarea = { font: "inherit", padding: "9px 11px", borderRadius: 8, border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-text)", resize: "vertical", width: "100%", boxSizing: "border-box" };
