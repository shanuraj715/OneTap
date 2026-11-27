import { useState } from "react";
import { Linking, RefreshControl, ScrollView, View } from "react-native";
import type { Order } from "@/api/schemas";
import { canDeleteOrders, canPrintOrders, canUpdateOrders } from "@/auth/permissions";
import { useDeleteOrder, useOrders, useTables } from "@/data/hooks";
import { actionIcon, actionLabel, addressLine, canCancelStatus, CHANNEL_ICON, channelLabel, forwardStatusesFor, historyNote, paymentLabel, paymentMethodLabel, statusIcon, statusLabelFor, statusSince, statusTone } from "@/features/orders";
import { useLayout } from "@/lib/layout";
import { formatMoney } from "@/lib/money";
import { clock, elapsed } from "@/lib/time";
import { useNow } from "@/lib/useNow";
import { useSession } from "@/runtime";
import { Badge, Button, Card, ConfirmDialog, Divider, EmptyState, ErrorState, FoodMark, Icon, IconTile, LoadingBlock, SectionTitle, Text, toasts, useTheme, type IconName } from "@/ui";
import { ManualStatusSheet } from "./orders/ManualStatusSheet";
import { PrintSheet } from "./orders/PrintSheet";
import { useOrderActions } from "./orders/useOrderActions";
import { messageOf } from "./orders/useStatusChange";

/** "9811122233" → "919811122233" (WhatsApp wants the country code; a 10-digit Indian number gets 91). */
export const whatsappNumber = (raw: string): string => { const d = raw.replace(/\D/g, ""); return d.length === 10 ? `91${d}` : d; };
export const dialNumber = (raw: string): string => `tel:${raw.trim().startsWith("+") ? "+" : ""}${raw.replace(/\D/g, "")}`;
const open = (url: string) => Linking.openURL(url).catch(() => toasts.error("Can't open that on this phone."));

const dateTime = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? "" : `${d.getDate()} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()]}, ${clock(iso)}`; };

function Fact({ icon, label, value, tone }: { icon: IconName; label: string; value: string; tone?: "warning" | "success" | "danger" }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }} accessible accessibilityLabel={`${label}: ${value}`}>
      <View style={{ paddingTop: 2 }}><Icon name={icon} size={16} color={c.muted} /></View>
      <Text tone="muted" style={{ width: 92 }}>{label}</Text>
      <Text style={{ flex: 1 }} tone={tone ?? "default"}>{value}</Text>
    </View>
  );
}

/**
 * One order, in full — everything the store dashboard's Orders page shows and does: who it is for, where it is going, what is in it and what
 * it costs, how it is paid, how it got here; and the buttons: the next step, cancel, set a status by hand, the rider, edit, print, delete.
 * A button the signed-in person may not use is not shown (the server checks again whatever the app does).
 */
export function OrderDetail({ orderId, onEdit, onOpenTable, onGone }: { orderId: string; onEdit: (orderId: string) => void; onOpenTable: (tableId: string) => void; onGone: () => void }) {
  const { c } = useTheme();
  const layout = useLayout();
  const user = useSession((s) => s.user);
  const mayUpdate = canUpdateOrders(user), mayDelete = canDeleteOrders(user), mayPrint = canPrintOrders(user);
  const ordersQ = useOrders();
  const tablesQ = useTables();
  const now = useNow(30_000);
  const actions = useOrderActions();
  const del = useDeleteOrder();
  const [byHand, setByHand] = useState<Order | null>(null);
  const [printing, setPrinting] = useState<Order | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [pulling, setPulling] = useState(false);

  const order = ordersQ.data?.find((o) => o.id === orderId);
  const table = order?.tableId ? tablesQ.data?.find((t) => t.id === order.tableId) : undefined;
  async function refresh() { setPulling(true); try { await Promise.all([ordersQ.refetch(), tablesQ.refetch()]); } finally { setPulling(false); } }

  if (ordersQ.isLoading) return <LoadingBlock label="Loading order…" />;
  if (ordersQ.isError && !ordersQ.data) return <ErrorState error={ordersQ.error} onRetry={() => void refresh()} title="Can't load this order" />;
  if (!order) return <EmptyState icon="receipt" title="Order not found" message="It may have been deleted. Go back to the orders." />;

  const o = order;
  const paid = o.payment.status === "paid";
  const forward = mayUpdate ? forwardStatusesFor(o.status, o.channel) : [];
  const finished = o.status === "completed" || o.status === "cancelled";
  const label = statusLabelFor(o.status, o.channel);
  const phone = o.customer?.phone ?? "";
  const t = o.totals;
  const taxLine = t.cgst || t.sgst ? `CGST ${formatMoney(t.cgst ?? 0)} + SGST ${formatMoney(t.sgst ?? 0)}` : formatMoney(t.taxAmount);

  async function remove() {
    try { await del.mutateAsync(o.id); toasts.ok(`Order #${o.orderNumber} was deleted`); setDeleting(false); onGone(); } catch (e) { toasts.error(messageOf(e)); setDeleting(false); }
  }

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 14, width: "100%", maxWidth: layout.contentMaxWidth, alignSelf: "center" }} refreshControl={<RefreshControl refreshing={pulling} onRefresh={() => void refresh()} colors={[c.primary]} />} testID="order-detail">
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <IconTile icon={CHANNEL_ICON[o.channel] ?? "receipt"} tone="primary" />
          <Text variant="title" accessibilityRole="header">Order #{o.orderNumber}</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <Badge label={label} tone={statusTone(o.status)} icon={statusIcon(o.status)} />
          <Badge label={paymentLabel(o.payment.status)} tone={paid ? "ok" : o.payment.status === "failed" ? "danger" : "warn"} icon={paid ? "check-circle" : "wallet"} />
          <Badge label={channelLabel(o.channel)} tone="neutral" icon={CHANNEL_ICON[o.channel]} />
        </View>
        {!finished ? <Text tone="muted" testID="in-status">{label} for {elapsed(statusSince(o), now) || "a moment"} · placed {clock(o.createdAt)}</Text> : <Text tone="muted">Placed {dateTime(o.createdAt)}</Text>}
      </View>

      {mayUpdate && !finished ? (
        <View style={{ gap: 10 }} testID="order-actions">
          {forward.map((to) => <Button key={to} title={actionLabel(to, o.channel)} icon={actionIcon(to)} size="lg" fullWidth variant={forward.indexOf(to) === 0 ? "primary" : "outline"} loading={actions.busy} onPress={() => actions.advance(o, to)} testID={`advance-${to}`} />)}
          <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
            {canCancelStatus(o.status) ? <Button title="Cancel order" icon="x-circle" variant="outline" onPress={() => actions.advance(o, "cancelled")} testID="cancel-order" style={{ flexGrow: 1 }} /> : null}
            <Button title="Set status…" icon="swap" variant="outline" onPress={() => setByHand(o)} testID="set-status" style={{ flexGrow: 1 }} />
          </View>
        </View>
      ) : null}

      <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
        {mayUpdate && finished ? <Button title="Set status…" icon="swap" variant="outline" onPress={() => setByHand(o)} testID="set-status" style={{ flexGrow: 1 }} /> : null}
        {mayUpdate && o.channel === "delivery" && o.status !== "cancelled" ? <Button title={o.rider ? "Change rider" : "Assign rider"} icon="bike" variant="outline" onPress={() => actions.changeRider(o)} testID="change-rider" style={{ flexGrow: 1 }} /> : null}
        {mayUpdate && o.status !== "cancelled" ? <Button title="Edit order" icon="pencil" variant="outline" onPress={() => onEdit(o.id)} testID="edit-order" style={{ flexGrow: 1 }} /> : null}
        {mayPrint ? <Button title="Print" icon="printer" variant="outline" onPress={() => setPrinting(o)} testID="print-order" style={{ flexGrow: 1 }} /> : null}
        {o.tableId ? <Button title={table ? `Open table ${table.number}` : "Open table"} icon="table" variant="outline" onPress={() => onOpenTable(o.tableId!)} testID="open-table" style={{ flexGrow: 1 }} /> : null}
      </View>

      <Card style={{ gap: 10 }}>
        <SectionTitle icon="info" title="Order details" />
        <Fact icon={CHANNEL_ICON[o.channel] ?? "receipt"} label="Type" value={channelLabel(o.channel)} />
        <Fact icon="user" label="Placed by" value={o.placedBy === "staff" ? `Staff${o.staffName ? ` — ${o.staffName}` : ""}` : "The customer"} />
        <Fact icon="clock" label="Placed at" value={dateTime(o.createdAt)} />
        {o.scheduledFor ? <Fact icon="calendar" label="Pre-order for" value={dateTime(o.scheduledFor)} tone="warning" /> : null}
        {o.etaMinutes && !o.scheduledFor ? <Fact icon="clock" label="Quoted time" value={`${o.etaMinutes} min`} /> : null}
        {o.tableId ? <Fact icon="table" label="Table" value={table ? `${table.number}${table.zone ? ` · ${table.zone}` : ""}` : "(removed)"} /> : null}
        {o.couponCode ? <Fact icon="tag" label="Coupon" value={o.couponCode} /> : null}
        {o.channel === "delivery" ? <Fact icon="bike" label="Rider" value={o.rider ? `${o.rider.name}${o.rider.phone ? ` · ${o.rider.phone}` : ""}` : "Not assigned yet"} tone={o.rider ? undefined : "warning"} /> : null}
      </Card>

      {o.customer?.name || phone || o.customer?.email ? (
        <Card style={{ gap: 10 }} testID="customer-card">
          <SectionTitle icon="user" title="Customer" />
          {o.customer?.name ? <Fact icon="user" label="Name" value={o.customer.name} /> : null}
          {phone ? <Fact icon="phone" label="Phone" value={phone} /> : null}
          {o.customer?.email ? <Fact icon="mail" label="Email" value={o.customer.email} /> : null}
          {phone ? (
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Button title="Call" icon="phone" variant="outline" onPress={() => void open(dialNumber(phone))} testID="call-customer" style={{ flexGrow: 1 }} />
              <Button title="WhatsApp" icon="note" variant="outline" onPress={() => void open(`https://wa.me/${whatsappNumber(phone)}`)} testID="whatsapp-customer" style={{ flexGrow: 1 }} />
            </View>
          ) : null}
        </Card>
      ) : null}

      {o.channel === "delivery" && o.deliveryAddress ? (
        <Card style={{ gap: 10 }} testID="address-card">
          <SectionTitle icon="pin" title="Delivery address" />
          <Text>{addressLine(o.deliveryAddress)}</Text>
          {o.deliveryAddress.distanceKm != null ? <Text tone="muted">{o.deliveryAddress.distanceKm} km from the outlet</Text> : null}
          {o.deliveryAddress.lat != null && o.deliveryAddress.lng != null ? (
            <Button title="Open in Maps" icon="external" variant="outline" onPress={() => void open(`https://www.google.com/maps/search/?api=1&query=${o.deliveryAddress!.lat},${o.deliveryAddress!.lng}`)} testID="open-maps" />
          ) : null}
        </Card>
      ) : null}

      <Card style={{ gap: 10 }} testID="payment-card">
        <SectionTitle icon="wallet" title="Payment" />
        <Fact icon="wallet" label="Method" value={paymentMethodLabel(o.payment.gateway)} />
        <Fact icon={paid ? "check-circle" : "clock"} label="Status" value={paymentLabel(o.payment.status)} tone={paid ? "success" : o.payment.status === "failed" ? "danger" : "warning"} />
        {o.payment.paymentId ? <Fact icon="hash" label="Reference" value={o.payment.paymentId} /> : null}
      </Card>

      <Card style={{ gap: 10 }} testID="items-card">
        <SectionTitle icon="utensils" title={`Items (${o.lines.reduce((n, l) => n + l.quantity, 0)})`} />
        {o.lines.map((l, i) => (
          <View key={`${l.itemId}-${i}`} style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ paddingTop: 3 }}><FoodMark type={l.foodType} size={13} /></View>
            <Text variant="label" style={{ minWidth: 26 }}>{l.quantity}×</Text>
            <View style={{ flex: 1 }}>
              <Text>{l.name}{l.variantLabel ? ` · ${l.variantLabel}` : ""}</Text>
              {l.modifiers.length ? <Text variant="caption" tone="muted">{l.modifiers.map((m) => m.label).join(", ")}</Text> : null}
              {l.note ? <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}><Icon name="note" size={12} color={c.warning} /><Text variant="caption" tone="warning" style={{ flexShrink: 1 }}>{l.note}</Text></View> : null}
            </View>
            <Text tone="muted">{formatMoney(l.lineTotal)}</Text>
          </View>
        ))}
        {o.note ? <View style={{ flexDirection: "row", alignItems: "center", gap: 6, padding: 10, borderRadius: 10, backgroundColor: c.warningWash }}><Icon name="note" size={14} color={c.warning} /><Text tone="warning" style={{ flex: 1 }}>{o.note}</Text></View> : null}
        <Divider />
        <View style={{ gap: 4 }} testID="totals">
          <Row label="Subtotal" value={formatMoney(t.subtotal)} />
          {t.discount ? <Row label={o.couponCode ? `Discount (${o.couponCode})` : "Discount"} value={`−${formatMoney(t.discount)}`} /> : null}
          {t.coinsDiscount ? <Row label="Coins used" value={`−${formatMoney(t.coinsDiscount)}`} /> : null}
          {t.deliveryFee ? <Row label="Delivery fee" value={formatMoney(t.deliveryFee)} /> : null}
          {t.taxAmount ? <Row label={o.pricesIncludeTax ? "Tax (included)" : "Tax"} value={taxLine} /> : null}
          {t.serviceCharge ? <Row label="Service charge" value={formatMoney(t.serviceCharge)} /> : null}
          {t.roundOff ? <Row label="Round off" value={formatMoney(t.roundOff)} /> : null}
          <Row label="Total" value={formatMoney(t.grandTotal)} strong />
        </View>
      </Card>

      {o.statusHistory.length ? (
        <Card style={{ gap: 10 }} testID="history-card">
          <SectionTitle icon="history" title="History" />
          {o.statusHistory.map((h, i) => {
            const note = historyNote(h);
            return (
              <View key={`${h.status}-${h.at}-${i}`} style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                <View style={{ paddingTop: 1 }}><Icon name={h.edited ? "pencil" : statusIcon(h.status)} size={16} color={h.manual ? c.warning : c.muted} /></View>
                <View style={{ flex: 1 }}>
                  <Text variant="label">{h.edited ? "Edited" : statusLabelFor(h.status, o.channel)}</Text>
                  {note ? <Text variant="caption" tone="muted">{note}</Text> : null}
                </View>
                <Text variant="caption" tone="muted">{dateTime(h.at)}</Text>
              </View>
            );
          })}
        </Card>
      ) : null}

      {mayDelete ? <Button title="Delete this order…" icon="trash" variant="ghost" onPress={() => setDeleting(true)} testID="delete-order" /> : null}

      {actions.dialogs}
      <ManualStatusSheet order={byHand} busy={actions.busy} onClose={() => setByHand(null)} onApply={actions.setByHand} />
      <PrintSheet order={printing} onClose={() => setPrinting(null)} />
      <ConfirmDialog
        visible={deleting}
        title={`Delete order #${o.orderNumber}?`}
        message="It disappears from the orders list and from the reports. Coins it used or earned are put right. An order paid online must be refunded first."
        confirmLabel="Delete order"
        destructive
        icon="trash"
        loading={del.isPending}
        onConfirm={() => void remove()}
        onCancel={() => setDeleting(false)}
      />
    </ScrollView>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
      <Text tone={strong ? "default" : "muted"} variant={strong ? "subheading" : "body"}>{label}</Text>
      <Text variant={strong ? "subheading" : "body"} tone={strong ? "default" : "muted"}>{value}</Text>
    </View>
  );
}
