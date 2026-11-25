import { useEffect, useState } from "react";
import { DatePickerInput } from "@rasoipulse/ui";
import {
  BUSINESS_TYPES,
  CHECKLIST_FEATURES,
  EFFECT_IDS,
  FONT_FAMILIES,
  LOGO_STATES,
  MENU_SOURCES,
  ONBOARDING_PALETTES,
  ORDER_MODES,
  THEME_MODES,
  newOnboardingOutlet,
  onboardingOutletSlug,
  onboardingSubdomain,
  parseMapsPoint,
  planHasEffect,
  planHasFeature,
  slugifyName,
} from "@rasoipulse/config-schema";
import { MapPin, Trash2 } from "lucide-react";
import * as api from "../../../lib/api";
import { Button, Card, Checkbox, ColorInput, Field, Note, Select, TextInput } from "../../../ui";
import { Alert, area, FeatureRow, grid, Stepper, subtle } from "./parts";

/**
 * The sections of the onboarding form. Each takes the whole form (`data`), `P(path, value)` to change one answer, and `ctx`:
 *   allow    what the chosen plan allows (null until a plan is chosen)     base      the platform's store-address domain
 *   plans    the plans to choose from                                      forceFlag adds / takes away an extra for this client
 */

const timeBox = { width: 120 };

export function MeetingSection({ data, P }) {
  return (
    <Card title="2 · The meeting" subtitle="Who spoke to the client, and when.">
      <div style={grid}>
        <Field label="Representative"><TextInput value={data.meeting.repName} onChange={(e) => P("meeting.repName", e.target.value)} maxLength={80} /></Field>
        <Field label="Meeting date"><DatePickerInput value={data.meeting.date} onChange={(v) => P("meeting.date", typeof v === "string" ? v : "")} placeholder="Pick a date" /></Field>
        <Field label="Expected go-live"><DatePickerInput value={data.meeting.goLive} onChange={(v) => P("meeting.goLive", typeof v === "string" ? v : "")} placeholder="Pick a date" /></Field>
      </div>
      <Field label="Notes from the meeting" style={{ marginTop: 14 }}>
        <textarea value={data.meeting.notes} onChange={(e) => P("meeting.notes", e.target.value)} style={area} maxLength={2000} />
      </Field>
    </Card>
  );
}

export function PlanSection({ data, P, ctx }) {
  const { plans, allow } = ctx;
  const chosen = plans.find((p) => p.id === data.planId);
  return (
    <Card title="1 · Plan" subtitle="Choose this first — what the client can have in the rest of the form depends on it.">
      <div style={{ ...grid, alignItems: "end" }}>
        <Field label="Plan">
          <Select value={data.planId} onChange={(e) => P("planId", e.target.value)} aria-label="Plan">
            <option value="">Choose a plan…</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>{p.name}{p.custom && !/custom/i.test(p.name) ? " (custom)" : ""}</option>
            ))}
          </Select>
        </Field>
        {chosen?.custom ? (
          <>
            <Field label="Outlets for this client" info="A Custom plan has no limit of its own — set what was agreed.">
              <TextInput type="number" min={1} max={500} value={data.customLimits.maxOutlets} onChange={(e) => P("customLimits.maxOutlets", Math.max(1, Math.round(Number(e.target.value) || 1)))} />
            </Field>
            <Field label="People for this client" info="Everyone who can sign in to the store, the owner included.">
              <TextInput type="number" min={1} max={5000} value={data.customLimits.maxUsers} onChange={(e) => P("customLimits.maxUsers", Math.max(1, Math.round(Number(e.target.value) || 1)))} />
            </Field>
          </>
        ) : null}
      </div>
      {chosen ? (
        <p style={{ ...subtle, marginTop: 10 }} data-plan-summary>
          {chosen.description ? `${chosen.description} · ` : ""}
          {allow.custom ? "Custom plan: the client gets exactly the limits above and the features ticked below." : `Up to ${Number.isFinite(allow.maxOutlets) ? allow.maxOutlets : "unlimited"} outlet${allow.maxOutlets === 1 ? "" : "s"} and ${Number.isFinite(allow.maxUsers) ? allow.maxUsers : "unlimited"} ${allow.maxUsers === 1 ? "person" : "people"}.`}
        </p>
      ) : null}
    </Card>
  );
}

export function BusinessSection({ data, P }) {
  const b = data.business;
  const f = (key, label, extra = {}) => (
    <Field label={label} key={key}>
      <TextInput value={b[key]} onChange={(e) => P(`business.${key}`, e.target.value)} {...extra} />
    </Field>
  );
  return (
    <Card title="3 · The business and its owner">
      <div style={grid}>
        {f("storeName", "Store name", { maxLength: 80 })}
        {f("tagline", "Tagline", { maxLength: 120 })}
        <Field label="Type of business">
          <Select value={b.type} onChange={(e) => P("business.type", e.target.value)}>
            <option value="">Choose…</option>
            {BUSINESS_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        </Field>
        {f("ownerName", "Owner's name", { maxLength: 80 })}
        {f("ownerPhone", "Owner's phone", { inputMode: "tel", maxLength: 30 })}
        {f("ownerEmail", "Owner's email (their sign-in)", { type: "email", maxLength: 120 })}
        {f("whatsapp", "WhatsApp number", { inputMode: "tel", maxLength: 30 })}
        {f("city", "City", { maxLength: 60 })}
        {f("gstin", "GSTIN", { maxLength: 20 })}
        {f("fssai", "FSSAI licence number", { maxLength: 20 })}
      </div>
    </Card>
  );
}

export function FeaturesSection({ data, P, ctx }) {
  const { allow, forceFlag, pricing } = ctx;
  const toggle = (key, on) => P("features", on ? [...new Set([...data.features, key])] : data.features.filter((k) => k !== key));
  return (
    <Card title="4 · Features" subtitle="Tick what the client wants. A lock means the plan doesn't have it — you can still add it for this client.">
      <div data-feature-list style={{ borderTop: "1px solid var(--color-border)" }}>
        {CHECKLIST_FEATURES.map((f) => {
          const outside = Boolean(allow) && !planHasFeature(allow, f.key);
          const id = `feature:${f.key}`;
          return (
            <FeatureRow
              key={f.key}
              label={f.label}
              info={f.description}
              checked={data.features.includes(f.key)}
              onChange={(on) => (outside && !on ? forceFlag(id, false) : toggle(f.key, on))}
              outside={outside}
              planName={allow?.name}
              added={data.forced.includes(id)}
              onAdd={(on) => {
                forceFlag(id, on);
                if (on) toggle(f.key, true);
              }}
              price={pricing?.features?.[f.key]}
            />
          );
        })}
      </div>
      <p style={{ ...subtle, marginTop: 12 }}>Takeaway, dine-in and delivery are chosen for each outlet below.</p>
    </Card>
  );
}

/* ----------------------------------------------------------------------------------------------------- outlets */

function MapLocation({ outlet, patch, disabled }) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const set = async () => {
    const link = outlet.mapsLink.trim();
    setProblem("");
    if (!link) {
      patch({ point: null });
      return;
    }
    const direct = parseMapsPoint(link);
    if (direct) {
      patch({ point: direct });
      return;
    }
    setBusy(true);
    try {
      const r = await api.resolveMapLink(link);
      patch({ point: r.point });
    } catch (e) {
      patch({ point: null });
      setProblem(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div data-map-location>
      <Field label="Google Maps link or coordinates" info="Paste the share link from Google Maps (long or short) or type latitude and longitude like 28.6139, 77.2090. Delivery distance is measured from this pin.">
        <span style={{ display: "flex", gap: 8 }}>
          <TextInput
            value={outlet.mapsLink}
            onChange={(e) => patch({ mapsLink: e.target.value, point: null })}
            onBlur={() => void (outlet.mapsLink.trim() && !outlet.point ? set() : null)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void set();
              }
            }}
            placeholder="https://maps.app.goo.gl/…  or  28.6139, 77.2090"
            maxLength={600}
            style={{ flex: 1, minWidth: 0 }}
            aria-label="Google Maps link or coordinates"
          />
          <Button type="button" variant="outline" onClick={() => void set()} disabled={disabled || busy || !outlet.mapsLink.trim()}>{busy ? "Finding…" : "Find on map"}</Button>
        </span>
      </Field>
      {outlet.point ? (
        <p data-point style={{ margin: "6px 0 0", fontSize: 12.5, display: "flex", gap: 6, alignItems: "center", color: "var(--tone-success)" }}>
          <MapPin size={13} /> Pin set: {outlet.point.lat}, {outlet.point.lng} ·{" "}
          <a href={`https://www.google.com/maps?q=${outlet.point.lat},${outlet.point.lng}`} target="_blank" rel="noreferrer" style={{ color: "inherit" }}>open in Maps</a>
        </p>
      ) : problem ? (
        <Alert>{problem}</Alert>
      ) : (
        <p style={{ ...subtle, marginTop: 6 }}>No pin yet.</p>
      )}
    </div>
  );
}

function OutletCard({ index, outlet: o, P, ctx, canRemove, disabled }) {
  const { allow, forceFlag, data } = ctx;
  const patch = (changes) => P("outlets", data.outlets.map((x) => (x.id === o.id ? { ...x, ...changes } : x)));
  const slug = onboardingOutletSlug(o);
  return (
    <div data-outlet-card={o.id} style={{ border: "1px solid var(--color-border)", borderRadius: 12, padding: 16, marginTop: 14, background: "var(--color-bg)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <strong style={{ fontSize: 14.5 }}>Outlet {index + 1}{o.name ? ` — ${o.name}` : ""}</strong>
        {canRemove ? (
          <Button type="button" variant="outline" disabled={disabled} onClick={() => P("outlets", data.outlets.filter((x) => x.id !== o.id))} style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 12.5, padding: "5px 10px" }} aria-label={`Remove outlet ${index + 1}`}>
            <Trash2 size={13} /> Remove
          </Button>
        ) : null}
      </div>
      <div style={grid}>
        <Field label="Outlet name" info="Its location, like “Laxmi Nagar” or “Mall Road”.">
          <TextInput value={o.name} onChange={(e) => patch({ name: e.target.value })} maxLength={80} aria-label={`Outlet ${index + 1} name`} />
        </Field>
        <Field label="Web address" info={`Becomes part of the outlet's address: …/${slug || "laxmi-nagar"}`} hint={slug ? `/${slug}` : undefined}>
          <TextInput value={o.slug} onChange={(e) => patch({ slug: slugifyName(e.target.value) })} placeholder={slugifyName(o.name)} maxLength={63} aria-label={`Outlet ${index + 1} web address`} />
        </Field>
        <Field label="Outlet phone"><TextInput value={o.phone} onChange={(e) => patch({ phone: e.target.value })} inputMode="tel" maxLength={30} aria-label={`Outlet ${index + 1} phone`} /></Field>
      </div>
      <Field label="Address" style={{ marginTop: 12 }}>
        <textarea value={o.address} onChange={(e) => patch({ address: e.target.value })} style={{ ...area, minHeight: 56 }} maxLength={300} aria-label={`Outlet ${index + 1} address`} />
      </Field>
      <div style={{ marginTop: 12 }}><MapLocation outlet={o} patch={patch} disabled={disabled} /></div>

      <p style={{ margin: "16px 0 4px", fontWeight: 600, fontSize: 13 }}>How customers can order here</p>
      <div data-mode-list style={{ borderTop: "1px solid var(--color-border)" }}>
        {ORDER_MODES.map((m) => {
          const outside = Boolean(allow) && !planHasFeature(allow, m.feature);
          const id = `feature:${m.feature}`;
          return (
            <div key={m.key} data-mode={m.key}>
              <FeatureRow
                label={m.label}
                info={m.help}
                checked={o.modes[m.key]}
                onChange={(on) => patch({ modes: { ...o.modes, [m.key]: on } })}
                outside={outside}
                planName={allow?.name}
                added={data.forced.includes(id)}
                onAdd={(on) => {
                  forceFlag(id, on);
                  if (on) patch({ modes: { ...o.modes, [m.key]: true } });
                }}
                price={ctx.pricing?.features?.[m.feature]}
                disabled={disabled}
              />
            </div>
          );
        })}
      </div>

      {o.modes.delivery ? (
        <div data-delivery-block style={{ marginTop: 14 }}>
          <p style={{ margin: "0 0 8px", fontWeight: 600, fontSize: 13 }}>Delivery</p>
          <div style={grid}>
            <Field label="Delivers within (km)" info="How far from the outlet it will deliver (in a straight line).">
              <TextInput type="number" min={0} max={50} step="0.5" value={o.delivery.radiusKm} onChange={(e) => patch({ delivery: { ...o.delivery, radiusKm: Number(e.target.value) || 0 } })} aria-label={`Outlet ${index + 1} delivery distance`} />
            </Field>
            <Field label="Delivery fee (₹)"><TextInput type="number" min={0} value={o.delivery.fee} onChange={(e) => patch({ delivery: { ...o.delivery, fee: Math.max(0, Number(e.target.value) || 0) } })} aria-label={`Outlet ${index + 1} delivery fee`} /></Field>
            <Field label="Free delivery above (₹)" hint="0 = never free"><TextInput type="number" min={0} value={o.delivery.freeAbove} onChange={(e) => patch({ delivery: { ...o.delivery, freeAbove: Math.max(0, Number(e.target.value) || 0) } })} /></Field>
            <Field label="Minimum order (₹)"><TextInput type="number" min={0} value={o.delivery.minOrder} onChange={(e) => patch({ delivery: { ...o.delivery, minOrder: Math.max(0, Number(e.target.value) || 0) } })} /></Field>
          </div>
          {!o.point ? <Alert>Delivery needs the outlet's map location — paste a Google Maps link or coordinates above.</Alert> : null}
        </div>
      ) : null}

      <p style={{ margin: "16px 0 8px", fontWeight: 600, fontSize: 13 }}>Opening hours</p>
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center" }}>
        <label style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 13.5 }}>
          <input type="radio" name={`hours-${o.id}`} checked={o.hours.useCommon} onChange={() => patch({ hours: { ...o.hours, useCommon: true } })} disabled={disabled} style={{ accentColor: "var(--color-primary)" }} />
          Same as the common hours ({data.common.hours.opensAt} – {data.common.hours.closesAt})
        </label>
        <label style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 13.5 }}>
          <input type="radio" name={`hours-${o.id}`} checked={!o.hours.useCommon} onChange={() => patch({ hours: { ...o.hours, useCommon: false } })} disabled={disabled} style={{ accentColor: "var(--color-primary)" }} />
          This outlet's own hours
        </label>
      </div>
      {!o.hours.useCommon ? (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 10 }}>
          <Field label="Opens"><TextInput type="time" value={o.hours.opensAt} onChange={(e) => patch({ hours: { ...o.hours, opensAt: e.target.value } })} style={timeBox} aria-label={`Outlet ${index + 1} opens at`} /></Field>
          <Field label="Closes"><TextInput type="time" value={o.hours.closesAt} onChange={(e) => patch({ hours: { ...o.hours, closesAt: e.target.value } })} style={timeBox} aria-label={`Outlet ${index + 1} closes at`} /></Field>
          <Field label="Last order (min before closing)"><TextInput type="number" min={0} max={180} value={o.hours.lastOrderBufferMinutes} onChange={(e) => patch({ hours: { ...o.hours, lastOrderBufferMinutes: Math.max(0, Math.min(180, Math.round(Number(e.target.value) || 0))) } })} style={{ width: 110 }} /></Field>
        </div>
      ) : null}
    </div>
  );
}

export function OutletsSection({ data, P, ctx, disabled }) {
  const { allow, forceFlag } = ctx;
  const count = data.outlets.length;
  const setCount = (n) => {
    const target = Math.max(1, Math.min(100, Math.round(n) || 1));
    if (target > count) P("outlets", [...data.outlets, ...Array.from({ length: target - count }, () => newOnboardingOutlet())]);
    else if (target < count) P("outlets", data.outlets.slice(0, target));
  };
  const over = Boolean(allow) && !allow.custom && count > allow.maxOutlets;
  return (
    <Card title="5 · Outlets" subtitle="Every location the client runs — address, map pin, how customers order, delivery distance and opening hours.">
      <Field label="Total outlets" style={{ marginBottom: 0 }}>
        <Stepper value={count} onChange={setCount} min={1} max={100} label="outlet" plural="outlets" disabled={disabled} />
      </Field>
      {over ? (
        <div data-extra-outlets style={{ marginTop: 10 }}>
          <Alert tone={data.forced.includes("outlets") ? "warn" : "error"}>
            {data.forced.includes("outlets")
              ? `Added for this client: the ${allow.name} plan allows ${allow.maxOutlets} outlet${allow.maxOutlets === 1 ? "" : "s"}; ${count} will be created.`
              : `The ${allow.name} plan allows ${allow.maxOutlets} outlet${allow.maxOutlets === 1 ? "" : "s"} and this form has ${count}. Remove outlets, choose another plan, or add the extra ones for this client.`}
          </Alert>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, marginTop: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={data.forced.includes("outlets")} onChange={(e) => forceFlag("outlets", e.target.checked)} disabled={disabled} aria-label="Add extra outlets for this client" style={{ width: 16, height: 16, accentColor: "var(--color-primary)", margin: 0 }} />
            Add the extra outlets for this client{ctx.pricing?.extraOutlet ? <span style={{ color: "var(--color-text-muted)" }}> · +₹{ctx.pricing.extraOutlet} a month each</span> : null}
          </label>
        </div>
      ) : null}
      {data.outlets.map((o, i) => (
        <OutletCard key={o.id} index={i} outlet={o} P={P} ctx={{ ...ctx, data }} canRemove={count > 1} disabled={disabled} />
      ))}
    </Card>
  );
}

/* ------------------------------------------------------------------------------------------ common, look, address */

export function CommonSection({ data, P, ctx }) {
  const { allow, forceFlag } = ctx;
  const c = data.common;
  return (
    <Card title="6 · Settings every outlet shares" subtitle="Used by outlets that follow the common hours, and by every outlet for the rest.">
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <Field label="Common opening time"><TextInput type="time" value={c.hours.opensAt} onChange={(e) => P("common.hours.opensAt", e.target.value)} style={timeBox} aria-label="Common opening time" /></Field>
        <Field label="Common closing time"><TextInput type="time" value={c.hours.closesAt} onChange={(e) => P("common.hours.closesAt", e.target.value)} style={timeBox} aria-label="Common closing time" /></Field>
        <Field label="Last order (min before closing)"><TextInput type="number" min={0} max={180} value={c.hours.lastOrderBufferMinutes} onChange={(e) => P("common.hours.lastOrderBufferMinutes", Math.max(0, Math.min(180, Math.round(Number(e.target.value) || 0))))} style={{ width: 120 }} /></Field>
        <Field label="Food ready in (minutes)"><TextInput type="number" min={1} max={180} value={c.prepMinutes} onChange={(e) => P("common.prepMinutes", Math.max(1, Math.min(180, Math.round(Number(e.target.value) || 1))))} style={{ width: 120 }} /></Field>
      </div>
      <p style={{ margin: "16px 0 4px", fontWeight: 600, fontSize: 13 }}>Payments the client wants</p>
      <div style={{ borderTop: "1px solid var(--color-border)" }}>
        <FeatureRow label="Cash at the counter" checked={c.payments.cash} onChange={(on) => P("common.payments.cash", on)} />
        <FeatureRow
          label="Online payments"
          info="Customers pay by UPI, card or wallet. The client adds their Razorpay keys later in Settings."
          checked={c.payments.online}
          onChange={(on) => P("common.payments.online", on)}
          outside={Boolean(allow) && !planHasFeature(allow, "onlinePayments")}
          planName={allow?.name}
          added={data.forced.includes("feature:onlinePayments")}
          onAdd={(on) => {
            forceFlag("feature:onlinePayments", on);
            if (on) P("common.payments.online", true);
          }}
          price={ctx.pricing?.features?.onlinePayments}
        />
      </div>
      <p style={{ margin: "16px 0 8px", fontWeight: 600, fontSize: 13 }}>GST</p>
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "flex-end" }}>
        <Checkbox label="Menu prices already include GST" checked={c.tax.pricesIncludeTax} onChange={(on) => P("common.tax.pricesIncludeTax", on)} />
        <Field label="Default GST rate (%)"><TextInput type="number" min={0} max={40} step="0.5" value={c.tax.gstRatePct} onChange={(e) => P("common.tax.gstRatePct", Math.max(0, Math.min(40, Number(e.target.value) || 0)))} style={{ width: 110 }} /></Field>
        <Field label="Service charge (%)"><TextInput type="number" min={0} max={25} step="0.5" value={c.tax.serviceChargePct} onChange={(e) => P("common.tax.serviceChargePct", Math.max(0, Math.min(25, Number(e.target.value) || 0)))} style={{ width: 110 }} /></Field>
      </div>
    </Card>
  );
}

const EFFECT_LABEL = { none: "Plain (no special effect)", glass: "Glass", neumorph: "Soft 3D", clay: "Clay", aurora: "Aurora", cyberpunk: "Cyberpunk", "dark-premium": "Dark premium" };

export function LookSection({ data, P, ctx }) {
  const { allow, forceFlag } = ctx;
  const l = data.look;
  const apply = (p) => {
    P("look", { ...l, paletteId: p.id, primary: p.primary, background: p.background, surface: p.surface, text: p.text });
  };
  const effectOutside = Boolean(allow) && !planHasEffect(allow, l.effect);
  const dark = l.background.toLowerCase() < "#808080";
  return (
    <Card title="7 · Look and feel" subtitle="The store's colours and style. These are shared by every outlet and can be changed later in the store's own settings.">
      <p style={{ margin: "0 0 8px", fontWeight: 600, fontSize: 13 }}>Colour scheme</p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }} role="radiogroup" aria-label="Colour scheme">
        {ONBOARDING_PALETTES.map((p) => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={l.paletteId === p.id}
            aria-label={`${p.name} colour scheme`}
            onClick={() => apply(p)}
            style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "center", padding: 8, borderRadius: 10, cursor: "pointer", font: "inherit", fontSize: 12, background: "var(--color-bg)", color: "var(--color-text)", border: l.paletteId === p.id ? "2px solid var(--color-primary)" : "1px solid var(--color-border)" }}
          >
            <span style={{ display: "flex", borderRadius: 6, overflow: "hidden", border: "1px solid var(--color-border)" }}>
              {[p.primary, p.background, p.surface, p.text].map((c) => <span key={c} style={{ width: 20, height: 28, background: c }} />)}
            </span>
            {p.name}
          </button>
        ))}
      </div>
      <div style={{ ...grid, marginTop: 14 }}>
        <Field label="Brand colour" info="The main colour of buttons and highlights."><ColorInput value={l.primary} onChange={(v) => P("look", { ...l, primary: v, paletteId: "custom" })} /></Field>
        <Field label="Page background"><ColorInput value={l.background} onChange={(v) => P("look", { ...l, background: v, paletteId: "custom" })} /></Field>
        <Field label="Cards and panels"><ColorInput value={l.surface} onChange={(v) => P("look", { ...l, surface: v, paletteId: "custom" })} /></Field>
        <Field label="Text"><ColorInput value={l.text} onChange={(v) => P("look", { ...l, text: v, paletteId: "custom" })} /></Field>
      </div>
      <div data-look-preview style={{ marginTop: 14, padding: 16, borderRadius: 12, background: l.background, color: l.text, border: "1px solid var(--color-border)", display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ background: l.surface, padding: "10px 14px", borderRadius: 10, minWidth: 190 }}>
          <div style={{ fontWeight: 700, fontFamily: FONT_FAMILIES.find((f) => f.id === l.font)?.stack }}>{data.business.storeName || "Your store"}</div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>Steamed momos · ₹120</div>
        </div>
        <span style={{ background: l.primary, color: dark || l.primary.toLowerCase() < "#808080" ? "#fff" : "#1a1a1a", padding: "8px 16px", borderRadius: 999, fontWeight: 600, fontSize: 13 }}>Add to cart</span>
      </div>
      <div style={{ ...grid, marginTop: 14 }}>
        <Field label="Light or dark">
          <Select value={l.mode} onChange={(e) => P("look.mode", e.target.value)} aria-label="Light or dark">
            {THEME_MODES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </Select>
        </Field>
        <Field label="Style">
          <Select value={l.effect} onChange={(e) => P("look.effect", e.target.value)} aria-label="Style">
            {EFFECT_IDS.map((id) => <option key={id} value={id}>{EFFECT_LABEL[id] ?? id}{allow && !planHasEffect(allow, id) ? " — not in plan" : ""}</option>)}
          </Select>
          {effectOutside ? (
            <span data-style-gate style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8, fontSize: 12.5 }}>
              <span style={{ color: data.forced.includes(`effect:${l.effect}`) ? "var(--tone-warning)" : "var(--tone-danger)" }}>{data.forced.includes(`effect:${l.effect}`) ? `Added for this client — not in the ${allow.name} plan` : `Not in the ${allow.name} plan`}</span>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 7, cursor: "pointer" }}>
                <input type="checkbox" checked={data.forced.includes(`effect:${l.effect}`)} onChange={(e) => forceFlag(`effect:${l.effect}`, e.target.checked)} aria-label={`Add ${EFFECT_LABEL[l.effect] ?? l.effect} style for this client`} style={{ width: 16, height: 16, accentColor: "var(--color-primary)", margin: 0 }} />
                Add this style for this client
              </label>
            </span>
          ) : null}
        </Field>
        <Field label="Font">
          <Select value={l.font} onChange={(e) => P("look.font", e.target.value)} aria-label="Font">
            {FONT_FAMILIES.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </Select>
        </Field>
        <Field label="Logo">
          <Select value={l.logo} onChange={(e) => P("look.logo", e.target.value)} aria-label="Logo">
            {LOGO_STATES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </Select>
        </Field>
      </div>
      {l.logo === "link" ? (
        <Field label="Link to the logo" style={{ marginTop: 12 }}><TextInput value={l.logoLink} onChange={(e) => P("look.logoLink", e.target.value)} maxLength={600} /></Field>
      ) : null}
      <Field label="Websites or pages whose look they like" style={{ marginTop: 12 }}>
        <textarea value={l.references} onChange={(e) => P("look.references", e.target.value)} style={{ ...area, minHeight: 56 }} maxLength={600} />
      </Field>
    </Card>
  );
}

export function AddressSection({ data, P, ctx }) {
  const { allow, base, forceFlag } = ctx;
  const label = onboardingSubdomain(data);
  const [state, setState] = useState(null);
  useEffect(() => {
    if (!label || !base) {
      setState(null);
      return undefined;
    }
    let live = true;
    const t = setTimeout(() => {
      api.checkSubdomain(label, "").then((r) => live && setState(r)).catch(() => live && setState(null));
    }, 350);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [label, base]);
  const ownOutside = Boolean(allow) && !planHasFeature(allow, "customDomain");
  return (
    <Card title="8 · The store's address" subtitle="Where customers open the store.">
      <div style={grid}>
        <Field label="Rasoi Pulse address" info="Free, instant, nothing to set up on the server.">
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <TextInput value={data.address.subdomain} onChange={(e) => P("address.subdomain", slugifyName(e.target.value))} placeholder={slugifyName(data.business.storeName)} maxLength={40} style={{ flex: 1, minWidth: 0 }} aria-label="Rasoi Pulse address" />
            {base ? <span style={{ ...subtle, whiteSpace: "nowrap" }}>.{base}</span> : null}
          </span>
          {base && label ? (
            <span data-address-check style={{ fontSize: 12.5, color: state?.available ? "var(--tone-success)" : state ? "var(--tone-danger)" : "var(--color-text-muted)" }}>
              {state ? (state.available ? `${state.host} is free` : state.reason) : "Checking…"}
            </span>
          ) : !base ? (
            <span style={{ fontSize: 12.5, color: "var(--tone-warning)" }}>This server has no base domain set up for store addresses.</span>
          ) : null}
        </Field>
        <div>
          <Field label="Own domain (optional)" info="The restaurant's own web address, like pizzaplace.com. Needs the “Own domain name” feature and DNS set up later." style={{ marginBottom: 6 }}>
            <TextInput value={data.address.ownDomain} onChange={(e) => P("address.ownDomain", e.target.value)} placeholder="pizzaplace.com" maxLength={200} aria-label="Own domain" disabled={ownOutside && !data.forced.includes("feature:customDomain")} />
          </Field>
          {ownOutside ? (
            <span data-domain-gate style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5 }}>
              <span style={{ color: data.forced.includes("feature:customDomain") ? "var(--tone-warning)" : "var(--tone-danger)" }}>{data.forced.includes("feature:customDomain") ? `Added for this client — not in the ${allow.name} plan` : `Not in the ${allow.name} plan`}</span>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 7, cursor: "pointer" }}>
                <input type="checkbox" checked={data.forced.includes("feature:customDomain")} onChange={(e) => { forceFlag("feature:customDomain", e.target.checked); if (!e.target.checked) P("address.ownDomain", ""); }} aria-label="Add own domain for this client" style={{ width: 16, height: 16, accentColor: "var(--color-primary)", margin: 0 }} />
                Add an own domain for this client{ctx.pricing?.features?.customDomain ? <span style={{ color: "var(--color-text-muted)" }}> · +₹{ctx.pricing.features.customDomain} a month</span> : null}
              </label>
            </span>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

export function SetupSection({ data, P }) {
  const s = data.setup;
  return (
    <Card title="9 · Setting up" subtitle="What the client will need help with.">
      <div style={grid}>
        <Field label="The menu will come from">
          <Select value={s.menuSource} onChange={(e) => P("setup.menuSource", e.target.value)}>
            <option value="">Choose…</option>
            {MENU_SOURCES.map((m) => <option key={m} value={m}>{m}</option>)}
          </Select>
        </Field>
        <Field label="About how many menu items"><TextInput value={s.itemCount} onChange={(e) => P("setup.itemCount", e.target.value)} maxLength={20} /></Field>
        <Field label="Kitchen printers"><TextInput value={s.printers} onChange={(e) => P("setup.printers", e.target.value)} placeholder="e.g. 1 per outlet" maxLength={120} /></Field>
        <Field label="Team members besides the owner" info="Counted against the plan's people limit.">
          <TextInput type="number" min={0} max={500} value={s.teamCount} onChange={(e) => P("setup.teamCount", Math.max(0, Math.round(Number(e.target.value) || 0)))} aria-label="Team members besides the owner" />
        </Field>
      </div>
      <Field label="Anything else to know" style={{ marginTop: 14 }}>
        <textarea value={s.notes} onChange={(e) => P("setup.notes", e.target.value)} style={area} maxLength={2000} />
      </Field>
      <Note>Payment-gateway keys, WhatsApp and SMS credentials are entered by the owner later, in the store's own Settings — they are not part of this form.</Note>
    </Card>
  );
}
