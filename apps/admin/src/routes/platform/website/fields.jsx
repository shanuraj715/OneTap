import { useRef, useState } from "react";
import { SITE_ICONS } from "@rasoipulse/config-schema";
import {
  ArrowDown,
  ArrowUp,
  BadgePercent,
  CalendarCheck,
  ChefHat,
  Coffee,
  CreditCard,
  Gift,
  Headset,
  LayoutDashboard,
  Monitor,
  Rocket,
  ScanLine,
  ShoppingBag,
  Soup,
  Sparkles,
  Timer,
  Truck,
  Wallet,
  Bike,
  ChartLine,
  Clock,
  Coins,
  ConciergeBell,
  Globe,
  ImagePlus,
  MessageCircle,
  Palette,
  Plus,
  Printer,
  QrCode,
  Receipt,
  ShieldCheck,
  Smartphone,
  Store,
  TicketPercent,
  Trash2,
  Users,
  Utensils,
  Zap,
} from "lucide-react";
import * as api from "../../../lib/api";

/**
 * Form pieces for the website editor. Plain, labelled inputs with a character
 * count where the site has a limit — the limits match the API's schema, so
 * nothing typed here is ever refused on save.
 */

export function Text({ label, value, onChange, max = 200, multiline = false, rows = 3, hint, placeholder, mono = false }) {
  const v = value ?? "";
  const near = v.length > max * 0.9;
  const Tag = multiline ? "textarea" : "input";
  return (
    <label style={field}>
      <span style={labelRow}>
        <span style={labelText}>{label}</span>
        <span style={{ ...count, color: near ? "var(--tone-warning)" : "var(--color-text-muted)" }}>
          {v.length}/{max}
        </span>
      </span>
      <Tag
        value={v}
        onChange={(e) => onChange(e.target.value.slice(0, max))}
        placeholder={placeholder}
        rows={multiline ? rows : undefined}
        style={{ ...input, ...(multiline ? { minHeight: rows * 22 + 20, resize: "vertical" } : {}), ...(mono ? { fontFamily: "ui-monospace, monospace", fontSize: 13 } : {}) }}
      />
      {hint ? <span style={hintStyle}>{hint}</span> : null}
    </label>
  );
}

/** A button: its words, and where it goes — a page of the site, an anchor on this page, or a full address. */
export function LinkField({ label, value, onChange, pages = [] }) {
  const v = value ?? { label: "", href: "" };
  const listId = useRef(`links-${Math.random().toString(36).slice(2)}`).current;
  return (
    <div style={field}>
      <span style={labelText}>{label}</span>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.3fr)", gap: 8 }}>
        <input value={v.label} onChange={(e) => onChange({ ...v, label: e.target.value.slice(0, 40) })} placeholder="Button text" style={input} aria-label={`${label} text`} />
        <input value={v.href} onChange={(e) => onChange({ ...v, href: e.target.value.slice(0, 300) })} placeholder="/contact or https://…" list={listId} style={input} aria-label={`${label} link`} />
      </div>
      <datalist id={listId}>
        {pages.map((p) => (
          <option key={p.slug} value={p.slug === "home" ? "/" : `/${p.slug}`}>
            {p.title}
          </option>
        ))}
        <option value="#pricing">Pricing section on this page</option>
      </datalist>
    </div>
  );
}

/** An image: upload one (compressed on the server) or paste an address; plus its description for screen readers and Google. */
export function ImageField({ label, value, onChange, withAlt = true }) {
  const v = typeof value === "string" ? { url: value, alt: "" } : value ?? { url: "", alt: "" };
  const set = (patch) => (typeof value === "string" ? onChange(patch.url ?? v.url) : onChange({ ...v, ...patch }));
  const file = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const upload = async (f) => {
    if (!f) return;
    setBusy(true);
    setError("");
    try {
      const r = await api.uploadSiteImage(f);
      set({ url: r.url });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      if (file.current) file.current.value = "";
    }
  };

  return (
    <div style={field}>
      <span style={labelText}>{label}</span>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        {v.url ? (
          <img src={v.url} alt="" style={thumb} />
        ) : (
          <span style={{ ...thumb, display: "grid", placeItems: "center", color: "var(--color-text-muted)" }}>
            <ImagePlus size={18} />
          </span>
        )}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", gap: 6 }}>
            <input value={v.url} onChange={(e) => set({ url: e.target.value.slice(0, 600) })} placeholder="Paste an image address, or upload →" style={{ ...input, flex: 1 }} aria-label={`${label} address`} />
            <button type="button" style={smallBtn} onClick={() => file.current?.click()} disabled={busy}>
              {busy ? "Uploading…" : "Upload"}
            </button>
            {v.url ? (
              <button type="button" style={smallBtn} onClick={() => set({ url: "" })} aria-label={`Remove ${label}`}>
                <Trash2 size={13} />
              </button>
            ) : null}
          </div>
          {withAlt && typeof value !== "string" ? (
            <input value={v.alt} onChange={(e) => set({ alt: e.target.value.slice(0, 160) })} placeholder="Describe the image (for screen readers and Google)" style={input} aria-label={`${label} description`} />
          ) : null}
        </div>
      </div>
      <input ref={file} type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files?.[0])} />
      {error ? <span style={{ ...hintStyle, color: "var(--tone-danger)" }}>{error}</span> : null}
    </div>
  );
}

export const ICON_COMPONENTS = {
  "qr-code": QrCode,
  "concierge-bell": ConciergeBell,
  smartphone: Smartphone,
  printer: Printer,
  coins: Coins,
  "ticket-percent": TicketPercent,
  "message-circle": MessageCircle,
  store: Store,
  globe: Globe,
  palette: Palette,
  "chart-line": ChartLine,
  clock: Clock,
  "shield-check": ShieldCheck,
  users: Users,
  zap: Zap,
  utensils: Utensils,
  bike: Bike,
  receipt: Receipt,
  coffee: Coffee,
  "chef-hat": ChefHat,
  soup: Soup,
  headset: Headset,
  rocket: Rocket,
  sparkles: Sparkles,
  "credit-card": CreditCard,
  monitor: Monitor,
  wallet: Wallet,
  "badge-percent": BadgePercent,
  "layout-dashboard": LayoutDashboard,
  timer: Timer,
  gift: Gift,
  "scan-line": ScanLine,
  "shopping-bag": ShoppingBag,
  truck: Truck,
  "calendar-check": CalendarCheck,
};

export function IconPicker({ value, onChange }) {
  return (
    <div style={field}>
      <span style={labelText}>Icon</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {SITE_ICONS.map((name) => {
          const C = ICON_COMPONENTS[name];
          const on = value === name;
          return (
            <button
              key={name}
              type="button"
              onClick={() => onChange(name)}
              title={name}
              aria-pressed={on}
              style={{ ...iconBtn, borderColor: on ? "var(--color-primary)" : "var(--color-border)", color: on ? "var(--color-primary)" : "var(--color-text-muted)" }}
            >
              <C size={15} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** A repeatable list (FAQ items, features…): add, reorder, remove. */
export function ListEditor({ label, items, onChange, newItem, max = 20, itemTitle, children }) {
  const update = (i, patch) => onChange(items.map((it, n) => (n === i ? { ...it, ...patch } : it)));
  const move = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div style={field}>
      <span style={labelRow}>
        <span style={labelText}>{label}</span>
        <span style={count}>
          {items.length}/{max}
        </span>
      </span>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((it, i) => (
          <div key={i} style={listItem}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <strong style={{ fontSize: 12.5, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {i + 1}. {itemTitle?.(it) || "Untitled"}
              </strong>
              <button type="button" style={tinyBtn} onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                <ArrowUp size={13} />
              </button>
              <button type="button" style={tinyBtn} onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label="Move down">
                <ArrowDown size={13} />
              </button>
              <button type="button" style={{ ...tinyBtn, color: "var(--tone-danger)" }} onClick={() => onChange(items.filter((_, n) => n !== i))} aria-label="Remove">
                <Trash2 size={13} />
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{children(it, (patch) => update(i, patch), i)}</div>
          </div>
        ))}
      </div>
      {items.length < max ? (
        <button type="button" style={{ ...smallBtn, alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 6 }} onClick={() => onChange([...items, newItem()])}>
          <Plus size={13} /> Add
        </button>
      ) : null}
    </div>
  );
}

export const Row = ({ children }) => <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>{children}</div>;

const field = { display: "flex", flexDirection: "column", gap: 6, minWidth: 0 };
const labelRow = { display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" };
const labelText = { fontSize: 12.5, fontWeight: 600, color: "var(--color-text)" };
const count = { fontSize: 11, fontVariantNumeric: "tabular-nums", color: "var(--color-text-muted)" };
const hintStyle = { fontSize: 12, color: "var(--color-text-muted)" };
export const input = {
  width: "100%",
  boxSizing: "border-box",
  font: "inherit",
  fontSize: 13.5,
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid var(--color-border)",
  background: "var(--color-bg)",
  color: "var(--color-text)",
};
const thumb = { width: 56, height: 56, borderRadius: 8, objectFit: "cover", border: "1px solid var(--color-border)", background: "var(--color-surface)", flexShrink: 0 };
export const smallBtn = {
  font: "inherit",
  fontSize: 12.5,
  fontWeight: 600,
  padding: "7px 11px",
  borderRadius: 8,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--color-border)",
  background: "var(--color-bg)",
  color: "var(--color-text)",
  cursor: "pointer",
  whiteSpace: "nowrap",
};
const tinyBtn = { ...smallBtn, padding: 5, display: "inline-flex" };
const iconBtn = { width: 32, height: 32, borderRadius: 8, borderWidth: 1, borderStyle: "solid", background: "var(--color-bg)", display: "grid", placeItems: "center", cursor: "pointer" };
const listItem = { padding: 12, borderRadius: 10, border: "1px solid var(--color-border)", background: "var(--color-surface)" };
