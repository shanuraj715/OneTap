import {
  DASHBOARD_WIDGET_CATALOG,
  formatINR,
  ORDER_STATUS_LABELS,
  visibleWidgetsFor,
} from "@rasoipulse/config-schema";
import {
  AlertTriangle,
  ArrowRight,
  BellOff,
  CalendarCheck,
  CheckCircle2,
  CreditCard,
  PackageX,
  RefreshCw,
  Star,
  Truck,
} from "lucide-react";
import { BarChart, DonutChart, HBarList, LineChart, Sparkline, tint } from "../charts";
import { FALLBACK_LOOK, WIDGET_LOOK } from "../lib/dashboardLook";
import { Link } from "../lib/nav";
import { useAuth } from "../lib/useAuth";
import { useMedia } from "../lib/useMedia";
import { useDashboardStats } from "../lib/useDashboard";
import { useOutlet } from "../lib/useOutlet";
import { useStorePlan } from "../lib/useStorePlan";
import { AwesomeLoader, Card, Empty, InfoHint, PageHeader, Pill, Table, Td, Th, Toast } from "../ui";

const CHANNEL_LABEL = { takeaway: "Takeaway", "dine-in": "Dine-in", delivery: "Delivery" };

/** "Good morning, Asha" — from the viewer's own clock, so it is right wherever they sit. */
function greeting(name) {
  const h = new Date().getHours();
  const part = h < 5 ? "Good evening" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  const first = String(name ?? "").trim().split(/\s+/)[0];
  return first ? `${part}, ${first}` : part;
}

export function Dashboard() {
  const { outlet, isLoading } = useOutlet();
  const { user } = useAuth();
  const planInfo = useStorePlan();
  const stats = useDashboardStats(outlet, true);
  // 3 columns on a tablet or computer, 2 on a phone (the small number cards sit two to a row; wide widgets take the full row)
  const phone = useMedia("(max-width: 599px)");

  if (!isLoading && !outlet) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <Card title="No outlet yet">
          <p style={{ color: "var(--color-text-muted)", marginTop: 0 }}>
            {user?.isSuperAdmin
              ? "No brand or outlet exists yet for this account to manage."
              : "Your account isn't attached to a brand or outlet yet. Ask your Rasoi Pulse superadmin."}
          </p>
        </Card>
      </>
    );
  }
  if (!outlet) return null;

  // what this person sees: the widgets switched on for their role, that the role may read, and that the store's plan includes
  const widgets = visibleWidgetsFor(outlet.config.dashboard, user?.role ?? null, planInfo.plan ? planInfo.plan.entitlements.features : undefined);
  const s = stats.data;

  return (
    <>
      <PageHeader title="Dashboard" subtitle={outlet.name} />

      {stats.isLoading || planInfo.loading ? (
        <Card>
          <AwesomeLoader compact label="Loading dashboard metrics…" />
        </Card>
      ) : stats.error ? (
        <Card>
          <Toast kind="error">{stats.error.message}</Toast>
        </Card>
      ) : !widgets.length ? (
        <Card>
          <Empty title="Nothing to show here yet">
            {user?.role
              ? "Your role isn't set to see any dashboard widgets. Ask an owner or manager to check Settings → Dashboard."
              : "Sign in to see the dashboard."}
          </Empty>
        </Card>
      ) : (
        <>
          <Hello name={user?.name} updatedAt={stats.dataUpdatedAt} fetching={stats.isFetching} onRefresh={() => stats.refetch()} />
          <Attention widgets={widgets} s={s} />
          <div style={{ ...grid, gridTemplateColumns: `repeat(${phone ? 2 : 3}, minmax(0, 1fr))`, gap: phone ? 10 : 16 }} data-testid="dashboard-grid">
            {widgets.map((w) => (
              <WidgetFrame key={w.id} id={w.id} cols={phone ? 2 : 3} s={s} phone={phone} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

/* ----------------------------------------------------------- hello + alerts */

function Hello({ name, updatedAt, fetching, onRefresh }) {
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
  const at = updatedAt ? new Date(updatedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : "";
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap", margin: "2px 0 14px" }} data-testid="dashboard-hello">
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: "var(--font-heading)", fontSize: "clamp(18px, 4.6vw, 22px)", fontWeight: 700, lineHeight: 1.2 }}>{greeting(name)}</div>
        <div style={{ color: "var(--color-text-muted)", fontSize: 13, marginTop: 3 }}>{today} — here is how the day is going.</div>
      </div>
      <button type="button" onClick={onRefresh} disabled={fetching} className="ot-press" style={refreshBtn} aria-label="Refresh the numbers">
        <RefreshCw size={13} className={fetching ? "ot-spin" : undefined} />
        {fetching ? "Refreshing…" : at ? `Updated ${at}` : "Refresh"}
      </button>
    </div>
  );
}

/**
 * Things that need a person right now, picked out of the numbers THIS dashboard already shows (a widget the role can't see never raises a chip):
 * orders past their time limit, unpaid online orders, deliveries waiting for a rider, bookings waiting for a yes, alerts that failed to send.
 * Each one goes to the page where it gets fixed. Nothing to do → one calm line, so "no chips" never looks like "nothing loaded".
 */
function Attention({ widgets, s }) {
  const has = (id) => widgets.some((w) => w.id === id);
  const items = [];
  if (has("missed-orders") && s.today.missedOrders > 0) items.push({ id: "missed", tone: "danger", icon: AlertTriangle, text: plural(s.today.missedOrders, "order is", "orders are") + " over the time limit", to: "/orders" });
  if (has("payment-pending") && s.today.paymentPending > 0) items.push({ id: "payment", tone: "warn", icon: CreditCard, text: plural(s.today.paymentPending, "online order is", "online orders are") + " waiting for payment", to: "/orders" });
  if (has("deliveries-active") && s.today.deliveriesWaiting > 0) items.push({ id: "riders", tone: "warn", icon: Truck, text: plural(s.today.deliveriesWaiting, "delivery is", "deliveries are") + " ready and waiting for a rider", to: "/orders" });
  if (has("bookings-today") && s.today.bookingsAwaiting > 0) items.push({ id: "bookings", tone: "warn", icon: CalendarCheck, text: plural(s.today.bookingsAwaiting, "booking is", "bookings are") + " waiting for your yes", to: "/reservations" });
  if (has("notification-failures-today") && s.today.notificationFailures > 0) items.push({ id: "alerts", tone: "warn", icon: BellOff, text: plural(s.today.notificationFailures, "message", "messages") + " could not be sent today", to: "/notifications" });
  const watching = ["missed-orders", "payment-pending", "deliveries-active", "bookings-today", "notification-failures-today"].some(has);
  if (!watching) return null;
  if (!items.length) {
    return (
      <div data-testid="dashboard-attention" data-state="clear" style={{ ...chipBase, background: tint("var(--tone-success)", 12), color: "var(--tone-success)", marginBottom: 14, alignSelf: "flex-start", width: "fit-content" }}>
        <CheckCircle2 size={15} /> All clear — nothing needs your attention right now.
      </div>
    );
  }
  return (
    <div data-testid="dashboard-attention" data-state="needs" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
      {items.map((it) => {
        const color = it.tone === "danger" ? "var(--tone-danger)" : "var(--tone-warning)";
        return (
          <Link key={it.id} to={it.to} data-attention={it.id} className="ot-press" style={{ ...chipBase, background: tint(color, 12), color, textDecoration: "none", border: `1px solid ${tint(color, 28)}` }}>
            <it.icon size={15} style={{ flexShrink: 0 }} />
            <span>{it.text}</span>
            <ArrowRight size={13} style={{ flexShrink: 0, opacity: 0.7 }} />
          </Link>
        );
      })}
    </div>
  );
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/* -------------------------------------------------------------- widget shell */

function WidgetFrame({ id, cols = 3, s, phone }) {
  const meta = DASHBOARD_WIDGET_CATALOG[id];
  const look = WIDGET_LOOK[id] ?? FALLBACK_LOOK;
  const stat = meta.category === "stat";
  return (
    <div className="ot-widget" data-widget={id} style={{ gridColumn: `span ${Math.min(meta.span, cols)}`, minWidth: 0 }}>
      <section style={{ ...panel, padding: stat ? (phone ? 12 : 16) : phone ? 14 : 18 }}>
        <header style={{ display: "flex", alignItems: "center", gap: phone && stat ? 7 : 10, marginBottom: stat ? 10 : 14, minWidth: 0 }}>
          <span aria-hidden="true" style={{ ...iconChip, background: tint(look.tone, 14), color: look.tone, width: phone && stat ? 28 : 32, height: phone && stat ? 28 : 32 }}>
            <look.icon size={phone && stat ? 14 : 16} />
          </span>
          <h2 style={{ margin: 0, fontSize: stat ? 13 : 14, fontWeight: 650, color: stat ? "var(--color-text-muted)" : "var(--color-text)", minWidth: 0, flex: 1, overflowWrap: "anywhere", lineHeight: 1.25 }}>{meta.label}</h2>
          <InfoHint title={meta.label} text={meta.description} />
        </header>
        {renderWidget(id, s, { tone: look.tone, phone })}
      </section>
    </div>
  );
}

/* ---------------------------------------------------------------- renderers */

function renderWidget(id, s, { tone, phone }) {
  const t = s.today;
  switch (id) {
    case "revenue-today": {
      const y = t.revenueYesterday;
      return (
        <Stat
          value={formatINR(t.revenue)}
          hint={y > 0 ? `Yesterday: ${formatINR(y)}` : "Paid orders, today so far"}
          badge={y > 0 ? { text: `${Math.round((t.revenue / y) * 100)}% of yesterday`, tone: t.revenue >= y ? "ok" : "muted" } : null}
          spark={phone ? null : <Sparkline values={s.revenueTrend.slice(-7).map((r) => r.revenue)} color={tone} />}
        />
      );
    }
    case "orders-today":
      return <Stat value={String(t.orders)} hint={t.orders === 1 ? "order placed today" : "orders placed today"} />;
    case "avg-order-value-today":
      return <Stat value={formatINR(t.avgOrderValue)} hint="per paid order" />;
    case "active-queue":
      return <Stat value={String(t.activeQueue)} tone={t.activeQueue > 0 ? undefined : "muted"} hint={t.activeQueue > 0 ? "being prepared right now" : "the kitchen is clear"} />;
    case "missed-orders":
      return <Stat value={String(t.missedOrders)} tone={t.missedOrders > 0 ? "danger" : "ok"} hint={t.missedOrders > 0 ? "over the time limit" : "everything on time"} />;
    case "new-customers-today":
      return <Stat value={String(t.newCustomers)} hint="first-time customers" />;
    case "coins-issued-today":
      return <Stat value={String(t.coinsIssued)} hint="coins earned today" />;
    case "coupons-redeemed-today":
      return <Stat value={String(t.couponsRedeemed)} hint={t.couponSavings ? `${formatINR(t.couponSavings)} given away` : "no discount given yet"} />;
    case "payment-pending":
      return <Stat value={String(t.paymentPending)} tone={t.paymentPending > 0 ? "warn" : "ok"} hint="online orders not yet paid" />;
    case "notification-failures-today":
      return <Stat value={String(t.notificationFailures)} tone={t.notificationFailures > 0 ? "warn" : "ok"} hint={t.notificationFailures > 0 ? "WhatsApp / SMS not sent" : "every message went out"} />;
    case "deliveries-active":
      return <Stat value={String(t.deliveriesOut)} hint={t.deliveriesWaiting > 0 ? `${t.deliveriesWaiting} waiting for a rider` : "on their way now"} badge={t.deliveriesWaiting > 0 ? { text: `${t.deliveriesWaiting} to hand over`, tone: "warn" } : null} />;
    case "bookings-today":
      return (
        <Stat
          value={String(t.bookingsActive)}
          hint={t.bookings === 0 ? "no bookings today" : `${t.bookings} in all today`}
          badge={t.bookingsAwaiting > 0 ? { text: `${t.bookingsAwaiting} need a yes`, tone: "warn" } : null}
        />
      );
    case "customer-rating":
      return (
        <Stat
          value={t.ratingCount ? t.ratingAverage.toFixed(1) : "—"}
          suffix={t.ratingCount ? <Stars value={t.ratingAverage} /> : null}
          hint={t.ratingCount ? `${t.ratingCount} rating${t.ratingCount === 1 ? "" : "s"}, last 30 days` : "no ratings yet"}
        />
      );

    case "revenue-trend":
      return <LineChart points={s.revenueTrend.map((r) => ({ label: shortDate(r.date), value: r.revenue }))} formatValue={(v) => formatINR(v)} color={tone} />;
    case "orders-by-channel":
      return <DonutChart centerLabel="orders" segments={s.ordersByChannel.map((c) => ({ label: CHANNEL_LABEL[c.channel] ?? c.channel, value: c.count }))} />;
    case "orders-by-status":
      return <DonutChart centerLabel="today" segments={s.ordersByStatus.map((c) => ({ label: ORDER_STATUS_LABELS[c.status] ?? c.status, value: c.count, color: STATUS_COLOR[c.status] }))} />;
    case "orders-by-hour": {
      const now = new Date().getHours();
      return <BarChart bars={s.ordersByHour.map((h) => ({ label: hourLabel(h.hour), value: h.count }))} labelEvery={3} highlight={now} unit="" color={tone} />;
    }
    case "top-items":
      return <HBarList items={s.topItems.map((i) => ({ label: i.name, value: i.quantity, sub: "sold" }))} />;

    case "recent-orders":
      return (
        <Table minWidth={480}>
          <thead>
            <tr>
              <Th width={80}>Order</Th>
              <Th>Customer</Th>
              <Th width={110}>Status</Th>
              <Th width={90} align="right">
                Amount
              </Th>
            </tr>
          </thead>
          <tbody>
            {s.recentOrders.map((o) => (
              <tr key={o.id}>
                <Td nowrap>
                  <strong>#{o.orderNumber}</strong>
                </Td>
                <Td>{o.customerName}</Td>
                <Td>
                  <Pill tone={o.status === "completed" ? "ok" : o.status === "cancelled" ? "neutral" : "info"}>{ORDER_STATUS_LABELS[o.status] ?? o.status}</Pill>
                </Td>
                <Td align="right">{formatINR(o.amount)}</Td>
              </tr>
            ))}
            {!s.recentOrders.length ? (
              <tr>
                <td colSpan={4} style={{ padding: 16, textAlign: "center", color: "var(--color-text-muted)", fontSize: 13 }}>
                  No orders yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </Table>
      );

    case "low-stock":
      return s.lowStock.length ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
          {s.lowStock.map((i) => (
            <span key={i.id} style={stockChip}>
              <PackageX size={11} style={{ flexShrink: 0 }} />
              {i.name}
            </span>
          ))}
        </div>
      ) : (
        <p style={{ margin: 0, fontSize: 13, color: "var(--color-text-muted)", display: "flex", alignItems: "center", gap: 7 }}>
          <CheckCircle2 size={15} style={{ color: "var(--tone-success)" }} /> Nothing is sold out right now.
        </p>
      );

    default:
      return null;
  }
}

/** The colour of an order status in the donut, the same family the Orders page uses (blue = moving, green = done, red = lost). */
const STATUS_COLOR = {
  placed: "#B2953B",
  accepted: "#3B7BB2",
  preparing: "#7B3BB2",
  ready: "#3BAFB2",
  out_for_delivery: "#3B7BB2",
  completed: "#3BA35C",
  cancelled: "#B23B3B",
};

const hourLabel = (h) => (h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`);

function shortDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/* --------------------------------------------------------------------- stat */

/** A number card's body: the number, a line saying what it is, an optional badge, and an optional little trend line. */
function Stat({ value, hint, tone, badge, spark, suffix }) {
  const phone = useMedia("(max-width: 599px)");
  const color =
    tone === "danger" ? "var(--tone-danger)" : tone === "warn" ? "var(--tone-warning)" : tone === "ok" ? "var(--tone-success)" : tone === "muted" ? "var(--color-text-muted)" : "var(--color-text)";
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8, minWidth: 0 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <span data-stat-value style={{ fontSize: phone ? 25 : 32, fontWeight: 700, fontFamily: "var(--font-heading)", color, lineHeight: 1.1, overflowWrap: "anywhere", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" }}>
            {value}
          </span>
          {suffix}
        </div>
        {hint ? <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 5, overflowWrap: "anywhere" }}>{hint}</div> : null}
        {badge ? (
          <span style={{ ...badgeStyle, ...(badge.tone === "ok" ? { background: tint("var(--tone-success)", 14), color: "var(--tone-success)" } : badge.tone === "warn" ? { background: tint("var(--tone-warning)", 16), color: "var(--tone-warning)" } : { background: tint("var(--color-text-muted)", 12), color: "var(--color-text-muted)" }) }}>
            {badge.text}
          </span>
        ) : null}
      </div>
      {spark}
    </div>
  );
}

/** Five stars, filled to the average (a half star counts when it is .5 or more). */
function Stars({ value }) {
  return (
    <span aria-label={`${value.toFixed(1)} out of 5`} style={{ display: "inline-flex", gap: 1, color: "var(--tone-warning)" }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={14} fill={value >= n - 0.25 ? "currentColor" : "none"} strokeWidth={1.8} style={{ opacity: value >= n - 0.75 ? 1 : 0.35 }} />
      ))}
    </span>
  );
}

const grid = { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16 };

/** a card: the surface, a hairline border, the same corner as the rest of the admin — not a shadow on every box */
const panel = {
  height: "100%",
  boxSizing: "border-box",
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-card)",
  minWidth: 0,
};
const iconChip = { display: "grid", placeItems: "center", borderRadius: 10, flexShrink: 0 };
const chipBase = { display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 13px", borderRadius: 999, fontSize: 13, fontWeight: 600, lineHeight: 1.3 };
const badgeStyle = { display: "inline-block", marginTop: 8, padding: "3px 9px", borderRadius: 999, fontSize: 11.5, fontWeight: 650 };
const refreshBtn = {
  font: "inherit",
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  padding: "7px 12px",
  fontSize: 12.5,
  fontWeight: 600,
  color: "var(--color-text-muted)",
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: 999,
  cursor: "pointer",
};

// a "sold out" chip whose name wraps instead of running past the edge of a narrow card
const stockChip = { display: "inline-flex", alignItems: "center", gap: 5, maxWidth: "100%", padding: "3px 9px", borderRadius: 12, fontSize: 11.5, fontWeight: 600, background: "var(--tone-warning-wash)", color: "var(--tone-warning)", overflowWrap: "anywhere" };
