import { useState } from "react";
import { CUSTOMER_GENDER_LABELS, CUSTOMER_GENDERS, MARKETING_ORDER_TYPE_LABELS, MARKETING_ORDER_TYPES, TIME_UNITS } from "@rasoipulse/config-schema";
import { Plus, X } from "lucide-react";
import { Checkbox, Field, Select, TextInput } from "../../ui";

/**
 * The filters that narrow "my customers" down. Every filter is its own row with its own switch; only the switched-on
 * ones count, and ALL of them must match. `emptyFilters()` is the screen's state, `toFilters()` turns it into what
 * the server expects (dropping any filter that isn't filled in yet).
 */
export const emptyFilters = () => ({
  outletIds: [],
  lastOrder: { on: false, value: 30, unit: "days", never: false },
  items: { on: false, names: [], match: "any", min: 1 },
  age: { on: false, mode: "exact", exact: "", min: "", max: "" },
  gender: { on: false, values: [] },
  type: { on: false, channel: "takeaway", min: 3 },
  area: { on: false, text: "", nearOn: false, outletId: "", km: 3 },
  window: { on: false, value: 3, unit: "months" },
});

const int = (v) => (v === "" || v == null || Number.isNaN(Number(v)) ? null : Math.round(Number(v)));

export function toFilters(s, outlets = []) {
  const f = { outletIds: s.outletIds, gender: [] };
  if (s.lastOrder.on && int(s.lastOrder.value) >= 1) f.lastOrder = { olderThan: { value: int(s.lastOrder.value), unit: s.lastOrder.unit }, includeNeverOrdered: s.lastOrder.never };
  if (s.items.on && s.items.names.length) f.items = { names: s.items.names, match: s.items.match, minQuantity: Math.max(1, int(s.items.min) ?? 1) };
  if (s.age.on) {
    const a = s.age.mode === "exact" ? { exact: int(s.age.exact), min: null, max: null } : { exact: null, min: int(s.age.min), max: int(s.age.max) };
    if (a.exact != null || a.min != null || a.max != null) f.age = a;
  }
  if (s.gender.on && s.gender.values.length) f.gender = s.gender.values;
  if (s.type.on) f.orderType = { channel: s.type.channel, minOrders: Math.max(1, int(s.type.min) ?? 1) };
  if (s.area.on) {
    const point = s.area.nearOn ? outlets.find((o) => o.id === s.area.outletId)?.location : null;
    const near = point ? { lat: point.lat, lng: point.lng, km: Math.max(0.1, Number(s.area.km) || 3) } : null;
    if (s.area.text.trim() || near) f.area = { text: s.area.text.trim(), near };
  }
  if (s.window.on && int(s.window.value) >= 1 && (f.items || f.orderType)) f.window = { value: int(s.window.value), unit: s.window.unit };
  return f;
}

/** how many filters are switched on (for the heading) */
export const filtersOn = (s) => ["lastOrder", "items", "age", "gender", "type", "area"].filter((k) => s[k].on).length;

export function FilterBuilder({ value, onChange, options }) {
  const outlets = options?.outlets ?? [];
  const set = (key, patch) => onChange({ ...value, [key]: { ...value[key], ...patch } });
  const [search, setSearch] = useState("");
  const matches = (options?.items ?? []).filter((n) => !value.items.names.includes(n) && n.toLowerCase().includes(search.trim().toLowerCase())).slice(0, 8);
  const toggleOutlet = (id) => onChange({ ...value, outletIds: value.outletIds.includes(id) ? value.outletIds.filter((x) => x !== id) : [...value.outletIds, id] });
  const needsWindow = value.items.on || value.type.on;

  return (
    <div style={panel} aria-label="Customer filters">
      {outlets.length > 1 ? (
        <div style={row}>
          <div style={rowHead}>Outlets to look at</div>
          <div style={rowBody}>
            <Checkbox label="Whole store (every outlet)" checked={value.outletIds.length === 0} onChange={() => onChange({ ...value, outletIds: [] })} />
            {outlets.map((o) => (
              <Checkbox key={o.id} label={o.title} checked={value.outletIds.includes(o.id)} onChange={() => toggleOutlet(o.id)} />
            ))}
            <span style={hint}>Applies to the visit, item and order-type filters.</span>
          </div>
        </div>
      ) : null}

      <FilterRow label="Hasn't ordered for" on={value.lastOrder.on} onToggle={(on) => set("lastOrder", { on })}>
        <div style={inline}>
          <Field label="For more than"><TextInput type="number" min={1} value={value.lastOrder.value} onChange={(e) => set("lastOrder", { value: e.target.value })} style={{ width: 90 }} /></Field>
          <Field label="Unit">
            <Select value={value.lastOrder.unit} onChange={(e) => set("lastOrder", { unit: e.target.value })}>
              {TIME_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </Select>
          </Field>
        </div>
        <Checkbox label="Also include people who signed up but never ordered" checked={value.lastOrder.never} onChange={(v) => set("lastOrder", { never: v })} />
      </FilterRow>

      <FilterRow label="Ordered these items" on={value.items.on} onToggle={(on) => set("items", { on })}>
        <div style={chips}>
          {value.items.names.map((n) => (
            <span key={n} style={chip}>
              {n}
              <button type="button" aria-label={`Remove ${n}`} style={chipX} onClick={() => set("items", { names: value.items.names.filter((x) => x !== n) })}><X size={12} /></button>
            </span>
          ))}
        </div>
        <Field label="Search menu items"><TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="e.g. paneer" /></Field>
        {search.trim() || !value.items.names.length ? (
          <div style={chips}>
            {matches.map((n) => (
              <button key={n} type="button" style={suggest} onClick={() => { set("items", { names: [...value.items.names, n] }); setSearch(""); }}><Plus size={12} /> {n}</button>
            ))}
            {!matches.length ? <span style={hint}>{options?.items?.length ? "No other item matches." : "No menu items yet."}</span> : null}
          </div>
        ) : null}
        <div style={inline}>
          <Field label="Must have ordered">
            <Select value={value.items.match} onChange={(e) => set("items", { match: e.target.value })}>
              <option value="any">Any of these items</option>
              <option value="all">All of these items</option>
            </Select>
          </Field>
          <Field label="At least (quantity)"><TextInput type="number" min={1} value={value.items.min} onChange={(e) => set("items", { min: e.target.value })} style={{ width: 90 }} /></Field>
        </div>
        <span style={hint}>{value.items.match === "all" ? "Each chosen item must have been ordered at least this many times." : "Counts the chosen items together."}</span>
      </FilterRow>

      <FilterRow label="Age" on={value.age.on} onToggle={(on) => set("age", { on })}>
        <div style={inline}>
          <Field label="Match">
            <Select value={value.age.mode} onChange={(e) => set("age", { mode: e.target.value })}>
              <option value="exact">A specific age</option>
              <option value="range">An age range</option>
            </Select>
          </Field>
          {value.age.mode === "exact" ? (
            <Field label="Age today"><TextInput type="number" min={1} max={120} value={value.age.exact} onChange={(e) => set("age", { exact: e.target.value })} style={{ width: 90 }} /></Field>
          ) : (
            <>
              <Field label="From age"><TextInput type="number" min={1} max={120} value={value.age.min} onChange={(e) => set("age", { min: e.target.value })} style={{ width: 90 }} /></Field>
              <Field label="To age"><TextInput type="number" min={1} max={120} value={value.age.max} onChange={(e) => set("age", { max: e.target.value })} style={{ width: 90 }} /></Field>
            </>
          )}
        </div>
        <span style={hint}>Ages are worked out as of today: someone who was 24 when they signed up in 2020 is counted as 30 in 2026.</span>
      </FilterRow>

      <FilterRow label="Gender" on={value.gender.on} onToggle={(on) => set("gender", { on })}>
        <div style={inline}>
          {CUSTOMER_GENDERS.map((g) => (
            <Checkbox key={g} label={CUSTOMER_GENDER_LABELS[g]} checked={value.gender.values.includes(g)} onChange={(v) => set("gender", { values: v ? [...value.gender.values, g] : value.gender.values.filter((x) => x !== g) })} />
          ))}
        </div>
      </FilterRow>

      <FilterRow label="Orders a lot of one type" on={value.type.on} onToggle={(on) => set("type", { on })}>
        <div style={inline}>
          <Field label="Order type">
            <Select value={value.type.channel} onChange={(e) => set("type", { channel: e.target.value })}>
              {MARKETING_ORDER_TYPES.map((t) => <option key={t} value={t}>{MARKETING_ORDER_TYPE_LABELS[t]}</option>)}
            </Select>
          </Field>
          <Field label="At least (orders)"><TextInput type="number" min={1} value={value.type.min} onChange={(e) => set("type", { min: e.target.value })} style={{ width: 90 }} /></Field>
        </div>
      </FilterRow>

      <FilterRow label="Lives in an area" on={value.area.on} onToggle={(on) => set("area", { on })}>
        <Field label="Delivery address contains" hint="Looked up from the addresses they had food delivered to — e.g. Laxmi Nagar">
          <TextInput value={value.area.text} onChange={(e) => set("area", { text: e.target.value })} placeholder="Area, street or pin code" />
        </Field>
        <Checkbox label="Also only people within a distance of an outlet" checked={value.area.nearOn} onChange={(v) => set("area", { nearOn: v, outletId: value.area.outletId || outlets.find((o) => o.location)?.id || "" })} />
        {value.area.nearOn ? (
          <div style={inline}>
            <Field label="Within (km)"><TextInput type="number" min={0.1} step={0.5} value={value.area.km} onChange={(e) => set("area", { km: e.target.value })} style={{ width: 90 }} /></Field>
            <Field label="Of this outlet">
              <Select value={value.area.outletId} onChange={(e) => set("area", { outletId: e.target.value })}>
                {outlets.filter((o) => o.location).map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
              </Select>
            </Field>
          </div>
        ) : null}
      </FilterRow>

      {needsWindow ? (
        <FilterRow label="Only count recent orders" on={value.window.on} onToggle={(on) => set("window", { on })}>
          <div style={inline}>
            <Field label="From the last"><TextInput type="number" min={1} value={value.window.value} onChange={(e) => set("window", { value: e.target.value })} style={{ width: 90 }} /></Field>
            <Field label="Window unit">
              <Select value={value.window.unit} onChange={(e) => set("window", { unit: e.target.value })}>
                {TIME_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </Select>
            </Field>
          </div>
          <span style={hint}>For the items and order-type filters. Off = orders from any time.</span>
        </FilterRow>
      ) : null}
    </div>
  );
}

function FilterRow({ label, on, onToggle, children }) {
  return (
    <div style={row}>
      <div style={rowHead}><Checkbox label={label} checked={on} onChange={onToggle} /></div>
      {on ? <div style={rowBody}>{children}</div> : null}
    </div>
  );
}

const panel = { display: "flex", flexDirection: "column", border: "1px solid var(--color-border)", borderRadius: 12, background: "var(--color-bg)", overflow: "hidden" };
const row = { padding: "12px 14px", borderBottom: "1px solid var(--color-border)" };
const rowHead = { fontSize: 14, fontWeight: 600 };
const rowBody = { display: "flex", flexDirection: "column", gap: 10, marginTop: 10, paddingLeft: 24 };
const inline = { display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end" };
const hint = { fontSize: 12.5, color: "var(--color-text-muted)" };
const chips = { display: "flex", gap: 6, flexWrap: "wrap" };
const chip = { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, padding: "4px 6px 4px 11px", borderRadius: 999, background: "var(--color-surface)", border: "1px solid var(--color-border)" };
const chipX = { border: 0, background: "transparent", cursor: "pointer", color: "inherit", display: "grid", placeItems: "center", padding: 2 };
const suggest = { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13, padding: "4px 11px", borderRadius: 999, border: "1px dashed var(--color-border)", background: "transparent", color: "inherit", cursor: "pointer" };
