import { useMemo, useState } from "react";
                                           
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  couponSummary,
  DISCOUNT_TYPE_LABELS,
  formatINR,
  ORDER_CHANNELS,
              
                   
                    
} from "@rasoipulse/config-schema";
import { DatePickerInput, TimePickerInput, timeOptions } from "@rasoipulse/ui";
import { Plus, Tag, Trash2, X } from "lucide-react";
import * as api from "../lib/api";
                                         
import { useAuth } from "../lib/useAuth";
import { useMenu } from "../lib/useMenu";
import { useOutlet } from "../lib/useOutlet";
import { Button, Card, Checkbox, Empty, Field, InfoHint, Note, PageHeader, Pill, Select, Table, Td, TextInput, Th, Toast } from "../ui";

const CHANNEL_LABEL                         = {
  takeaway: "Takeaway",
  "dine-in": "Dine-in",
  delivery: "Delivery",
  booking: "Table booking",
};
/** What a coupon can be limited to: the three ways to order, and table bookings (which must be ticked on purpose — "none ticked" means food orders only). */
const COUPON_CHANNELS = [...ORDER_CHANNELS, "booking"];

export function Coupons() {
  const { outlet } = useOutlet();
  const { can } = useAuth();
  const canManage = can("coupon:manage");
  const qc = useQueryClient();

  const [editing, setEditing] = useState                       (null);

  const coupons = useQuery({
    queryKey: ["coupons", outlet?._id],
    queryFn: () => api.listCoupons(outlet ),
    enabled: Boolean(outlet) && can("coupon:read"),
  });

  const remove = useMutation({
    mutationFn: (id        ) => api.deleteCoupon(outlet , id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coupons"] }),
  });

  if (!can("coupon:read")) {
    return (
      <>
        <PageHeader title="Coupons" />
        <Card>Your role can&apos;t view coupons.</Card>
      </>
    );
  }

  const list = coupons.data?.coupons ?? [];

  return (
    <>
      <PageHeader
        title="Coupons"
        icon={<Tag size={23} />}
        subtitle="Discount codes customers enter at checkout."
        action={
          canManage ? (
            <Button onClick={() => setEditing("new")} style={{ display: "inline-flex", gap: 7, alignItems: "center" }}>
              <Plus size={15} /> New coupon
            </Button>
          ) : undefined
        }
      />

      <Note icon={<Tag size={15} />}>
        A coupon is checked live at checkout: the code, the dates, the minimum order, how many times it&apos;s been used
        and — for a signed-in customer — whether they&apos;ve used it before. The discount is always recalculated on the
        server, so a code can never be edited into a bigger discount than you set.
      </Note>

      {remove.error ? <Toast kind="error">{(remove.error         ).message}</Toast> : null}

      {!list.length ? (
        <Card>
          <Empty icon={<Tag size={28} />} title="No coupons yet">
            {canManage ? "Create one to start offering a discount." : "An owner or manager can create coupons."}
          </Empty>
        </Card>
      ) : (
        <Table minWidth={980}>
          <thead>
            <tr>
              <Th>Code</Th>
              <Th>Discount</Th>
              <Th>Conditions</Th>
              <Th width={110} align="center">Used</Th>
              <Th width={110}>Window</Th>
              <Th width={90}>Status</Th>
              <Th width={150} align="right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id}>
                <Td nowrap>
                  <span style={{ fontFamily: "ui-monospace, monospace", fontWeight: 700, fontSize: 13.5 }}>{c.code}</span>
                  {c.description ? (
                    <span style={{ display: "block", fontSize: 11.5, color: "var(--color-text-muted)" }}>{c.description}</span>
                  ) : null}
                </Td>
                <Td>
                  <strong>
                    {c.discountType === "fixed" ? `${formatINR(c.value)} off` : c.discountType === "bogo" ? `Buy ${c.buyQty} get ${c.getQty} free` : `${c.value}% off`}
                  </strong>
                  {c.discountType === "percent" && c.maxDiscount ? (
                    <span style={{ display: "block", fontSize: 11.5, color: "var(--color-text-muted)" }}>
                      up to {formatINR(c.maxDiscount)}
                    </span>
                  ) : null}
                </Td>
                <Td>
                  <span style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    {c.minOrderValue ? <Pill>min {formatINR(c.minOrderValue)}</Pill> : null}
                    {c.newCustomersOnly ? <Pill tone="info">first order</Pill> : null}
                    {c.maxPerCustomer > 0 ? <Pill>{c.maxPerCustomer}/customer</Pill> : <Pill>unlimited/customer</Pill>}
                    {c.channels.length ? c.channels.map((ch) => <Pill key={ch}>{CHANNEL_LABEL[ch] ?? ch}</Pill>) : null}
                  </span>
                </Td>
                <Td align="center">
                  <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                    {c.redemptionCount}
                    {c.maxRedemptions > 0 ? ` / ${c.maxRedemptions}` : ""}
                  </span>
                </Td>
                <Td>
                  <span style={{ fontSize: 11.5, color: "var(--color-text-muted)" }}>
                    {c.validFrom ? new Date(c.validFrom).toLocaleDateString() : "—"}
                    {" → "}
                    {c.validUntil ? new Date(c.validUntil).toLocaleDateString() : "—"}
                  </span>
                </Td>
                <Td>
                  <Pill tone={c.active ? "ok" : "neutral"}>{c.active ? "Active" : "Off"}</Pill>
                </Td>
                <Td align="right">
                  {canManage ? (
                    <span style={{ display: "inline-flex", gap: 7 }}>
                      <Button variant="outline" onClick={() => setEditing(c)} style={{ fontSize: 12.5, padding: "6px 12px" }}>
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() =>
                          window.confirm(`Delete coupon ${c.code}? (Used coupons are deactivated, not deleted.)`) &&
                          remove.mutate(c.id)
                        }
                        style={{ fontSize: 12.5, padding: "6px 10px" }}
                        aria-label={`Delete ${c.code}`}
                      >
                        <Trash2 size={13} />
                      </Button>
                    </span>
                  ) : null}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      {editing && outlet ? (
        <CouponEditor
          outlet={outlet}
          coupon={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ editor */

const BLANK              = {
  code: "",
  description: "",
  discountType: "percent",
  value: 10,
  maxDiscount: 0,
  minOrderValue: 0,
  validFrom: "",
  validUntil: "",
  maxRedemptions: 0,
  maxPerCustomer: 1,
  newCustomersOnly: false,
  channels: [],
  active: true,
  buyQty: 1,
  getQty: 1,
  itemIds: [],
  categoryIds: [],
  maxFreeUnits: 0,
};

/** An ISO moment ⇄ the day ("YYYY-MM-DD") and time ("HH:MM") the date and time pickers work with, on this device's clock. */
const splitMoment = (iso        ) => {
  if (!iso) return { day: "", time: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { day: "", time: "" };
  const pad = (n        ) => String(n).padStart(2, "0");
  return { day: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
};
const joinMoment = (day        , time        ) => (day ? new Date(`${day}T${time || "00:00"}`).toISOString() : "");
const prettyDay = (d      ) => d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

/**
 * One end of a coupon's valid period: a date (our date picker) and a time (our time picker). Leaving the date empty means "no bound" on that side.
 * A time that isn't on the half hour (an older coupon, say) is still shown, as an extra choice.
 */
function MomentField({ label, value, onChange, defaultTime, testId }                                                                          ) {
  const { day, time } = splitMoment(value);
  const options = useMemo(() => {
    const list = [...timeOptions({ step: 30, min: "00:00", max: "23:30" }), { value: "23:59", label: "11:59 PM" }];
    if (time && !list.some((o) => o.value === time)) list.push({ value: time, label: new Date(`2000-01-01T${time}`).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) });
    return list.sort((a, b) => a.value.localeCompare(b.value));
  }, [time]);
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
      <Field label={label} as="div" style={{ marginBottom: 0, width: 190 }}>
        <DatePickerInput variant="filled" fullWidth value={day} placeholder="No limit" ariaLabel={`${label} date`} testId={`${testId}-date`} formatValue={prettyDay} triggerStyle={{ minHeight: 35, padding: "7px 12px" }} onChange={(str) => str && onChange(joinMoment(str, time || defaultTime))} />
      </Field>
      <div style={{ width: 130 }}>
        <TimePickerInput value={time || defaultTime} options={options} disabled={!day} ariaLabel={`${label} time`} testId={`${testId}-time`} placeholder="Time" triggerStyle={{ minHeight: 35, padding: "7px 12px" }} onChange={(v) => onChange(joinMoment(day, v))} />
      </div>
      {day ? (
        <Button variant="outline" onClick={() => onChange("")} aria-label={`Clear ${label.toLowerCase()}`} data-testid={`${testId}-clear`} style={{ marginBottom: 1 }}>
          Clear
        </Button>
      ) : null}
    </div>
  );
}

function CouponEditor({ outlet, coupon, onClose }                                                                ) {
  const qc = useQueryClient();
  const [form, setForm] = useState             (() =>
    coupon
      ? {
          code: coupon.code,
          description: coupon.description,
          discountType: coupon.discountType,
          value: coupon.value,
          maxDiscount: coupon.maxDiscount,
          minOrderValue: coupon.minOrderValue,
          validFrom: coupon.validFrom,
          validUntil: coupon.validUntil,
          maxRedemptions: coupon.maxRedemptions,
          maxPerCustomer: coupon.maxPerCustomer,
          newCustomersOnly: coupon.newCustomersOnly,
          channels: coupon.channels,
          active: coupon.active,
          buyQty: coupon.buyQty ?? 1,
          getQty: coupon.getQty ?? 1,
          itemIds: coupon.itemIds ?? [],
          categoryIds: coupon.categoryIds ?? [],
          maxFreeUnits: coupon.maxFreeUnits ?? 0,
        }
      : BLANK,
  );

  const save = useMutation({
    mutationFn: () =>
      coupon ? api.updateCoupon(outlet, coupon.id, form) : api.createCoupon(outlet, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["coupons"] });
      onClose();
    },
  });

  const set = (patch                      ) => setForm((f) => ({ ...f, ...patch }));

  // Money fields are edited in rupees, stored in paise.
  const rupees = (paise                    ) => (paise ? paise / 100 : 0);
  const paise = (r        ) => Math.round((Number(r) || 0) * 100);

  const preview = useMemo(
    () =>
      couponSummary({
        discountType: form.discountType                ,
        value: form.value ?? 0,
        maxDiscount: form.maxDiscount ?? 0,
        minOrderValue: form.minOrderValue ?? 0,
        buyQty: form.buyQty,
        getQty: form.getQty,
        itemIds: form.itemIds,
        categoryIds: form.categoryIds,
      }),
    [form],
  );

  return (
    <div style={overlay} onClick={onClose} role="presentation">
      <form
        className="ot-anim-pop"
        style={panel}
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
        aria-label={coupon ? `Edit ${coupon.code}` : "New coupon"}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: 0, fontFamily: "var(--font-heading)", fontSize: 19 }}>
              {coupon ? `Edit ${coupon.code}` : "New coupon"}
            </h3>
            <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "var(--color-text-muted)" }}>{preview}</p>
          </div>
          <button type="button" onClick={onClose} style={xBtn} aria-label="Close">
            <X size={17} />
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          <Field
            label="Code"
            info="What the customer types at checkout. Letters, digits, dash and underscore only — it's matched without caring about capitals, but shown uppercase."
            style={{ maxWidth: "none" }}
          >
            <TextInput
              value={form.code}
              onChange={(e) => set({ code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "") })}
              required
              placeholder="SAVE20"
              style={{ fontFamily: "ui-monospace, monospace", fontWeight: 700 }}
            />
          </Field>

          <Field label="Description" info="Only you see this — a note about the campaign, e.g. 'Diwali 2026 flyer'." style={{ maxWidth: "none" }}>
            <TextInput value={form.description} onChange={(e) => set({ description: e.target.value })} />
          </Field>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Field label="Type" style={narrow} info="A flat amount off, or a percentage of the item total.">
            <Select value={form.discountType} onChange={(e) => set({ discountType: e.target.value                 })}>
              {(["fixed", "percent", "bogo"]).map((d) => (
                <option key={d} value={d}>{DISCOUNT_TYPE_LABELS[d]}</option>
              ))}
            </Select>
          </Field>

          {form.discountType === "bogo" ? (
            <>
              <Field label="Customer buys" style={narrow} info="How many of the offer's dishes they pay for.">
                <TextInput type="number" min={1} max={10} value={form.buyQty} onChange={(e) => set({ buyQty: Math.max(1, Math.min(10, Number(e.target.value) || 1)) })} aria-label="Customer buys" />
              </Field>
              <Field label="…and gets free" style={narrow} info="How many more come free — always the cheapest ones in the cart.">
                <TextInput type="number" min={1} max={10} value={form.getQty} onChange={(e) => set({ getQty: Math.max(1, Math.min(10, Number(e.target.value) || 1)) })} aria-label="Gets free" />
              </Field>
              <Field label="Most free per order" style={narrow} info="0 = no cap. With buy 1 get 1 and no cap, 6 momos means 3 free.">
                <TextInput type="number" min={0} max={100} value={form.maxFreeUnits} onChange={(e) => set({ maxFreeUnits: Math.max(0, Number(e.target.value) || 0) })} aria-label="Most free per order" />
              </Field>
            </>
          ) : form.discountType === "fixed" ? (
            <Field label="Amount off (₹)" style={narrow} info="Rupees taken off the item total. Can't exceed the order value — a bigger fixed discount just brings the order to zero.">
              <TextInput type="number" min={1} value={rupees(form.value)} onChange={(e) => set({ value: paise(e.target.value) })} />
            </Field>
          ) : (
            <>
              <Field label="Percent off" style={narrow} info="1 to 100. Applied to the item total before tax.">
                <TextInput type="number" min={1} max={100} value={form.value} onChange={(e) => set({ value: Number(e.target.value) || 0 })} />
              </Field>
              <Field label="Max discount (₹)" style={narrow} info="Caps how much a big order can save. 0 means no cap — a 20% coupon on a ₹5000 order would give ₹1000 off.">
                <TextInput type="number" min={0} value={rupees(form.maxDiscount)} onChange={(e) => set({ maxDiscount: paise(e.target.value) })} />
              </Field>
            </>
          )}

          <Field
            label="Minimum order (₹)"
            info="The item total must reach this before the coupon works. Set 0 for no minimum. A common lever: '₹50 off orders above ₹300'."
            style={narrow}
          >
            <TextInput type="number" min={0} value={rupees(form.minOrderValue)} onChange={(e) => set({ minOrderValue: paise(e.target.value) })} />
          </Field>
        </div>

        {form.discountType === "bogo" ? <BogoDishes outlet={outlet} form={form} set={set} /> : null}

        <fieldset style={fieldset}>
          <legend style={legend}>
            Valid period
            <InfoHint title="Valid period" text="Leave either side blank for no bound. Times are in this device's timezone." />
          </legend>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <MomentField label="From" value={form.validFrom ?? ""} onChange={(v) => set({ validFrom: v })} defaultTime="00:00" testId="coupon-from" />
            <MomentField label="Until" value={form.validUntil ?? ""} onChange={(v) => set({ validUntil: v })} defaultTime="23:59" testId="coupon-until" />
          </div>
        </fieldset>

        <fieldset style={fieldset}>
          <legend style={legend}>Usage limits</legend>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Field
              label="Total uses"
              info="How many times this coupon can be redeemed across everyone. 0 = unlimited. Good for a limited launch offer."
              style={narrow}
            >
              <TextInput type="number" min={0} value={form.maxRedemptions} onChange={(e) => set({ maxRedemptions: Number(e.target.value) || 0 })} />
            </Field>
            <Field
              label="Uses per customer"
              info="How many times one signed-in customer can use it. 1 is typical. 0 = unlimited. A per-customer limit means anonymous carts can't use the coupon at all."
              style={narrow}
            >
              <TextInput type="number" min={0} value={form.maxPerCustomer} onChange={(e) => set({ maxPerCustomer: Number(e.target.value) || 0 })} />
            </Field>
          </div>
          <div style={{ marginTop: 6 }}>
            <Checkbox
              checked={Boolean(form.newCustomersOnly)}
              onChange={(v) => set({ newCustomersOnly: v })}
              label="First-time customers only"
              info="Only a customer who has never had an order (that wasn't cancelled) before. Since this needs a customer account, the coupon won't apply to an anonymous cart."
            />
          </div>
        </fieldset>

        <fieldset style={fieldset}>
          <legend style={legend}>
            Order types
            <InfoHint title="Order types" text="Leave all unticked and the coupon works on any food order (takeaway, dine-in, delivery). Tick some to restrict it — for example a delivery-only code. Tick “Table booking” to let it take money off a table booking as well; with only “Table booking” ticked, it works on bookings and nothing else." />
          </legend>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            {COUPON_CHANNELS.map((ch) => (
              <Checkbox
                key={ch}
                checked={(form.channels ?? []).includes(ch)}
                onChange={(v) =>
                  set({ channels: v ? [...(form.channels ?? []), ch] : (form.channels ?? []).filter((x) => x !== ch) })
                }
                label={CHANNEL_LABEL[ch] ?? ch}
              />
            ))}
          </div>
        </fieldset>

        <Checkbox
          checked={Boolean(form.active)}
          onChange={(v) => set({ active: v })}
          label="Coupon is active"
          info="Untick to switch it off without deleting it — useful between campaigns."
        />

        {save.error ? <Toast kind="error">{(save.error         ).message}</Toast> : null}

        <div style={{ display: "flex", gap: 9, justifyContent: "flex-end", marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--color-border)" }}>
          <Button variant="outline" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : coupon ? "Save changes" : "Create coupon"}</Button>
        </div>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ styles */

const overlay                = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.5)",
  display: "grid",
  placeItems: "center",
  padding: 16,
  zIndex: 60,
  overflowY: "auto",
};
const panel                = {
  background: "var(--color-bg)",
  border: "1px solid var(--color-border)",
  borderRadius: 14,
  padding: 24,
  width: "100%",
  maxWidth: 540,
  maxHeight: "92vh",
  overflowY: "auto",
};
const xBtn                = {
  font: "inherit",
  display: "grid",
  placeItems: "center",
  width: 30,
  height: 30,
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  background: "var(--color-bg)",
  color: "var(--color-text)",
  cursor: "pointer",
  flexShrink: 0,
};
/**
 * What a "buy X get Y free" coupon works on: every dish, whole categories (with everything inside them), or chosen
 * dishes. Free dishes are always the cheapest of the ones it covers.
 */
function BogoDishes({ outlet, form, set }) {
  const menu = useMenu(outlet);
  const [q, setQ] = useState("");
  const mode = form.itemIds.length ? "items" : form.categoryIds.length ? "categories" : "all";
  const [shown, setShown] = useState(mode);
  const categories = (menu.data?.categories ?? []).filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()));
  const items = (menu.data?.items ?? []).filter((i) => !i.combo && (!q || i.name.toLowerCase().includes(q.toLowerCase())));
  const toggle = (key, id) => set({ [key]: form[key].includes(id) ? form[key].filter((x) => x !== id) : [...form[key], id] });
  const pick = (m) => {
    setShown(m);
    if (m === "all") set({ itemIds: [], categoryIds: [] });
    if (m === "categories") set({ itemIds: [] });
    if (m === "items") set({ categoryIds: [] });
  };
  return (
    <fieldset style={fieldset} data-testid="bogo-dishes">
      <legend style={legend}>Works on</legend>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 13 }}>
        {[["all", "Every dish"], ["categories", "Chosen categories"], ["items", "Chosen dishes"]].map(([m, label]) => (
          <label key={m} style={{ display: "inline-flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
            <input type="radio" checked={shown === m} onChange={() => pick(m)} /> {label}
          </label>
        ))}
      </div>
      {shown !== "all" ? (
        <>
          <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" style={{ margin: "10px 0 8px" }} aria-label="Search the menu" />
          <div style={{ maxHeight: 200, overflowY: "auto", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 6 }}>
            {(shown === "categories" ? categories : items).map((x) => {
              const key = shown === "categories" ? "categoryIds" : "itemIds";
              return (
                <label key={x.id} style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 13, cursor: "pointer" }}>
                  <input type="checkbox" checked={form[key].includes(x.id)} onChange={() => toggle(key, x.id)} /> {x.name}
                </label>
              );
            })}
          </div>
          <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--color-text-muted)" }}>
            {shown === "categories" ? `${form.categoryIds.length} chosen — everything inside them counts.` : `${form.itemIds.length} chosen.`}
          </p>
        </>
      ) : null}
    </fieldset>
  );
}

const fieldset                = { border: "1px solid var(--color-border)", borderRadius: 10, padding: "12px 14px 14px", margin: "14px 0" };
const legend                = { fontSize: 12.5, fontWeight: 600, padding: "0 6px", display: "inline-flex", alignItems: "center", gap: 6 };
const narrow                = { maxWidth: 180, flex: "1 1 150px" };
