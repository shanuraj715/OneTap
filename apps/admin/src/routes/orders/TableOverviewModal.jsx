import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { formatINR, TABLE_STATUS_LABELS } from "@onetap/config-schema";
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  ChevronRight,
  Minus,
  Plus,
  Search,
  ShoppingBasket,
  Sparkles,
  User,
  Utensils,
  Wallet,
  X,
} from "lucide-react";
import { usePlaceOrder } from "../../lib/useOrders";
import {
  useActiveSessions,
  useCloseSession,
  useConfirmPayment,
  useMoveSession,
  useTables,
  useUpdateTable,
  useVoidSession,
} from "../../lib/useTables";
import { Button, Note, Pill, TextInput, Toast, useLockBodyScroll } from "../../ui";

/**
 * Full-screen: this replaces the whole working view rather than sitting over
 * it, unlike the boxed `Modal` in ui.jsx — a floor plan needs the room a
 * centred dialog doesn't have.
 */
export function TableOverviewModal({
  outlet,
  orders,
  menu,
  canManage,
  onClose,
  onFilterTable,
}






 ) {
  useLockBodyScroll(true);

  useEffect(() => {
    const onKey = (e               ) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const tablesQ = useTables(outlet, true);
  const sessionsQ = useActiveSessions(outlet, true);
  const [selectedId, setSelectedId] = useState              (null);

  const tables = tablesQ.data?.tables ?? [];
  const sessions = sessionsQ.data?.sessions ?? [];
  const zones = [...new Set(tables.map((t) => t.zone || "Main"))];

  const selected = selectedId ? (tables.find((t) => t.id === selectedId) ?? null) : null;
  const session = selected ? (sessions.find((s) => s.tableId === selected.id) ?? null) : null;

  return createPortal(
    <div style={overlay} role="presentation">
      <div className="ot-anim-pop" style={panel} role="dialog" aria-modal="true" aria-label="Table overview">
        <header style={header}>
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            {selected ? (
              <button type="button" onClick={() => setSelectedId(null)} style={backBtn} aria-label="Back to tables">
                <ArrowLeft size={17} />
              </button>
            ) : (
              <span style={headerIcon}>
                <Utensils size={17} />
              </span>
            )}
            <div>
              <h2 style={{ margin: 0, fontFamily: "var(--font-heading)", fontSize: 19 }}>
                {selected ? `Table ${selected.number}` : "Tables"}
              </h2>
              <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--color-text-muted)" }}>
                {selected
                  ? `${selected.zone || "Main"} · ${selected.seats} seats · ${TABLE_STATUS_LABELS[selected.status]}`
                  : "Every table, grouped by zone. Click one for who's seated there."}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} style={closeBtn} aria-label="Close (Esc)">
            <X size={18} />
          </button>
        </header>

        <div style={{ flex: 1, overflowY: "auto", padding: "18px 22px 28px" }}>
          {selected ? (
            <TableDetail
              outlet={outlet}
              table={selected}
              session={session}
              orders={orders}
              menu={menu}
              canManage={canManage}
              onMoved={() => setSelectedId(null)}
              onVoided={() => setSelectedId(null)}
              onVacated={() => setSelectedId(null)}
              onFilterTable={(number) => {
                onFilterTable(number);
                onClose();
              }}
              freeTables={tables.filter((t) => t.id !== selected.id && !t.activeSessionId && t.isActive)}
            />
          ) : (
            <TableGrid zones={zones} tables={tables} sessions={sessions} onSelect={setSelectedId} />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* -------------------------------------------------------------------- grid */

function TableGrid({ zones, tables, sessions, onSelect }) {
  const byTable = new Map(sessions.map((s) => [s.tableId, s]));

  return (
    <>
      {zones.map((zone) => (
        <div key={zone} style={{ marginBottom: 22 }}>
          <h3 style={zoneTitle}>{zone}</h3>
          <div style={grid}>
            {tables
              .filter((t) => (t.zone || "Main") === zone)
              .map((t) => {
                const s = byTable.get(t.id);
                return (
                  <button key={t.id} type="button" className="ot-press" onClick={() => onSelect(t.id)} style={{ ...tile, ...tone(t.status) }}>
                    <span style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--font-heading)" }}>{t.number}</span>
                    <span style={{ fontSize: 11.5, opacity: 0.85 }}>{TABLE_STATUS_LABELS[t.status]}</span>
                    <span style={{ fontSize: 11, opacity: 0.7 }}>{t.seats} seats</span>
                    {s ? (
                      <span style={{ fontSize: 11.5, fontWeight: 700, marginTop: 4 }}>
                        {formatINR(s.tab)} {s.allPaid ? "· paid" : "· unpaid"}
                      </span>
                    ) : null}
                  </button>
                );
              })}
          </div>
        </div>
      ))}
      {tables.length === 0 ? (
        <p style={{ color: "var(--color-text-muted)", fontSize: 13.5 }}>No tables set up yet — add them from the Tables page.</p>
      ) : null}
    </>
  );
}

function tone(status) {
  if (status === "seated") return { background: "var(--color-primary)", color: "var(--color-on-primary)", borderColor: "var(--color-primary)" };
  if (status === "bill-requested") return { background: "var(--tone-warning-wash)", color: "var(--tone-warning)", borderColor: "var(--tone-warning)" };
  if (status === "needs-cleaning") return { background: "var(--tone-info-wash)", color: "var(--tone-info)" };
  if (status === "reserved") return { background: "var(--color-surface)", color: "var(--color-text-muted)" };
  return { background: "var(--color-bg)", color: "var(--color-text)" };
}

/* ------------------------------------------------------------------ detail */

function TableDetail({
  outlet,
  table,
  session,
  orders,
  menu,
  canManage,
  onMoved,
  onVoided,
  onVacated,
  onFilterTable,
  freeTables,
}) {
  const updateTable = useUpdateTable(outlet);
  const moveSession = useMoveSession(outlet);
  const closeSession = useCloseSession(outlet);
  const confirmPayment = useConfirmPayment(outlet);
  const voidSession = useVoidSession(outlet);
  const [moveTo, setMoveTo] = useState("");
  const [addItemOpen, setAddItemOpen] = useState(false);

  // Orders for THIS session only — a table's id is reused by every party that
  // ever sat there, so anything from before this session opened belongs to a
  // previous diner, not this one.
  const tableOrders = useMemo(() => {
    if (!session) return [];
    const openedAt = new Date(session.openedAt).getTime();
    return orders
      .filter((o) => o.tableId === table.id && new Date(o.createdAt).getTime() >= openedAt)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }, [orders, table.id, session]);

  const diner = tableOrders.find((o) => o.customer?.name || o.customer?.phone)?.customer ?? null;

  if (!session) {
    return (
      <div>
        <Note icon={<Sparkles size={15} />}>
          {table.status === "needs-cleaning"
            ? "This table was just vacated — mark it cleaned once it's ready for the next party."
            : table.status === "free"
              ? "Free and ready — the next diner who scans its QR or claims it will lock it automatically."
              : `Currently ${TABLE_STATUS_LABELS[table.status].toLowerCase()}.`}
        </Note>
        {canManage && table.status === "needs-cleaning" ? (
          <div style={{ marginTop: 14 }}>
            <Button
              disabled={updateTable.isPending}
              onClick={() => updateTable.mutate({ id: table.id, patch: { status: "free" } })}
            >
              <CheckCircle2 size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
              Mark cleaned
            </Button>
          </div>
        ) : null}
        {updateTable.error ? <Toast kind="error">{(updateTable.error         ).message}</Toast> : null}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginBottom: 18 }}>
        <StatCard icon={<User size={15} />} label="Diner" value={diner?.name || "Guest"} sub={diner?.phone ?? ""} />
        <StatCard
          icon={<Wallet size={15} />}
          label="Running tab"
          value={formatINR(session.tab)}
          sub={session.allPaid ? "Fully paid" : `${formatINR(session.unpaidTotal)} unpaid`}
          tone={session.allPaid ? "ok" : "warn"}
        />
      </div>

      <div style={sectionHead}>
        <ShoppingBasket size={14} />
        Orders on this tab
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
        {tableOrders.length === 0 ? (
          <p style={{ color: "var(--color-text-muted)", fontSize: 13 }}>Nothing ordered yet.</p>
        ) : (
          tableOrders.map((o) => (
            <div key={o.id} style={orderRow}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>
                  #{o.orderNumber} · {o.lines.map((l) => `${l.quantity}× ${l.name}`).join(", ")}
                </div>
                <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{formatINR(o.totals.grandTotal)}</div>
              </div>
              <Pill tone={o.payment?.status === "paid" ? "ok" : "neutral"}>{o.status}</Pill>
            </div>
          ))
        )}
      </div>

      {canManage ? (
        <>
          <div style={sectionHead}>Actions</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
            <Button variant="outline" onClick={() => setAddItemOpen((v) => !v)}>
              <Plus size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
              Add item
            </Button>
            <Button
              variant="outline"
              disabled={session.allPaid || confirmPayment.isPending}
              onClick={() => confirmPayment.mutate(session.id)}
            >
              Confirm payment
            </Button>
            <Button
              disabled={!session.allPaid || closeSession.isPending}
              onClick={() => window.confirm(`Mark table ${table.number} vacant?`) && closeSession.mutate(session.id, { onSuccess: onVacated })}
            >
              Mark table as vacant
            </Button>
            <Button variant="outline" onClick={() => onFilterTable(table.number)}>
              Full order history
              <ChevronRight size={14} style={{ marginLeft: 4, verticalAlign: -2 }} />
            </Button>
            <Button
              variant="outline"
              disabled={voidSession.isPending}
              onClick={() =>
                window.confirm(`Cancel every order on table ${table.number} and free it without payment?`) &&
                voidSession.mutate({ sessionId: session.id, reason: "Voided from table overview" }, { onSuccess: onVoided })
              }
              style={{ color: "var(--tone-danger)" }}
            >
              <Ban size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
              Cancel / void
            </Button>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
            <select value={moveTo} onChange={(e) => setMoveTo(e.target.value)} style={select} aria-label="Move to table">
              <option value="">Move to…</option>
              {freeTables.map((t) => (
                <option key={t.id} value={t.id}>Table {t.number}</option>
              ))}
            </select>
            <Button
              variant="outline"
              disabled={!moveTo || moveSession.isPending}
              onClick={() => moveSession.mutate({ sessionId: session.id, toTableId: moveTo }, { onSuccess: onMoved })}
            >
              Move
            </Button>
          </div>

          {confirmPayment.error ? <Toast kind="error">{(confirmPayment.error         ).message}</Toast> : null}
          {closeSession.error ? <Toast kind="error">{(closeSession.error         ).message}</Toast> : null}
          {voidSession.error ? <Toast kind="error">{(voidSession.error         ).message}</Toast> : null}
          {moveSession.error ? <Toast kind="error">{(moveSession.error         ).message}</Toast> : null}
        </>
      ) : null}

      {addItemOpen ? (
        <AddItemPanel
          outlet={outlet}
          table={table}
          session={session}
          menu={menu}
          onDone={() => setAddItemOpen(false)}
        />
      ) : null}
    </div>
  );
}

function StatCard({ icon, label, value, sub, tone: t = "neutral" }) {
  const color = t === "ok" ? "var(--tone-success)" : t === "warn" ? "var(--tone-warning)" : "var(--color-text-muted)";
  return (
    <div style={statCard}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--color-text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.3 }}>
        {icon} {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{value}</div>
      {sub ? <div style={{ fontSize: 12, color, marginTop: 2 }}>{sub}</div> : null}
    </div>
  );
}

/* ---------------------------------------------------------------- add item */

function AddItemPanel({ outlet, table, session, menu, onDone }) {
  const place = usePlaceOrder(outlet);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState([]);

  const catalogue = useMemo(() => {
    if (!menu) return [];
    const q = search.trim().toLowerCase();
    return menu.items.filter((item) => item.isAvailable && (!q || item.name.toLowerCase().includes(q))).slice(0, 30);
  }, [menu, search]);

  const addToCart = (item          ) => {
    const variant = item.variants?.[0];
    setCart((prev) => {
      const key = `${item.id}:${variant?.id ?? ""}`;
      const existing = prev.find((l) => l.key === key);
      if (existing) return prev.map((l) => (l.key === key ? { ...l, quantity: l.quantity + 1 } : l));
      return [...prev, { key, itemId: item.id, variantId: variant?.id, name: item.name, price: variant?.price ?? item.basePrice, quantity: 1 }];
    });
  };

  const setQty = (key        , q        ) =>
    setCart((prev) => (q <= 0 ? prev.filter((l) => l.key !== key) : prev.map((l) => (l.key === key ? { ...l, quantity: q } : l))));

  const total = cart.reduce((sum, l) => sum + l.price * l.quantity, 0);

  return (
    <div style={addItemPanel}>
      <div style={sectionHead}>
        <Search size={14} />
        Add to table {table.number}
      </div>

      <TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search the menu…" style={{ marginBottom: 10 }} />

      <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 180, overflowY: "auto", marginBottom: 12 }}>
        {catalogue.map((item) => (
          <button key={item.id} type="button" className="ot-press" onClick={() => addToCart(item)} style={catalogueRow}>
            <span>{item.name}</span>
            <span style={{ color: "var(--color-text-muted)", fontSize: 12.5 }}>{formatINR(item.variants?.[0]?.price ?? item.basePrice)}</span>
          </button>
        ))}
        {menu && catalogue.length === 0 ? <p style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>No matching items.</p> : null}
      </div>

      {cart.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
          {cart.map((l) => (
            <div key={l.key} style={cartRow}>
              <span style={{ flex: 1 }}>{l.name}</span>
              <button type="button" onClick={() => setQty(l.key, l.quantity - 1)} style={stepBtn} aria-label={`Remove one ${l.name}`}>
                <Minus size={12} />
              </button>
              <span style={{ minWidth: 18, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{l.quantity}</span>
              <button type="button" onClick={() => setQty(l.key, l.quantity + 1)} style={stepBtn} aria-label={`Add one more ${l.name}`}>
                <Plus size={12} />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>{cart.length ? `Est. ${formatINR(total)}` : "Nothing added yet"}</span>
        <span style={{ display: "flex", gap: 8 }}>
          <Button variant="outline" onClick={onDone}>Cancel</Button>
          <Button
            disabled={cart.length === 0 || place.isPending}
            onClick={() =>
              place.mutate(
                {
                  outletId: outlet._id,
                  channel: "dine-in",
                  sessionId: session.id,
                  cart: { lines: cart.map((l) => ({ itemId: l.itemId, variantId: l.variantId, quantity: l.quantity, modifierOptionIds: [] })) },
                },
                { onSuccess: onDone },
              )
            }
          >
            {place.isPending ? "Sending…" : "Send to kitchen"}
          </Button>
        </span>
      </div>
      {place.error ? <Toast kind="error">{(place.error         ).message}</Toast> : null}
    </div>
  );
}

/* ------------------------------------------------------------------- styles */

const overlay                = {
  position: "fixed",
  inset: 0,
  background: "var(--color-bg)",
  zIndex: 90,
  display: "flex",
  flexDirection: "column",
};
const panel                = { display: "flex", flexDirection: "column", height: "100%" };
const header                = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "16px 22px",
  borderBottom: "1px solid var(--color-border)",
  flexShrink: 0,
};
const headerIcon                = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 36,
  height: 36,
  borderRadius: 10,
  background: "color-mix(in srgb, var(--color-primary) 12%, transparent)",
  color: "var(--color-primary)",
};
const backBtn                = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 36,
  height: 36,
  borderRadius: 10,
  border: "1px solid var(--color-border)",
  background: "var(--color-bg)",
  color: "var(--color-text)",
  cursor: "pointer",
};
const closeBtn                = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 34,
  height: 34,
  borderRadius: 9,
  border: "1px solid var(--color-border)",
  background: "var(--color-bg)",
  color: "var(--color-text-muted)",
  cursor: "pointer",
};
const zoneTitle                = { margin: "0 0 10px", fontSize: 14, fontWeight: 700 };
const grid                = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 };
const tile                = {
  font: "inherit",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: 2,
  padding: "14px 16px",
  minHeight: 92,
  borderRadius: 10,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--color-border)",
  cursor: "pointer",
  textAlign: "left",
};
const sectionHead                = {
  display: "flex",
  alignItems: "center",
  gap: 7,
  fontSize: 12.5,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0.3,
  color: "var(--color-text-muted)",
  margin: "0 0 10px",
};
const orderRow                = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 12px",
  border: "1px solid var(--color-border)",
  borderRadius: 9,
  background: "var(--color-bg)",
};
const statCard                = {
  padding: "12px 16px",
  border: "1px solid var(--color-border)",
  borderRadius: 10,
  background: "var(--color-surface)",
  minWidth: 160,
};
const select                = {
  font: "inherit",
  fontSize: 13,
  padding: "7px 9px",
  borderRadius: 8,
  border: "1px solid var(--color-border)",
  background: "var(--color-bg)",
  color: "var(--color-text)",
};
const addItemPanel                = {
  marginTop: 6,
  padding: 16,
  border: "1px solid var(--color-border)",
  borderRadius: 12,
  background: "var(--color-surface)",
};
const catalogueRow                = {
  font: "inherit",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "8px 10px",
  borderRadius: 7,
  border: "1px solid transparent",
  background: "var(--color-bg)",
  cursor: "pointer",
  fontSize: 13,
};
const cartRow                = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 13,
};
const stepBtn                = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 22,
  height: 22,
  borderRadius: 6,
  border: "1px solid var(--color-border)",
  background: "var(--color-bg)",
  color: "var(--color-text)",
  cursor: "pointer",
};
