import { useEffect, useState } from "react";
import { Link } from "../lib/nav";
                                                      
                                                                          
import {
  AlarmClock,
  Bell,
  Bike,
  Building2,
  ChefHat,
  Clock,
  Coins,
  Gauge,
  ListChecks,
  MapPin,
  Receipt,
  Save,
  ShoppingCart,
  ToggleLeft,
  Truck,
  CalendarDays,
  Star,
  Sparkles,
} from "lucide-react";
import { useOutlet, usePatchConfig } from "../lib/useOutlet";
import { useAuth } from "../lib/useAuth";
import { useStorePlan } from "../lib/useStorePlan";
import { LocationField } from "./settings/LocationField";
import { Button, Card, Checkbox, Field, InfoHint, Note, PageHeader, Select, Tabs, TextInput, Toast } from "../ui";
import { ImageField } from "../components/ImageField";
import { SettingsNav } from "../components/SubNav";

                                                                                                                    

const IDENTITY_FIELDS                                                                              = [
  {
    key: "tagline",
    label: "Tagline",
    hint: "Shown in the storefront hero",
    info: "One short line under your name on the website. Say what you actually sell — 'Steamed fresh, all day' beats 'Welcome to our restaurant'.",
  },
  {
    key: "fssaiLicense",
    label: "FSSAI licence number",
    hint: "14 digits — shown in the footer (legally required)",
    info: "Your food licence number. Indian law requires it displayed wherever you sell food, so it prints on receipts and shows in the website footer. Leaving it blank risks a penalty during an inspection.",
  },
  {
    key: "gstin",
    label: "GSTIN",
    info: "Your GST registration number. It has to appear on a tax invoice for the customer to claim input credit — without it, business customers can't expense their meal.",
  },
  {
    key: "phone",
    label: "Phone",
    info: "The number customers call about an order. It appears on the website, on receipts, and in the order confirmation — use the one somebody actually answers during service.",
  },
  {
    key: "email",
    label: "Email",
    info: "Where order copies and customer enquiries go. Not shown publicly unless you add it to the footer.",
  },
  {
    key: "address",
    label: "Address",
    info: "Where this outlet is. Printed on receipts and shown on the website. On a tax invoice it is the legally required place of supply.",
  },
];

export function Settings() {
  const { outlet } = useOutlet();
  const { hasFeature } = useStorePlan();
  const isSuperAdmin = Boolean(useAuth().user?.isSuperAdmin);
  const patch = usePatchConfig();
  const [tab, setTab] = useState     ("business");
  const [draft, setDraft] = useState                     (null);
  const [dirty, setDirty] = useState(false);

  // Re-syncs whenever the SELECTED OUTLET actually changes (switching in the
  // sidebar doesn't unmount this page) — not just once. Any unsaved edits on
  // the outlet just left are discarded, the same way switching away and back
  // would; keying on outlet?._id (not the outlet object itself, which gets a
  // new reference on every background refetch) means an in-progress edit on
  // the SAME outlet is never stomped mid-typing.
  useEffect(() => {
    if (outlet) {
      setDraft(outlet.config);
      setDirty(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outlet?._id]);

  if (!outlet || !draft) {
    return (
      <>
        <PageHeader title="Settings" />
        <SettingsNav />
        <Card>Seed an outlet from the Dashboard first.</Card>
      </>
    );
  }

  const ops = draft.operations;

  /** Narrow, typed setters — one per settings group, so nothing is stringly-typed. */
  const setIdentity = (key                      , value        ) => {
    setDraft({ ...draft, identity: { ...draft.identity, [key]: value } });
    setDirty(true);
  };
  const setOps =                             (group   , patchValue                          ) => {
    setDraft({ ...draft, operations: { ...ops, [group]: { ...ops[group], ...patchValue } } });
    setDirty(true);
  };
  const setFeature =                                           (
    group   ,
    patchValue                                      ,
  ) => {
    setDraft({ ...draft, features: { ...draft.features, [group]: { ...draft.features[group], ...patchValue } } });
    setDirty(true);
  };
  const setWallet = (patchValue                                 ) => {
    setDraft({ ...draft, wallet: { ...draft.wallet, ...patchValue } });
    setDirty(true);
  };
  const setCapacity = (patchValue                                   ) => {
    setDraft({ ...draft, capacity: { ...draft.capacity, ...patchValue } });
    setDirty(true);
  };
  /** one top-level config area (reservations, feedback, upsell, menuTimes) */
  const setArea = (area, patchValue) => {
    setDraft({ ...draft, [area]: { ...draft[area], ...patchValue } });
    setDirty(true);
  };

  const save = () =>
    patch.mutate(
      {
        outlet,
        patch: {
          identity: draft.identity,
          operations: draft.operations,
          features: draft.features,
          wallet: draft.wallet,
          capacity: draft.capacity,
          reservations: draft.reservations,
          kitchenDisplay: draft.kitchenDisplay,
          feedback: draft.feedback,
          upsell: draft.upsell,
          menuTimes: draft.menuTimes,
          // the favicon is one for the whole store — sent only when the plan includes it
          ...(hasFeature("favicon") ? { branding: draft.branding } : {}),
        },
      },
      { onSuccess: () => setDirty(false) },
    );

  return (
    <>
      <PageHeader
        title="Settings"
        icon={<Building2 size={23} />}
        subtitle="How this outlet identifies itself, and how it runs during service."
        action={
          <Button onClick={save} disabled={!dirty || patch.isPending} style={{ display: "inline-flex", gap: 7, alignItems: "center" }}>
            <Save size={15} />
            {patch.isPending ? "Saving…" : dirty ? "Save changes" : "Saved"}
          </Button>
        }
      />

      <SettingsNav />

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "business", label: "Business", icon: <Building2 size={14} /> },
          { id: "hours", label: "Opening hours", icon: <Clock size={14} /> },
          { id: "alerts", label: "Missed-order alerts", icon: <AlarmClock size={14} /> },
          { id: "orders", label: "Order handling", icon: <ListChecks size={14} /> },
          { id: "kitchen", label: "Kitchen & delivery", icon: <ChefHat size={14} /> },
          { id: "receipts", label: "Receipts & charges", icon: <Receipt size={14} /> },
          { id: "features", label: "Features", icon: <ToggleLeft size={14} /> },
          { id: "bookings", label: "Pre-orders & bookings", icon: <CalendarDays size={14} /> },
          { id: "growth", label: "Ratings & suggestions", icon: <Star size={14} /> },
          { id: "wallet", label: "Coin wallet", icon: <Coins size={14} /> },
          { id: "capacity", label: "Load management", icon: <Gauge size={14} /> },
        ]}
      />

      {/* ------------------------------------------------------------ business */}

      {tab === "business" ? (
        <>
          <Card title="Business identity" subtitle="Used on the storefront, on receipts, and on tax invoices.">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
              {/* the STORE's name (one for every outlet): shown here, never editable by the store — only the platform admin renames a store */}
              <Field
                label="Store name"
                info="The name of your whole store — shown in the storefront header, on receipts and in order messages, the same for every outlet. It is set by TablePe and can't be changed here. To rename just one outlet, use Settings → Outlets."
                hint={
                  isSuperAdmin
                    ? "Change it in the platform console: Stores → this store → Store name."
                    : "Contact the TablePe admin to update the store name."
                }
                style={{ maxWidth: "none" }}
              >
                <TextInput
                  value={outlet.brandName ?? ""}
                  disabled
                  readOnly
                  data-testid="store-name"
                  aria-label="Store name (only the TablePe admin can change it)"
                  style={{ background: "var(--color-surface)", color: "var(--color-text-muted)", cursor: "not-allowed" }}
                />
              </Field>
              {IDENTITY_FIELDS.map((f) => (
                <Field key={f.key} label={f.label} hint={f.hint} info={f.info} style={{ maxWidth: "none" }}>
                  <TextInput value={String(draft.identity[f.key] ?? "")} onChange={(e) => setIdentity(f.key, e.target.value)} />
                </Field>
              ))}
            </div>
            <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--color-border)" }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                Logo
                <InfoHint title="Logo" text="Shown beside your name in the storefront header (in the header styles that have room for it). A square or wide picture on a plain background works best. Remember to press Save changes." />
              </div>
              <ImageField outlet={outlet} kind="logos" label="Logo" shape="square" value={draft.identity.logoUrl ?? ""} onChange={(url) => setIdentity("logoUrl", url)} />
            </div>
            <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--color-border)" }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                Favicon
                <InfoHint title="Favicon" text="The small icon in the browser tab and in bookmarks. It is ONE icon for the whole store — every outlet's pages use it. A square picture (at least 64 × 64) with a simple shape works best. Remember to press Save changes." />
              </div>
              {hasFeature("favicon") ? (
                <>
                  <ImageField
                    outlet={outlet}
                    kind="logos"
                    label="Favicon"
                    shape="square"
                    value={draft.branding?.faviconUrl ?? ""}
                    onChange={(url) => {
                      setDraft({ ...draft, branding: { ...draft.branding, faviconUrl: url } });
                      setDirty(true);
                    }}
                  />
                  <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "var(--color-text-muted)" }}>Same for every outlet of this store.</p>
                </>
              ) : (
                <LockedFeature label="Your own favicon" note="Visitors see the browser's default icon until it's added to your plan." />
              )}
            </div>
          </Card>

          <Card title="Map location" subtitle="The origin for delivery distance." icon={<MapPin size={15} />}>
            <LocationField
              value={draft.identity.location}
              onChange={(loc) => {
                setDraft({ ...draft, identity: { ...draft.identity, location: loc } });
                setDirty(true);
              }}
            />
          </Card>
        </>
      ) : null}

      {/* --------------------------------------------------------------- hours */}

      {tab === "hours" ? (
        <Card title="Opening hours" subtitle="When the storefront accepts orders.">
          <Note icon={<Clock size={15} />}>
            This only stops <strong>online</strong> orders. Staff can always take a counter order, so a late walk-in is
            never turned away by a setting.
          </Note>

          <Checkbox
            checked={draft.operations.hours.enabled}
            onChange={(v) => setOps("hours", { enabled: v })}
            label="Enforce opening hours"
            info="When this is off the storefront takes orders around the clock. Turn it on so customers can't order at 3am and find nobody there in the morning."
          />

          {draft.operations.hours.enabled ? (
            <div style={{ marginTop: 14 }}>
              <Row>
                <Field label="Opens at" info="The first minute the storefront will accept an online order." style={narrow}>
                  <TextInput type="time" value={ops.hours.opensAt} onChange={(e) => setOps("hours", { opensAt: e.target.value })} />
                </Field>
                <Field label="Closes at" info="After this the storefront shows your closed message instead of the menu." style={narrow}>
                  <TextInput type="time" value={ops.hours.closesAt} onChange={(e) => setOps("hours", { closesAt: e.target.value })} />
                </Field>
                <Field
                  label="Stop taking orders early (minutes)"
                  info="Stops new orders this many minutes before closing, so the kitchen isn't cooking a fresh order at the moment it should be cleaning down."
                  style={narrow}
                >
                  <TextInput
                    type="number"
                    min={0}
                    max={180}
                    value={ops.hours.lastOrderBufferMinutes}
                    onChange={(e) => setOps("hours", { lastOrderBufferMinutes: Number(e.target.value) || 0 })}
                  />
                </Field>
              </Row>

              <Field
                label="Closed message"
                info="What a customer sees when they land on the site outside opening hours. Say when you reopen — a closed sign with no time sends them elsewhere."
                style={{ maxWidth: 560 }}
              >
                <TextInput value={ops.hours.closedMessage} onChange={(e) => setOps("hours", { closedMessage: e.target.value })} />
              </Field>
            </div>
          ) : null}
        </Card>
      ) : null}

      {/* -------------------------------------------------------------- alerts */}

      {tab === "alerts" ? (
        <>
          <Card title="Missed-order alerts" subtitle="Warn the counter when an order has been sitting too long." icon={<AlarmClock size={15} />}>
            <Note icon={<Bell size={15} />}>
              A missed order is the most expensive thing that can go wrong in a shift — the customer is waiting, nobody
              knows, and the first sign of trouble is a complaint. Two limits turn that into a red warning on the Orders
              screen: an order <strong>nobody has accepted</strong>, and an order that has been <strong>cooking too
              long</strong> (its timer starts when it reaches Preparing). Accepted, Ready and Completed orders never
              warn. The warning never blocks the list; staff can keep working straight through it.
            </Note>

            <Checkbox
              checked={ops.sla.enabled}
              onChange={(v) => setOps("sla", { enabled: v })}
              label="Warn me about slow orders"
              info="Turns the whole system on. With it off, the Orders screen still shows how long each order has been waiting, but nothing will alert you."
            />

            {ops.sla.enabled ? (
              <>
                <div style={{ marginTop: 16 }}>
                  <Row>
                    <Field
                      label="Accept within (minutes)"
                      hint="Order placed → someone accepts it"
                      info="How long a brand-new order may sit unacknowledged. This is the one that catches the order nobody noticed arrive. Two to three minutes is typical."
                      style={narrow}
                    >
                      <TextInput type="number" min={1} max={240} value={ops.sla.acceptMinutes} onChange={(e) => setOps("sla", { acceptMinutes: Number(e.target.value) || 1 })} />
                    </Field>
                    <Field
                      label="Finish cooking within (minutes)"
                      hint="Time in Preparing before the warning"
                      info="How long an order may stay in Preparing before the kitchen counts as running late — for example 20 minutes. The count starts the moment the order is moved to Preparing. Set it a little above your genuine worst case, or it will cry wolf during every rush."
                      style={narrow}
                    >
                      <TextInput type="number" min={1} max={240} value={ops.sla.prepMinutes} onChange={(e) => setOps("sla", { prepMinutes: Number(e.target.value) || 1 })} />
                    </Field>
                  </Row>
                </div>

                <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginTop: 6 }}>
                  <Checkbox
                    checked={ops.sla.sound}
                    onChange={(v) => setOps("sla", { sound: v })}
                    label="Play a sound"
                    info="Chimes when an order goes over its limit. Browsers only allow sound after somebody has clicked the page at least once, so the Orders screen will tell you if it's still waiting for that."
                  />
                  <Checkbox
                    checked={ops.sla.repeatAlert}
                    onChange={(v) => setOps("sla", { repeatAlert: v })}
                    label="Keep reminding me"
                    info="Repeats the alert every minute while an order is still late, instead of warning once and going quiet. Leave this on — a single alert during a rush is a missed alert."
                  />
                </div>
              </>
            ) : null}
          </Card>
        </>
      ) : null}

      {/* -------------------------------------------------------------- orders */}

      {tab === "orders" ? (
        <Card title="Order handling" subtitle="How the Orders screen behaves during service." icon={<ListChecks size={15} />}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Checkbox
              checked={ops.orders.showTimers}
              onChange={(v) => setOps("orders", { showTimers: v })}
              label="Show a waiting clock on every open order"
              info="Adds a running timer to each row showing how long the order has been in its current state. The single most useful column during a rush."
            />
            <Checkbox
              checked={ops.orders.oldestFirst}
              onChange={(v) => setOps("orders", { oldestFirst: v })}
              label="Show the oldest order first"
              info="Newest-first suits a screen you glance at; oldest-first suits a queue you work through top to bottom. Kitchens usually want oldest-first so nothing sinks to the bottom."
            />
            <Checkbox
              checked={ops.orders.confirmCancel}
              onChange={(v) => setOps("orders", { confirmCancel: v })}
              label="Ask before cancelling an order"
              info="Puts a confirmation in front of cancellation. Worth keeping on: a cancel is visible to the customer and cannot be quietly undone."
            />
            <Checkbox
              checked={ops.orders.allowStatusRewind}
              onChange={(v) => setOps("orders", { allowStatusRewind: v })}
              label="Allow staff to correct a status"
              info="Enables the small arrow beside the main button that sets any status directly. Without it, an order marked Completed by a mis-tap is stuck there. Every manual change is recorded with the name of whoever made it."
            />
            <Checkbox
              checked={ops.orders.allowOrderEdit}
              onChange={(v) => setOps("orders", { allowOrderEdit: v })}
              label="Allow editing an order after it is placed"
              info="Lets staff add or remove items on an existing order — the customer wants a drink, or you have run out of something. Prices are always recalculated on the server, so an edit can never be used to discount an order."
            />
            <Checkbox
              checked={ops.orders.autoAccept}
              onChange={(v) => setOps("orders", { autoAccept: v })}
              label="Accept incoming orders automatically"
              info="Skips the accept step so orders go straight to the kitchen. Faster, but nobody has checked you can actually make it — leave this off unless the counter is unattended."
            />
          </div>

          <div style={{ marginTop: 18 }}>
            <Row>
              <Field
                label="Lock editing after"
                info="The point past which an order can no longer be edited, because the food is already made and changing the bill would no longer match what was cooked."
                style={narrow}
              >
                <Select value={ops.orders.editLockAfter} onChange={(e) => setOps("orders", { editLockAfter: e.target.value                                    })}>
                  <option value="never">Never lock</option>
                  <option value="preparing">Once cooking starts</option>
                  <option value="ready">Once the food is ready</option>
                  <option value="completed">Once completed</option>
                </Select>
              </Field>
              <Field
                label="Fallback refresh (seconds)"
                info="How often the list reloads if the live connection drops. The Orders screen normally updates the instant something changes; this is only the safety net."
                style={narrow}
              >
                <TextInput type="number" min={3} max={120} value={ops.orders.pollSeconds} onChange={(e) => setOps("orders", { pollSeconds: Number(e.target.value) || 10 })} />
              </Field>
            </Row>
          </div>
        </Card>
      ) : null}

      {/* ------------------------------------------------------------- kitchen */}

      {tab === "kitchen" ? (
        <>
          <Card title="Kitchen display" subtitle="A screen for the kitchen and the bar at /kitchen — orders as cards, Start and Ready taps." icon={<ChefHat size={15} />}>
            {hasFeature("kitchenDisplay") ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }} data-testid="settings-kitchen-display">
                <Checkbox
                  checked={draft.kitchenDisplay.notifyWaiter}
                  onChange={(v) => setArea("kitchenDisplay", { notifyWaiter: v })}
                  label="Tell the waiter when the kitchen marks something ready"
                  info="A bell with a short sound shows on the waiter's screen (Take order and the dashboard): “Table 4 — Order #123: Kitchen ready”. Off by default."
                />
                <Row>
                  <Field label="Turn amber after (minutes)" info="A card on the kitchen screen turns amber when an order has waited this long without being ready." style={narrow}>
                    <TextInput type="number" min={1} max={180} value={draft.kitchenDisplay.warnAfterMinutes} onChange={(e) => setArea("kitchenDisplay", { warnAfterMinutes: Math.max(1, Number(e.target.value) || 10) })} aria-label="Amber after minutes" />
                  </Field>
                  <Field label="Turn red after (minutes)" info="…and red after this long. It should be more than the amber time." style={narrow}>
                    <TextInput type="number" min={2} max={240} value={draft.kitchenDisplay.lateAfterMinutes} onChange={(e) => setArea("kitchenDisplay", { lateAfterMinutes: Math.max(2, Number(e.target.value) || 20) })} aria-label="Red after minutes" />
                  </Field>
                </Row>
                <p style={{ margin: 0, fontSize: 12.5, color: "var(--color-text-muted)" }}>
                  Open <strong>/kitchen</strong> on the kitchen tablet. Add <code>?screen=bar</code> for a bar-only screen. Which dishes go to the kitchen or the bar is set with <em>Prepared at</em> on categories and dishes.
                </p>
              </div>
            ) : (
              <LockedFeature label="Kitchen display" />
            )}
          </Card>

          <Card title="Preparation time" subtitle="What you promise the customer." icon={<ChefHat size={15} />}>
            <Row>
              <Field
                label="Normal prep time (minutes)"
                info="The 'ready in about N minutes' a customer sees at checkout. Quote your realistic average, not your best case — a promise you miss costs more than a longer one you keep."
                style={narrow}
              >
                <TextInput type="number" min={1} max={180} value={ops.prepTime.defaultMinutes} onChange={(e) => setOps("prepTime", { defaultMinutes: Number(e.target.value) || 15 })} />
              </Field>
              <Field
                label="Extra when busy (minutes)"
                info="Added to the quoted time while busy mode is on, so customers get a realistic wait during a rush instead of an optimistic one."
                style={narrow}
              >
                <TextInput type="number" min={0} max={120} value={ops.prepTime.busyExtraMinutes} onChange={(e) => setOps("prepTime", { busyExtraMinutes: Number(e.target.value) || 0 })} />
              </Field>
            </Row>
            <Checkbox
              checked={ops.prepTime.busyMode}
              onChange={(v) => setOps("prepTime", { busyMode: v })}
              label="Busy mode is on right now"
              info="Flip this during a rush to add the extra minutes above to every quoted time. Remember to turn it off afterwards."
            />
          </Card>

          <Card title="Order limits & delivery" subtitle="Guard rails on what a customer can order." icon={<Truck size={15} />}>
            <Row>
              <Field
                label="Minimum order (₹)"
                info="Orders below this can't be placed online. Useful for delivery, where a tiny order costs more to deliver than it earns. Set 0 for no minimum."
                style={narrow}
              >
                <TextInput type="number" min={0} value={ops.limits.minOrderValue / 100} onChange={(e) => setOps("limits", { minOrderValue: Math.round((Number(e.target.value) || 0) * 100) })} />
              </Field>
              <Field
                label="Maximum items per order"
                info="A sanity limit that stops a mis-tap or a bot placing an order for 500 plates. Raise it if you genuinely take large party orders online."
                style={narrow}
              >
                <TextInput type="number" min={1} max={200} value={ops.limits.maxItemsPerOrder} onChange={(e) => setOps("limits", { maxItemsPerOrder: Number(e.target.value) || 50 })} />
              </Field>
            </Row>
            <Row>
              <Field
                label="Delivery fee (₹)"
                info="Flat charge added to delivery orders. Set 0 if delivery is free or you only use aggregators, who charge the customer themselves."
                style={narrow}
              >
                <TextInput type="number" min={0} value={ops.limits.deliveryFee / 100} onChange={(e) => setOps("limits", { deliveryFee: Math.round((Number(e.target.value) || 0) * 100) })} />
              </Field>
              <Field
                label="Free delivery above (₹)"
                info="Waives the delivery fee on larger orders — a common way to nudge basket size up. Set 0 to always charge the fee."
                style={narrow}
              >
                <TextInput type="number" min={0} value={ops.limits.freeDeliveryAbove / 100} onChange={(e) => setOps("limits", { freeDeliveryAbove: Math.round((Number(e.target.value) || 0) * 100) })} />
              </Field>
              <Field
                label="Delivery radius (km)"
                info="How far from the shop's map pin you will deliver. Measured as a straight line, which is shorter than the road route — set it a little tight to compensate. Addresses beyond it are refused at checkout rather than accepted and then cancelled."
                style={narrow}
              >
                <TextInput type="number" min={0} max={50} step="0.5" value={ops.limits.deliveryRadiusKm} onChange={(e) => setOps("limits", { deliveryRadiusKm: Number(e.target.value) || 0 })} />
              </Field>
            </Row>

            <Note icon={<MapPin size={15} />}>
              Set the shop&apos;s map pin on the <strong>Business</strong> tab first — without it, no distance can be
              measured and delivery stays off.
            </Note>

            <Row>
              <Field
                label="Delivery time per km (minutes)"
                info="How many minutes of travel to add to the ETA for each kilometre between the shop and the address. 3–5 is realistic for city traffic on a scooter."
                style={narrow}
              >
                <TextInput
                  type="number"
                  min={0}
                  max={30}
                  step="0.5"
                  value={ops.limits.deliveryMinutesPerKm}
                  onChange={(e) => setOps("limits", { deliveryMinutesPerKm: Number(e.target.value) || 0 })}
                />
              </Field>
              <Field
                label="Minimum delivery ETA (minutes)"
                info="The quoted delivery time never drops below this, however close the address. Covers the time to cook and hand the order to a rider even for a doorstep next door."
                style={narrow}
              >
                <TextInput
                  type="number"
                  min={1}
                  max={180}
                  value={ops.limits.deliveryMinEtaMinutes}
                  onChange={(e) => setOps("limits", { deliveryMinEtaMinutes: Number(e.target.value) || 20 })}
                />
              </Field>
            </Row>
            <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: "4px 0 0" }}>
              A customer sees: <strong>prep time</strong> (set above) + <strong>distance × per-km</strong>, never less
              than the minimum. Prep time and busy mode also feed this.
            </p>
          </Card>
        </>
      ) : null}

      {/* ------------------------------------------------------------ receipts */}

      {tab === "receipts" ? (
        <Card title="Receipts & charges" icon={<Receipt size={15} />}>
          <Note icon={<Receipt size={15} />}>
            Which printer each slip comes out of is set on the <strong>Printing</strong> page. This is about what goes
            on the bill.
          </Note>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Checkbox
              checked={ops.receipts.autoPrintReceipt}
              onChange={(v) => setOps("receipts", { autoPrintReceipt: v })}
              label="Print a customer receipt automatically"
              info="Prints the customer's copy without anyone asking for it. Turn it off if most customers decline the slip — it saves a surprising amount of paper."
            />
            <Checkbox
              checked={ops.receipts.offerDigitalReceipt}
              onChange={(v) => setOps("receipts", { offerDigitalReceipt: v })}
              label="Offer to text or email the receipt"
              info="Gives the customer the choice of a digital copy instead of paper. Needs an SMS or email provider to be connected before it can actually send."
            />
            <Checkbox
              checked={ops.receipts.showTipLine}
              onChange={(v) => setOps("receipts", { showTipLine: v })}
              label="Print a tip line on the bill"
              info="Adds a blank line for the customer to write a tip on a card bill. Common in table service, unusual at a counter."
            />
          </div>

          <div style={{ marginTop: 18 }}>
            <Field
              label="Service charge (%)"
              hint="0 switches it off"
              info="A percentage added to every bill. In India this is optional for the customer by law and must be clearly shown — never hide it inside the item price. Set 0 unless you genuinely operate one."
              style={narrow}
            >
              <TextInput type="number" min={0} max={25} step="0.5" value={ops.receipts.serviceChargePct} onChange={(e) => setOps("receipts", { serviceChargePct: Number(e.target.value) || 0 })} />
            </Field>
          </div>
        </Card>
      ) : null}

      {/* ------------------------------------------------------------ features */}

      {tab === "features" ? (
        <>
          <Card title="Ways to order" subtitle="Switch a whole order path on or off." icon={<ShoppingCart size={15} />}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {hasFeature("takeaway") ? (
                <Checkbox
                  checked={draft.features.ordering.takeaway}
                  onChange={(v) => setFeature("ordering", { takeaway: v })}
                  label="Takeaway from the website"
                  info="Customers order online and collect. Turning it off hides the ordering flow on the storefront but leaves the menu readable."
                />
              ) : (
                <LockedFeature label="Takeaway from the website" />
              )}
              {hasFeature("dineInQr") ? (
                <Checkbox
                  checked={draft.features.ordering.dineInQr}
                  onChange={(v) => setFeature("ordering", { dineInQr: v })}
                  label="Dine-in QR ordering"
                  info="Diners scan the code on their table and order from their seat. Needs tables and their QR codes set up on the Tables page first."
                />
              ) : (
                <LockedFeature label="Dine-in QR ordering" />
              )}
              {hasFeature("delivery") ? (
                <Checkbox
                  checked={draft.features.ordering.delivery}
                  onChange={(v) => setFeature("ordering", { delivery: v })}
                  label="Delivery"
                  info="Your own delivery, priced with the delivery settings under Kitchen & delivery. Delivery orders are always paid online, so customers are only offered it while an online payment method is switched on under Payments. Aggregator orders arrive through their own integration and are not affected by this."
                />
              ) : (
                <LockedFeature label="Delivery" />
              )}
            </div>
          </Card>

          <Card title="Storefront extras" icon={<ToggleLeft size={15} />}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Checkbox
                checked={draft.features.ui.scrollToTop}
                onChange={(v) => setFeature("ui", { scrollToTop: v })}
                label="Back-to-top button"
                info="A floating button that returns a customer to the top of a long menu. Worth having on a menu with more than a couple of screens of items."
              />
              <p style={{ margin: 0, fontSize: 13, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
                The <strong>message bar</strong> above the header and the <strong>promo carousel</strong> have their own page now:{" "}
                <Link to="/banners" style={{ color: "var(--color-primary)" }}>
                  Storefront → Banners
                </Link>
                .
              </p>
              <p style={{ margin: 0, fontSize: 13, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
                <strong>Table bookings</strong> and <strong>pre-orders</strong> are under the <em>Pre-orders &amp; bookings</em> tab; ratings and
                &ldquo;goes well with&rdquo; suggestions under <em>Ratings &amp; suggestions</em>.
              </p>
            </div>
          </Card>
        </>
      ) : null}

      {/* ------------------------------------------------- pre-orders & bookings */}

      {tab === "bookings" ? (
        <>
          <Card title="Pre-orders" subtitle="Takeaway customers choose a later pickup time instead of “as soon as possible”." icon={<Clock size={15} />}>
            {hasFeature("scheduledOrders") ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }} data-testid="settings-preorders">
                <Checkbox
                  checked={ops.scheduling.enabled}
                  onChange={(v) => setOps("scheduling", { enabled: v })}
                  label="Take pre-orders for takeaway"
                  info="At checkout, takeaway customers can pick “Later” and a pickup time. The times follow your opening hours (Opening hours tab) — from opening time plus your prep time, until closing."
                />
                {ops.scheduling.enabled ? (
                  <Row>
                    <Field label="Days ahead" info="0 = only later today. Up to 7 days." style={narrow}>
                      <TextInput type="number" min={0} max={7} value={ops.scheduling.maxDaysAhead} onChange={(e) => setOps("scheduling", { maxDaysAhead: Math.max(0, Math.min(7, Number(e.target.value) || 0)) })} aria-label="Days ahead" />
                    </Field>
                    <Field label="Earliest pickup (minutes from now)" info="The soonest a pre-order can be collected — leave the kitchen enough time." style={narrow}>
                      <TextInput type="number" min={10} max={720} value={ops.scheduling.minLeadMinutes} onChange={(e) => setOps("scheduling", { minLeadMinutes: Math.max(10, Number(e.target.value) || 30) })} aria-label="Earliest pickup minutes" />
                    </Field>
                    <Field label="A pickup time every" style={narrow}>
                      <Select value={ops.scheduling.slotMinutes} onChange={(e) => setOps("scheduling", { slotMinutes: Number(e.target.value) })} aria-label="Pickup time step">
                        {[10, 15, 20, 30, 60].map((m) => <option key={m} value={m}>{m} minutes</option>)}
                      </Select>
                    </Field>
                    <Field label="Most pre-orders per time" info="0 = no limit. Stops ten orders all landing at 1:00 PM." style={narrow}>
                      <TextInput type="number" min={0} max={500} value={ops.scheduling.maxPerSlot} onChange={(e) => setOps("scheduling", { maxPerSlot: Math.max(0, Number(e.target.value) || 0) })} aria-label="Most pre-orders per time" />
                    </Field>
                  </Row>
                ) : null}
                <Note icon={<Clock size={15} />}>
                  A pre-order arrives on the Orders screen at once, tagged with its pickup time. It only turns red as &ldquo;not accepted&rdquo; from an hour before pickup, and its kitchen ticket starts with PRE-ORDER and the time.
                </Note>
              </div>
            ) : (
              <LockedFeature label="Pre-orders" />
            )}
          </Card>

          <Card title="Table bookings" subtitle="Customers book a table online; you confirm, seat and track them on the Bookings page." icon={<CalendarDays size={15} />}>
            {hasFeature("reservations") ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }} data-testid="settings-bookings">
                <Checkbox
                  checked={draft.features.reservations.enabled}
                  onChange={(v) => setFeature("reservations", { enabled: v })}
                  label="Take table bookings online"
                  info="Adds “Book a table” to the storefront header. Bookings follow your opening hours."
                />
                {draft.features.reservations.enabled ? (
                  <>
                    <Row>
                      <Field label="A booking every" style={narrow}>
                        <Select value={draft.reservations.slotMinutes} onChange={(e) => setArea("reservations", { slotMinutes: Number(e.target.value) })} aria-label="Booking time step">
                          {[15, 30, 60].map((m) => <option key={m} value={m}>{m} minutes</option>)}
                        </Select>
                      </Field>
                      <Field label="A table is held for (minutes)" info="How long one booking keeps its seats." style={narrow}>
                        <TextInput type="number" min={30} max={300} value={draft.reservations.durationMinutes} onChange={(e) => setArea("reservations", { durationMinutes: Math.max(30, Number(e.target.value) || 90) })} aria-label="Table held minutes" />
                      </Field>
                      <Field label="Guests seated at one time" info="0 = add up the seats of your tables (Tables page). With no tables and 0, there is no limit." style={narrow}>
                        <TextInput type="number" min={0} max={2000} value={draft.reservations.maxGuestsPerSlot} onChange={(e) => setArea("reservations", { maxGuestsPerSlot: Math.max(0, Number(e.target.value) || 0) })} aria-label="Guests at one time" />
                      </Field>
                    </Row>
                    <Row>
                      <Field label="Smallest party" style={narrow}>
                        <TextInput type="number" min={1} max={20} value={draft.reservations.minPartySize} onChange={(e) => setArea("reservations", { minPartySize: Math.max(1, Number(e.target.value) || 1) })} aria-label="Smallest party" />
                      </Field>
                      <Field label="Largest party online" info="Bigger groups are asked to call you." style={narrow}>
                        <TextInput type="number" min={1} max={50} value={draft.reservations.maxPartySize} onChange={(e) => setArea("reservations", { maxPartySize: Math.max(1, Number(e.target.value) || 10) })} aria-label="Largest party" />
                      </Field>
                      <Field label="Days ahead" style={narrow}>
                        <TextInput type="number" min={0} max={60} value={draft.reservations.maxDaysAhead} onChange={(e) => setArea("reservations", { maxDaysAhead: Math.max(0, Number(e.target.value) || 0) })} aria-label="Booking days ahead" />
                      </Field>
                      <Field label="Book at least (minutes ahead)" style={narrow}>
                        <TextInput type="number" min={0} max={2880} value={draft.reservations.minNoticeMinutes} onChange={(e) => setArea("reservations", { minNoticeMinutes: Math.max(0, Number(e.target.value) || 0) })} aria-label="Minimum notice" />
                      </Field>
                    </Row>
                    <Row>
                      <Field label="Last booking (minutes before closing)" style={narrow}>
                        <TextInput type="number" min={0} max={240} value={draft.reservations.lastBookingBeforeCloseMinutes} onChange={(e) => setArea("reservations", { lastBookingBeforeCloseMinutes: Math.max(0, Number(e.target.value) || 0) })} aria-label="Last booking before closing" />
                      </Field>
                      <Field label="Guests can cancel until (minutes before)" style={narrow}>
                        <TextInput type="number" min={0} max={2880} value={draft.reservations.cancelUntilMinutes} onChange={(e) => setArea("reservations", { cancelUntilMinutes: Math.max(0, Number(e.target.value) || 0) })} aria-label="Cancel until minutes" />
                      </Field>
                    </Row>
                    <Checkbox
                      checked={draft.reservations.autoConfirm}
                      onChange={(v) => setArea("reservations", { autoConfirm: v })}
                      label="Confirm bookings straight away"
                      info="Off: each booking waits on the Bookings page until someone confirms it. On: a booking that fits is confirmed at once."
                    />
                    <Field label="Note for guests (optional)" info="Shown on the booking page, e.g. “We hold your table for 15 minutes.”" style={{ maxWidth: 560 }}>
                      <TextInput value={draft.reservations.guestNote} maxLength={300} onChange={(e) => setArea("reservations", { guestNote: e.target.value })} aria-label="Note for guests" />
                    </Field>
                  </>
                ) : null}
              </div>
            ) : (
              <LockedFeature label="Table reservations" />
            )}
          </Card>
        </>
      ) : null}

      {/* ------------------------------------------------- ratings & suggestions */}

      {tab === "growth" ? (
        <>
          <Card title="Ratings" subtitle="Customers rate completed orders (1–5 stars) from their Account page." icon={<Star size={15} />}>
            {hasFeature("feedback") ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }} data-testid="settings-ratings">
                <Checkbox checked={draft.feedback.enabled} onChange={(v) => setArea("feedback", { enabled: v })} label="Ask customers to rate their orders" />
                <Row>
                  <Field label="Google review link (optional)" info="Paste your “Write a review” link from Google Business Profile. Happy customers are offered it after they rate." style={{ minWidth: 320, flex: "2 1 320px" }}>
                    <TextInput value={draft.feedback.googleReviewUrl} placeholder="https://g.page/r/…/review" onChange={(e) => setArea("feedback", { googleReviewUrl: e.target.value.trim() })} aria-label="Google review link" />
                  </Field>
                  <Field label="Offer it from" style={narrow}>
                    <Select value={draft.feedback.googleMinStars} onChange={(e) => setArea("feedback", { googleMinStars: Number(e.target.value) })} aria-label="Offer Google from stars">
                      {[3, 4, 5].map((n) => <option key={n} value={n}>{n} stars and up</option>)}
                    </Select>
                  </Field>
                </Row>
              </div>
            ) : (
              <LockedFeature label="Ratings & feedback" />
            )}
          </Card>

          <Card title="Goes well with your order" subtitle="Suggestions on the order page — one tap to add." icon={<Sparkles size={15} />}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }} data-testid="settings-upsell">
              <Checkbox checked={draft.upsell.enabled} onChange={(v) => setArea("upsell", { enabled: v })} label="Show suggestions" />
              <Checkbox
                checked={draft.upsell.auto}
                onChange={(v) => setArea("upsell", { auto: v })}
                label="Also suggest what customers often order together"
                info="After the dishes you picked in each dish's “Goes well with”, suggest what other customers most often ordered with what's in the cart (from your last 90 days of orders)."
              />
              <Field label="Heading" style={{ maxWidth: 420 }}>
                <TextInput value={draft.upsell.title} maxLength={60} onChange={(e) => setArea("upsell", { title: e.target.value })} aria-label="Suggestions heading" />
              </Field>
            </div>
          </Card>

          <Card title="Dishes with hours" subtitle="Breakfast, lunch specials… set a dish's or category's hours in the Menu." icon={<Clock size={15} />}>
            <Checkbox
              checked={draft.menuTimes.hideOutsideHours}
              onChange={(v) => setArea("menuTimes", { hideOutsideHours: v })}
              label="Hide dishes outside their hours"
              info="Off: they stay on the menu, greyed, saying when they are available (e.g. “Available 8 AM – 11 AM”). On: they disappear until their hours come round."
            />
          </Card>
        </>
      ) : null}

      {/* --------------------------------------------------------------- wallet */}

      {tab === "wallet" ? (
        <Card title="Coin wallet" subtitle="An in-house cashback loyalty scheme — no third-party platform, no fee per redemption." icon={<Coins size={15} />}>
          {!hasFeature("wallet") ? <LockedFeature label="The coin wallet" note="These settings are kept, but won't apply until it's added to your plan." /> : null}
          <Note icon={<Coins size={15} />}>
            A customer earns coins on what they actually pay, and can spend them against a later order. Coins are only
            credited once an order is <strong>completed</strong> — a cancelled order never pays out — and a redemption
            is refunded automatically if the order it was spent on is later cancelled.
          </Note>

          <Checkbox
            checked={draft.wallet.enabled}
            onChange={(v) => setWallet({ enabled: v })}
            label="Turn on the coin wallet"
            info="With this off, no coins are earned or redeemable anywhere — the storefront hides the wallet entirely."
          />

          {draft.wallet.enabled ? (
            <div style={{ marginTop: 16 }}>
              <Row>
                <Field
                  label="Earn 1 coin per ₹"
                  hint="e.g. 10 = a coin for every ₹10 spent"
                  info="How much of the bill it takes to earn one coin. A lower number rewards faster but costs more — think of it as the cashback rate."
                  style={narrow}
                >
                  <TextInput
                    type="number"
                    min={1}
                    value={draft.wallet.earnRatePaise / 100}
                    onChange={(e) => setWallet({ earnRatePaise: Math.max(1, Math.round((Number(e.target.value) || 0) * 100)) })}
                  />
                </Field>
                <Field
                  label="1 coin is worth ₹"
                  hint="What a coin knocks off a bill when spent"
                  info="The redemption value. Together with the earn rate this sets your effective cashback percentage — e.g. earn 1 coin per ₹10 and redeem it for ₹1 is a 10% cashback scheme."
                  style={narrow}
                >
                  <TextInput
                    type="number"
                    min={0.01}
                    step="0.01"
                    value={draft.wallet.redeemValuePaise / 100}
                    onChange={(e) => setWallet({ redeemValuePaise: Math.max(1, Math.round((Number(e.target.value) || 0) * 100)) })}
                  />
                </Field>
              </Row>
              <Row>
                <Field
                  label="Minimum order to earn (₹)"
                  hint="0 = every order earns something"
                  info="An order below this doesn't earn coins at all — stops a ₹20 side order from generating a token amount of coins."
                  style={narrow}
                >
                  <TextInput
                    type="number"
                    min={0}
                    value={draft.wallet.minOrderToEarn / 100}
                    onChange={(e) => setWallet({ minOrderToEarn: Math.round((Number(e.target.value) || 0) * 100) })}
                  />
                </Field>
                <Field
                  label="Coins can cover up to (%)"
                  hint="Of the item total, before tax"
                  info="Caps how much of a bill coins alone can pay for, so a large stockpile can never zero out an order entirely — the customer always pays something."
                  style={narrow}
                >
                  <TextInput
                    type="number"
                    min={1}
                    max={100}
                    value={draft.wallet.maxRedeemPercent}
                    onChange={(e) => setWallet({ maxRedeemPercent: Math.min(100, Math.max(1, Number(e.target.value) || 1)) })}
                  />
                </Field>
                <Field
                  label="Coins expire after (days)"
                  hint="0 = coins never expire"
                  info="How long an unspent coin stays valid. Expiry isn't enforced automatically yet — this is recorded for a future cleanup job, and today coins stay valid regardless of this setting."
                  style={narrow}
                >
                  <TextInput
                    type="number"
                    min={0}
                    value={draft.wallet.expiryDays}
                    onChange={(e) => setWallet({ expiryDays: Math.max(0, Number(e.target.value) || 0) })}
                  />
                </Field>
              </Row>
            </div>
          ) : null}
        </Card>
      ) : null}

      {/* ------------------------------------------------------------ capacity */}

      {tab === "capacity" ? (
        <>
          <Card
            title="Load management"
            subtitle="Warn customers — or switch delivery off — automatically when the queue gets ahead of you."
            icon={<Gauge size={15} />}
          >
            <Note icon={<Gauge size={15} />}>
              Both triggers below look at orders currently <strong>placed, accepted, or preparing</strong> — the
              queue the kitchen is actually working through right now. Nothing here touches the Delivery switch under
              Features; it only overrides it live, and only while the queue is actually over the line.
            </Note>

            <Checkbox
              checked={draft.capacity.enabled}
              onChange={(v) => setCapacity({ enabled: v })}
              label="Turn on load management"
              info="With this off, none of the thresholds below do anything — the storefront and Orders page behave exactly as if this feature didn't exist."
            />
          </Card>

          {draft.capacity.enabled ? (
            <>
              <Card title="Order volume" subtitle="Based on every open order, whatever channel it came in on." icon={<ListChecks size={15} />}>
                <Row>
                  <Field
                    label="Show 'High Orders' at"
                    hint="orders in the queue"
                    info="Once the queue reaches this many orders, customers see a 'busier than usual' message at checkout — ordering still works normally."
                    style={narrow}
                  >
                    <TextInput
                      type="number"
                      min={1}
                      value={draft.capacity.highOrdersThreshold}
                      onChange={(e) => setCapacity({ highOrdersThreshold: Math.max(1, Number(e.target.value) || 1) })}
                    />
                  </Field>
                  <Field
                    label="Stop new orders at"
                    hint="orders in the queue"
                    info="Once the queue reaches this many orders, delivery is switched off automatically until the queue drops back down. Takeaway and dine-in are not affected."
                    style={narrow}
                  >
                    <TextInput
                      type="number"
                      min={1}
                      value={draft.capacity.stopOrdersThreshold}
                      onChange={(e) => setCapacity({ stopOrdersThreshold: Math.max(1, Number(e.target.value) || 1) })}
                    />
                  </Field>
                </Row>

                <Field
                  label="'High Orders' message"
                  info="Shown to the customer once the queue crosses the first threshold above."
                  style={{ maxWidth: "none" }}
                >
                  <TextInput value={draft.capacity.highOrdersMessage} onChange={(e) => setCapacity({ highOrdersMessage: e.target.value })} />
                </Field>
                <Field
                  label="'Not Accepting Orders' message"
                  info="Shown to the customer once the queue crosses the second threshold above, and delivery switches off."
                  style={{ maxWidth: "none" }}
                >
                  <TextInput value={draft.capacity.stopOrdersMessage} onChange={(e) => setCapacity({ stopOrdersMessage: e.target.value })} />
                </Field>
              </Card>

              <Card title="Delivery riders" subtitle="Based on delivery orders only — a proxy for 'do we have enough riders out'." icon={<Bike size={15} />}>
                <Row>
                  <Field
                    label="Warn at"
                    hint="delivery orders in the queue"
                    info="Once this many delivery orders are queued, customers see a 'limited riders' message at checkout — delivery still works normally."
                    style={narrow}
                  >
                    <TextInput
                      type="number"
                      min={1}
                      value={draft.capacity.deliveryWarnThreshold}
                      onChange={(e) => setCapacity({ deliveryWarnThreshold: Math.max(1, Number(e.target.value) || 1) })}
                    />
                  </Field>
                  <Field
                    label="Disable delivery at"
                    hint="delivery orders in the queue"
                    info="Once this many delivery orders are queued, delivery is switched off automatically — there simply aren't enough riders to take on more."
                    style={narrow}
                  >
                    <TextInput
                      type="number"
                      min={1}
                      value={draft.capacity.deliveryStopThreshold}
                      onChange={(e) => setCapacity({ deliveryStopThreshold: Math.max(1, Number(e.target.value) || 1) })}
                    />
                  </Field>
                </Row>

                <Field
                  label="'Limited riders' message"
                  info="Shown to the customer once delivery orders cross the warn threshold above."
                  style={{ maxWidth: "none" }}
                >
                  <TextInput value={draft.capacity.deliveryWarnMessage} onChange={(e) => setCapacity({ deliveryWarnMessage: e.target.value })} />
                </Field>
                <Field
                  label="'Delivery unavailable' message"
                  info="Shown to the customer once delivery orders cross the disable threshold above, and delivery switches off."
                  style={{ maxWidth: "none" }}
                >
                  <TextInput value={draft.capacity.deliveryStopMessage} onChange={(e) => setCapacity({ deliveryStopMessage: e.target.value })} />
                </Field>
              </Card>
            </>
          ) : null}
        </>
      ) : null}

      {patch.isSuccess && !dirty ? <Toast kind="ok">Settings saved.</Toast> : null}
      {patch.error ? <Toast kind="error">{(patch.error         ).message}</Toast> : null}

      {dirty ? (
        <div style={stickySave}>
          <span style={{ fontSize: 13 }}>You have unsaved changes.</span>
          <Button onClick={save} disabled={patch.isPending} style={{ display: "inline-flex", gap: 7, alignItems: "center" }}>
            <Save size={14} />
            {patch.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      ) : null}
    </>
  );
}

function Row({ children }                         ) {
  return <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>{children}</div>;
}

const narrow                = { maxWidth: 210, flex: "1 1 170px" };
const stickySave                = {
  position: "sticky",
  bottom: 16,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 14,
  padding: "11px 16px",
  borderRadius: 11,
  border: "1px solid var(--color-primary)",
  background: "var(--color-surface)",
  boxShadow: "0 8px 26px rgba(0,0,0,0.18)",
  marginTop: 18,
};

/** In place of a switch the store's plan doesn't include. The owner's saved choice is kept for when it's unlocked. */
function LockedFeature({ label, note }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 13.5, marginBottom: note ? 12 : 0 }}>
      <span style={{ color: "var(--color-text-muted)" }}>{label}</span>
      <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}>
        Not in your plan
      </span>
      {note ? <span style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>{note}</span> : null}
    </div>
  );
}
