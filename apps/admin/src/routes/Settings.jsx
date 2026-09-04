import { useEffect, useState } from "react";
                                                      
                                                                          
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
} from "lucide-react";
import { useOutlet, usePatchConfig } from "../lib/useOutlet";
import { LocationField } from "./settings/LocationField";
import { Button, Card, Checkbox, Field, InfoHint, Note, PageHeader, Select, Tabs, TextInput, Toast } from "../ui";

                                                                                                                    

const IDENTITY_FIELDS                                                                              = [
  {
    key: "name",
    label: "Restaurant name",
    info: "The name customers see — on the website, at the top of every receipt, and in order confirmations. Changing it here changes it everywhere.",
  },
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
  const patch = usePatchConfig();
  const [tab, setTab] = useState     ("business");
  const [draft, setDraft] = useState                     (null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (outlet && !draft) setDraft(outlet.config);
  }, [outlet, draft]);

  if (!outlet || !draft) {
    return (
      <>
        <PageHeader title="Settings" />
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
          { id: "wallet", label: "Coin wallet", icon: <Coins size={14} /> },
          { id: "capacity", label: "Load management", icon: <Gauge size={14} /> },
        ]}
      />

      {/* ------------------------------------------------------------ business */}

      {tab === "business" ? (
        <>
          <Card title="Business identity" subtitle="Used on the storefront, on receipts, and on tax invoices.">
            {IDENTITY_FIELDS.map((f) => (
              <Field key={f.key} label={f.label} hint={f.hint} info={f.info}>
                <TextInput value={String(draft.identity[f.key] ?? "")} onChange={(e) => setIdentity(f.key, e.target.value)} />
              </Field>
            ))}
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
              knows, and the first sign of trouble is a complaint. These limits turn that into a warning on the Orders
              screen. The warning never blocks the list; staff can keep working straight through it.
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
                      label="Start cooking within (minutes)"
                      hint="Accepted → preparing"
                      info="An order can be accepted and then forgotten before anyone actually starts it. This catches that gap."
                      style={narrow}
                    >
                      <TextInput type="number" min={1} max={240} value={ops.sla.startMinutes} onChange={(e) => setOps("sla", { startMinutes: Number(e.target.value) || 1 })} />
                    </Field>
                  </Row>
                  <Row>
                    <Field
                      label="Finish cooking within (minutes)"
                      hint="Preparing → ready"
                      info="How long the food may be in preparation before the kitchen counts as running late. Set it a little above your genuine worst case, or it will cry wolf during every rush."
                      style={narrow}
                    >
                      <TextInput type="number" min={1} max={240} value={ops.sla.prepMinutes} onChange={(e) => setOps("sla", { prepMinutes: Number(e.target.value) || 1 })} />
                    </Field>
                    <Field
                      label="Hand over within (minutes)"
                      hint="Ready → collected"
                      info="How long finished food may sit on the pass. This is the one that stops a hot order going cold because nobody carried it out."
                      style={narrow}
                    >
                      <TextInput type="number" min={1} max={240} value={ops.sla.handoverMinutes} onChange={(e) => setOps("sla", { handoverMinutes: Number(e.target.value) || 1 })} />
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
              <Checkbox
                checked={draft.features.ordering.takeaway}
                onChange={(v) => setFeature("ordering", { takeaway: v })}
                label="Takeaway from the website"
                info="Customers order online and collect. Turning it off hides the ordering flow on the storefront but leaves the menu readable."
              />
              <Checkbox
                checked={draft.features.ordering.dineInQr}
                onChange={(v) => setFeature("ordering", { dineInQr: v })}
                label="Dine-in QR ordering"
                info="Diners scan the code on their table and order from their seat. Needs tables and their QR codes set up on the Tables page first."
              />
              <Checkbox
                checked={draft.features.ordering.delivery}
                onChange={(v) => setFeature("ordering", { delivery: v })}
                label="Delivery"
                info="Your own delivery, priced with the delivery settings under Kitchen & delivery. Aggregator orders arrive through their own integration and are not affected by this."
              />
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
              <Checkbox
                checked={draft.features.ui.announcementBar}
                onChange={(v) => setFeature("ui", { announcementBar: v })}
                label="Announcement bar"
                info="A strip across the top of the storefront for a message everyone should see — a festival special, or a day you're closed."
              />
              <Checkbox
                checked={draft.features.reservations.enabled}
                onChange={(v) => setFeature("reservations", { enabled: v })}
                label="Table reservations"
                info="Lets customers book a table in advance. The booking screens are not built yet, so this currently only marks the outlet as wanting them."
              />
            </div>
          </Card>
        </>
      ) : null}

      {/* --------------------------------------------------------------- wallet */}

      {tab === "wallet" ? (
        <Card title="Coin wallet" subtitle="An in-house cashback loyalty scheme — no third-party platform, no fee per redemption." icon={<Coins size={15} />}>
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
