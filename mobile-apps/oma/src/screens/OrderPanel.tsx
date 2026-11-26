import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import { ApiError } from "@/api/client";
import type { CustomerHit, Session, Table } from "@/api/schemas";
import { cleanPhone, countOf, estimateOf, phoneProblem, toCartInput, type Draft } from "@/cart/cart";
import { useCustomerSearch, usePlaceOrder, useQuoteQuery } from "@/data/hooks";
import { useDebounced } from "@/lib/useDebounced";
import { formatMoney } from "@/lib/money";
import { useRuntime } from "@/runtime";
import { Banner, Button, Card, Divider, EmptyState, Icon, IconTile, SectionTitle, Spinner, Stepper, Text, TextField, toasts, useTheme } from "@/ui";

const NO_DRAFT: Draft = { lines: [], name: "", phone: "", note: "" };

/**
 * The order about to be sent: what is in it (with + and −), who it is for, the server's price, and the Send button.
 *
 * Safety rule: the order is sent together with the party the waiter SAW at this table when the screen opened. If somebody else was
 * seated there meanwhile, the server refuses (409) and this panel stops: it never quietly adds the order to a stranger's bill.
 */
export interface PanelParts { /** what is in the order, who it is for, the price */ body: ReactNode; /** the Send button and the messages about it — meant to stay pinned in view */ footer: ReactNode }

export function OrderPanel({ table, session, draft, seenSessionId, quoteEnabled, onSent, onLeave, children }: {
  table: Table;
  session: Session | undefined;
  draft: Draft | undefined;
  /** the party at the table when the waiter opened this screen (null = it was free) */
  seenSessionId: string | null;
  /** only ask the server for a price while the panel is actually on screen */
  quoteEnabled: boolean;
  onSent: () => void;
  onLeave: () => void;
  /** the layout decides where the two parts go: a bottom sheet pins the footer, the wide tablet's side panel scrolls both */
  children: (parts: PanelParts) => ReactNode;
}) {
  const { drafts } = useRuntime();
  const d = draft ?? NO_DRAFT;
  const place = usePlaceOrder();
  const [conflict, setConflict] = useState<string | null>(null);
  const [failed, setFailed] = useState<{ text: string; at: string } | null>(null);
  const [phoneShown, setPhoneShown] = useState(false);
  const { c } = useTheme();
  // customers the typed digits match (the same list the dashboard's Take order shows under the mobile box)
  const [pickedDigits, setPickedDigits] = useState<string | null>(null);
  const sent = useRef(false);

  const needsPhone = !session; // a first order at a free table needs the customer's number; later orders go on the party's bill
  const phoneError = needsPhone ? phoneProblem(d.phone) : null;
  const cart = toCartInput(d);
  const quote = useQuoteQuery(cart, { tableId: table.id, phone: needsPhone && !phoneError ? cleanPhone(d.phone) : undefined, enabled: quoteEnabled });
  const quoteError = quote.error instanceof ApiError ? quote.error : null;
  const count = countOf(d);
  const typed = d.phone.replace(/\D/g, "").slice(0, 10);
  const asked = useDebounced(typed, 250);
  const hitsQ = useCustomerSearch(asked, needsPhone && asked !== pickedDigits);
  // a FULL number (10 digits) that matches exactly ONE customer is that customer: no list, the name fills itself
  const sole = needsPhone && typed.length >= 10 && asked === typed && hitsQ.data ? (hitsQ.data.filter((h) => h.phone.replace(/\D/g, "").slice(-10) === typed).length === 1 ? hitsQ.data.find((h) => h.phone.replace(/\D/g, "").slice(-10) === typed) ?? null : null) : null;
  const hits = needsPhone && asked.length >= 3 && asked === typed && asked !== pickedDigits && !sole ? (hitsQ.data ?? []) : [];
  const filledFor = useRef<string | null>(null);
  useEffect(() => {
    if (!sole) return;
    const key = `${table.id}:${sole.id}`;
    if (filledFor.current === key) return; // once per number: clearing the name afterwards stays cleared
    filledFor.current = key;
    // only an EMPTY name box is filled: what the waiter has typed is never overwritten
    if (sole.name && !drafts.getState().draftFor(table.id).name.trim()) drafts.getState().setCustomer(table.id, { name: sole.name });
  }, [sole, table.id, drafts]);
  const pick = (hit: CustomerHit) => {
    drafts.getState().setCustomer(table.id, { phone: hit.phone, name: hit.name ?? "" });
    setPickedDigits(hit.phone.replace(/\D/g, "").slice(0, 10));
  };

  // a failed send is explained until the order or the number is changed
  const stamp = `${d.lines.length}|${d.phone}`;
  const problem = failed && failed.at === stamp ? failed.text : null;

  async function send() {
    setPhoneShown(true);
    if (phoneError || count === 0 || sent.current) return;
    sent.current = true;
    setFailed(null);
    try {
      const { order } = await place.mutateAsync({
        tableId: table.id,
        cart,
        ...(needsPhone ? { phone: cleanPhone(d.phone) } : {}),
        ...(d.name.trim() ? { name: d.name.trim() } : {}),
        ...(d.note.trim() ? { note: d.note.trim() } : {}),
        expectedSessionId: seenSessionId,
      });
      drafts.getState().clear(table.id);
      toasts.ok(`Order ${order.orderNumber} sent to the kitchen`);
      onSent();
    } catch (e) {
      sent.current = false;
      if (e instanceof ApiError && e.status === 409 && e.code === "table_taken") setConflict(e.message);
      else setFailed({ text: e instanceof Error ? e.message : "Couldn't send the order. Please try again.", at: stamp });
    }
  }

  if (conflict) {
    return children({ footer: null, body: (
      <View style={{ gap: 12 }} testID="order-conflict">
        <Banner tone="danger" title="Order not sent" message={`${conflict} Nothing was added to their bill.`} />
        <Text tone="muted">Your order for table {table.number} is still saved on this phone. Go back to the tables to see who is there.</Text>
        <Button title="Back to the tables" fullWidth onPress={onLeave} testID="conflict-back" />
        <Button title="Discard this order" variant="ghost" fullWidth onPress={() => { drafts.getState().clear(table.id); onLeave(); }} testID="conflict-discard" />
      </View>
    ) });
  }

  if (count === 0) return children({ footer: null, body: <EmptyState icon="bag" title="Nothing in the order yet" message="Add dishes from the menu." /> });

  const totals = quote.data?.totals;
  const busy = place.isPending;
  const blocked = !!quoteError && quoteError.status === 409; // e.g. a dish sold out

  const body = (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 10 }}>
        {d.lines.map((l) => (
          <View key={l.key} style={{ flexDirection: "row", alignItems: "center", gap: 10 }} testID={`line-${l.itemId}`}>
            <View style={{ flex: 1 }}>
              <Text variant="subheading" numberOfLines={2}>{l.name}{l.variantLabel ? ` · ${l.variantLabel}` : ""}</Text>
              {l.modifierLabels.length ? <Text variant="caption" tone="muted">{l.modifierLabels.join(", ")}</Text> : null}
              {l.note ? <Text variant="caption" tone="muted">Note: {l.note}</Text> : null}
              <Text variant="caption" tone="muted">{formatMoney(l.unitPrice)} each</Text>
            </View>
            <Stepper label={l.name} value={l.quantity} min={0} onChange={(q) => drafts.getState().setQty(table.id, l.key, q)} />
          </View>
        ))}
      </View>

      <Divider />

      {session ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <IconTile icon="user" tone="info" size={36} />
          <Text tone="muted" style={{ flex: 1 }}>Adding to the bill of <Text variant="label">{session.customerName || session.customerPhone || "the party"}</Text> at table {table.number}.</Text>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          <TextField label="Customer's mobile number" value={d.phone} onChangeText={(t) => drafts.getState().setCustomer(table.id, { phone: t })} keyboardType="phone-pad" leftIcon="phone" maxLength={20} error={phoneShown ? phoneError : null} helper={sole ? undefined : hits.length === 0 && typed.length >= 3 && !hitsQ.isFetching && hitsQ.data && !pickedDigits ? "New customer — no earlier visit with this number." : undefined} testID="order-phone" />
          {sole ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }} testID="customer-found" accessibilityLiveRegion="polite">
              <Icon name="check-circle" size={18} color={c.success} />
              <Text variant="caption" tone="success" style={{ flex: 1 }}>Existing customer{sole.name ? `: ${sole.name}` : ""}{sole.visits ? ` · ${sole.visits} ${sole.visits === 1 ? "visit" : "visits"}` : ""}</Text>
            </View>
          ) : null}
          {hits.length > 0 ? (
            <Card style={{ padding: 0, overflow: "hidden" }} testID="customer-hits">
              <Text variant="caption" tone="muted" style={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 }}>Customers with this number — tap to fill</Text>
              {hits.map((h) => (
                <Pressable key={h.id} testID={`customer-hit-${h.phone}`} accessibilityRole="button" accessibilityLabel={`${h.name ?? "No name"}, ${h.phone}${h.visits ? `, ${h.visits} ${h.visits === 1 ? "visit" : "visits"}` : ""}`} onPress={() => pick(h)} android_ripple={{ color: "rgba(0,0,0,0.08)" }} style={{ minHeight: 52, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, borderTopWidth: 1, borderTopColor: c.border }}>
                  <Icon name="user" size={18} color={c.muted} />
                  <View style={{ flex: 1 }}>
                    <Text variant="subheading" numberOfLines={1}>{h.name ?? "No name saved"}</Text>
                    <Text variant="caption" tone="muted">{h.phone}{h.visits ? ` · ${h.visits} ${h.visits === 1 ? "visit" : "visits"}` : ""}</Text>
                  </View>
                </Pressable>
              ))}
            </Card>
          ) : null}
          <TextField label="Customer's name (optional)" leftIcon="user" value={d.name} onChangeText={(t) => drafts.getState().setCustomer(table.id, { name: t })} maxLength={60} autoCapitalize="words" testID="order-name" />
        </View>
      )}
      <TextField label="Note for the whole order (optional)" leftIcon="note" value={d.note} onChangeText={(t) => drafts.getState().setCustomer(table.id, { note: t })} maxLength={200} multiline testID="order-note" />

      <Divider />

      <View style={{ gap: 4 }} testID="order-totals">
        {totals ? (
          <>
            <SectionTitle icon="receipt" title="Bill" />
            <Row label="Items" value={formatMoney(totals.subtotal)} />
            {totals.discount > 0 ? <Row label="Discount" value={`−${formatMoney(totals.discount)}`} /> : null}
            {totals.taxAmount > 0 ? <Row label={quote.data?.pricesIncludeTax ? "Tax (included)" : "Tax"} value={formatMoney(totals.taxAmount)} /> : null}
            {totals.serviceCharge > 0 ? <Row label="Service charge" value={formatMoney(totals.serviceCharge)} /> : null}
            {totals.roundOff !== 0 ? <Row label="Round off" value={formatMoney(totals.roundOff)} /> : null}
            <Row label="Total" value={formatMoney(totals.grandTotal)} strong testID="order-total" />
          </>
        ) : quote.isError ? (
          <Row label="Estimate (before tax)" value={formatMoney(estimateOf(d))} testID="order-total" />
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text tone="muted">Working out the total…</Text>
            {quoteEnabled ? <Spinner size={18} label="Working out the total" /> : <Text variant="subheading" testID="order-total">{formatMoney(estimateOf(d))}</Text>}
          </View>
        )}
      </View>
    </View>
  );

  const footer = (
    <>
      {quoteError ? <Banner tone={blocked ? "danger" : "warn"} message={blocked ? `${quoteError.message}. Take it out of the order to continue.` : quoteError.message} testID="quote-error" /> : null}
      {problem ? <Banner tone="danger" message={problem} testID="send-error" /> : null}

      <Button title={busy ? "Sending…" : `Send to kitchen${totals ? ` · ${formatMoney(totals.grandTotal)}` : ""}`} size="lg" fullWidth icon="pot" loading={busy} disabled={blocked} onPress={() => void send()} testID="send-order" />
    </>
  );

  return children({ body, footer });
}

function Row({ label, value, strong, testID }: { label: string; value: string; strong?: boolean; testID?: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <Text variant={strong ? "subheading" : "body"} tone={strong ? "default" : "muted"}>{label}</Text>
      <Text variant={strong ? "heading" : "body"} testID={testID}>{value}</Text>
    </View>
  );
}
