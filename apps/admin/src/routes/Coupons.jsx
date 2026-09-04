import { useMemo, useState } from "react";
                                           
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  couponSummary,
  DISCOUNT_TYPE_LABELS,
  formatINR,
  ORDER_CHANNELS,
              
                   
                    
} from "@onetap/config-schema";
import { Plus, Tag, Trash2, X } from "lucide-react";
import * as api from "../lib/api";
                                         
import { useAuth } from "../lib/useAuth";
import { useOutlet } from "../lib/useOutlet";
import { Button, Card, Checkbox, Empty, Field, InfoHint, Note, PageHeader, Pill, Select, Table, Td, TextInput, Th, Toast } from "../ui";

const CHANNEL_LABEL                         = {
  takeaway: "Takeaway",
  "dine-in": "Dine-in",
  delivery: "Delivery",
};

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
                    {c.discountType === "fixed" ? `${formatINR(c.value)} off` : `${c.value}% off`}
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
};

/** ISO string ⇄ the value a <input type="datetime-local"> wants. */
const toLocalInput = (iso        )         => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n        ) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocalInput = (v        )         => (v ? new Date(v).toISOString() : "");

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
              {(["fixed", "percent"]                  ).map((d) => (
                <option key={d} value={d}>{DISCOUNT_TYPE_LABELS[d]}</option>
              ))}
            </Select>
          </Field>

          {form.discountType === "fixed" ? (
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

        <fieldset style={fieldset}>
          <legend style={legend}>
            Valid period
            <InfoHint title="Valid period" text="Leave either side blank for no bound. Times are in this device's timezone." />
          </legend>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Field label="From" style={narrow}>
              <TextInput
                type="datetime-local"
                value={toLocalInput(form.validFrom ?? "")}
                onChange={(e) => set({ validFrom: fromLocalInput(e.target.value) })}
              />
            </Field>
            <Field label="Until" style={narrow}>
              <TextInput
                type="datetime-local"
                value={toLocalInput(form.validUntil ?? "")}
                onChange={(e) => set({ validUntil: fromLocalInput(e.target.value) })}
              />
            </Field>
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
            <InfoHint title="Order types" text="Leave all unticked and the coupon works on any order. Tick some to restrict it — for example a delivery-only code." />
          </legend>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            {ORDER_CHANNELS.map((ch) => (
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
const fieldset                = { border: "1px solid var(--color-border)", borderRadius: 10, padding: "12px 14px 14px", margin: "14px 0" };
const legend                = { fontSize: 12.5, fontWeight: 600, padding: "0 6px", display: "inline-flex", alignItems: "center", gap: 6 };
const narrow                = { maxWidth: 180, flex: "1 1 150px" };
