                                                      
import {
  DASHBOARD_WIDGET_CATALOG,
  formatINR,
  ORDER_STATUS_LABELS,
  visibleWidgetsFor,
                      
                         
} from "@onetap/config-schema";
import {
  AlertTriangle,
  BarChart3,
  BellOff,
  Coins,
  CreditCard,
  Flame,
  IndianRupee,
  ListChecks,
  PackageX,
  PieChart,
  Receipt,
  ReceiptText,
  ShoppingBag,
  Tag,
  TrendingUp,
  UserPlus,
                  
} from "lucide-react";
import { BarChart, DonutChart, HBarList, LineChart } from "../charts";
import { useAuth } from "../lib/useAuth";
import { useDashboardStats } from "../lib/useDashboard";
import { useOutlet } from "../lib/useOutlet";
import { AwesomeLoader, Card, Empty, InfoHint, PageHeader, Pill, Table, Td, Th, Toast } from "../ui";

const CHANNEL_LABEL                         = { takeaway: "Takeaway", "dine-in": "Dine-in", delivery: "Delivery" };

export function Dashboard() {
  const { outlet, isLoading } = useOutlet();
  const { user } = useAuth();
  const stats = useDashboardStats(outlet, true);

  if (!isLoading && !outlet) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <Card title="No outlet yet">
          <p style={{ color: "var(--color-text-muted)", marginTop: 0 }}>
            {user?.isSuperAdmin
              ? "No brand or outlet exists yet for this account to manage."
              : "Your account isn't attached to a brand or outlet yet. Ask your TablePe superadmin."}
          </p>
        </Card>
      </>
    );
  }
  if (!outlet) return null;

  const widgets = visibleWidgetsFor(outlet.config.dashboard, user?.role ?? null);

  return (
    <>
      <PageHeader title="Dashboard" subtitle={outlet.name} />

      {stats.isLoading ? (
        <Card>
          <AwesomeLoader compact label="Loading dashboard metrics…" />
        </Card>
      ) : stats.error ? (
        <Card>
          <Toast kind="error">{(stats.error         ).message}</Toast>
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
        <div style={grid}>
          {widgets.map((w) => (
            <WidgetFrame key={w.id} id={w.id}>
              {renderWidget(w.id, stats.data )}
            </WidgetFrame>
          ))}
        </div>
      )}
    </>
  );
}

/* -------------------------------------------------------------- widget shell */

const WIDGET_ICON                                        = {
  "revenue-today": IndianRupee,
  "orders-today": ShoppingBag,
  "avg-order-value-today": Receipt,
  "active-queue": ListChecks,
  "missed-orders": AlertTriangle,
  "new-customers-today": UserPlus,
  "coins-issued-today": Coins,
  "coupons-redeemed-today": Tag,
  "payment-pending": CreditCard,
  "notification-failures-today": BellOff,
  "revenue-trend": TrendingUp,
  "orders-by-channel": PieChart,
  "orders-by-status": PieChart,
  "orders-by-hour": BarChart3,
  "top-items": Flame,
  "recent-orders": ReceiptText,
  "low-stock": PackageX,
};

function WidgetFrame({ id, children }                                                ) {
  const meta = DASHBOARD_WIDGET_CATALOG[id];
  const Icon = WIDGET_ICON[id];
  return (
    <div style={{ gridColumn: `span ${meta.span}`, minWidth: 0 }}>
      <Card
        title={meta.label}
        icon={<Icon size={15} />}
        action={<InfoHint title={meta.label} text={meta.description} />}
      >
        {children}
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------------- renderers */

function renderWidget(id                   , s                )            {
  switch (id) {
    case "revenue-today":
      return <Stat value={formatINR(s.today.revenue)} />;
    case "orders-today":
      return <Stat value={String(s.today.orders)} />;
    case "avg-order-value-today":
      return <Stat value={formatINR(s.today.avgOrderValue)} />;
    case "active-queue":
      return <Stat value={String(s.today.activeQueue)} tone={s.today.activeQueue > 0 ? undefined : "muted"} />;
    case "missed-orders":
      return <Stat value={String(s.today.missedOrders)} tone={s.today.missedOrders > 0 ? "danger" : "ok"} />;
    case "new-customers-today":
      return <Stat value={String(s.today.newCustomers)} />;
    case "coins-issued-today":
      return <Stat value={String(s.today.coinsIssued)} hint="coins" />;
    case "coupons-redeemed-today":
      return (
        <Stat
          value={String(s.today.couponsRedeemed)}
          hint={s.today.couponSavings ? `${formatINR(s.today.couponSavings)} given away` : undefined}
        />
      );
    case "payment-pending":
      return <Stat value={String(s.today.paymentPending)} tone={s.today.paymentPending > 0 ? "warn" : "ok"} />;
    case "notification-failures-today":
      return <Stat value={String(s.today.notificationFailures)} tone={s.today.notificationFailures > 0 ? "warn" : "ok"} />;

    case "revenue-trend":
      return (
        <LineChart
          points={s.revenueTrend.map((r) => ({ label: shortDate(r.date), value: r.revenue }))}
          formatValue={(v) => formatINR(v)}
        />
      );
    case "orders-by-channel":
      return (
        <DonutChart
          segments={s.ordersByChannel.map((c) => ({ label: CHANNEL_LABEL[c.channel] ?? c.channel, value: c.count }))}
        />
      );
    case "orders-by-status":
      return (
        <DonutChart
          segments={s.ordersByStatus.map((c) => ({ label: ORDER_STATUS_LABELS[c.status                                    ] ?? c.status, value: c.count }))}
        />
      );
    case "orders-by-hour":
      return (
        <BarChart
          bars={s.ordersByHour.map((h) => ({ label: `${h.hour}`, value: h.count }))}
          labelEvery={3}
        />
      );
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
                  <Pill tone={o.status === "completed" ? "ok" : o.status === "cancelled" ? "neutral" : "info"}>
                    {ORDER_STATUS_LABELS[o.status                                    ] ?? o.status}
                  </Pill>
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
            <Pill key={i.id} tone="warn" icon={<PackageX size={11} />}>
              {i.name}
            </Pill>
          ))}
        </div>
      ) : (
        <p style={{ margin: 0, fontSize: 13, color: "var(--color-text-muted)" }}>Nothing 86'd right now.</p>
      );

    default:
      return null;
  }
}

function shortDate(iso        )         {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/* --------------------------------------------------------------------- stat */

function Stat({
  value,
  hint,
  tone,
}   
                
                
                                            
 ) {
  const color =
    tone === "danger" ? "var(--tone-danger)" : tone === "warn" ? "var(--tone-warning)" : tone === "ok" ? "var(--tone-success)" : tone === "muted" ? "var(--color-text-muted)" : "var(--color-text)";
  return (
    <div>
      <div style={{ fontSize: 30, fontWeight: 700, fontFamily: "var(--font-heading)", color, lineHeight: 1.15 }}>{value}</div>
      {hint ? <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 3 }}>{hint}</div> : null}
    </div>
  );
}

const grid                = { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16 };
