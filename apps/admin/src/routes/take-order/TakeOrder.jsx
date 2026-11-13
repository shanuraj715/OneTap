import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { formatINR } from "@onetap/config-schema";
import { ArrowLeft, ChevronDown, CircleCheckBig, ConciergeBell, ShoppingBag } from "lucide-react";
import { useAuth } from "../../lib/useAuth";
import { useMenu } from "../../lib/useMenu";
import { useOutlet } from "../../lib/useOutlet";
import { useActiveSessions, useTables } from "../../lib/useTables";
import { ItemSheet } from "./ItemSheet";
import { isCustomisable, MenuBrowser } from "./MenuBrowser";
import { OrderPanel } from "./OrderPanel";
import { TablePicker } from "./TablePicker";
import { lineKey, useTakeOrder } from "./useTakeOrder";
import { ghostBtn, iconBtn, muted, primaryBtn, useMedia } from "./styles";

/**
 * Take order — a waiter at the table, on their own phone, tablet or desktop.
 *
 * Table first (always), then dishes with their sizes/add-ons/notes, then the
 * customer's mobile number (name and email optional) and Send. The order goes
 * straight to the kitchen. On a wide screen the order sits beside the menu; on
 * a phone it's one step at a time with a running total pinned to the bottom.
 *
 * `?table=<id>` opens it on a table (the Tables overview's "Add item").
 */
export function TakeOrder() {
  const { outlet } = useOutlet();
  const { can } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const wide = useMedia("(min-width: 900px)");

  const tablesQ = useTables(outlet, Boolean(outlet));
  const sessionsQ = useActiveSessions(outlet, Boolean(outlet));
  const menuQ = useMenu(outlet);
  const order = useTakeOrder(outlet?._id);
  const { state } = order;

  // table | menu | review | done. Until staff move between steps it follows the
  // saved order — which, after a refresh, only loads once the outlet has — so
  // a half-taken order reopens on its menu, not on the table picker.
  const [chosenView, setView] = useState(null);
  const view = chosenView ?? (state.tableId ? "menu" : "table");
  const [sheetItem, setSheetItem] = useState(null);
  const [sent, setSent] = useState(null);

  // Opened for a particular table (from the Tables overview).
  useEffect(() => {
    const t = params.get("table");
    if (t) {
      order.setTable(t);
      setView("menu");
      setParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tables = tablesQ.data?.tables ?? [];
  const sessions = sessionsQ.data?.sessions ?? [];
  const table = tables.find((t) => t.id === state.tableId) ?? null;
  const session = useMemo(() => sessions.find((s) => s.tableId === state.tableId) ?? null, [sessions, state.tableId]);
  // Who's at the table right now. Customer details typed for a different party
  // (the one before, who has since left) never carry over to the next guests.
  const partyKey = state.tableId ? `${state.tableId}|${session?.id ?? "free"}` : null;
  useEffect(() => {
    if (!sessionsQ.isSuccess || !partyKey) return;
    const hasCustomer = state.phone || state.name || state.email;
    if (hasCustomer && state.customerKey !== partyKey) order.clearCustomer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionsQ.isSuccess, partyKey, state.customerKey]);

  const itemCount = state.lines.reduce((s, l) => s + l.quantity, 0);
  const estimate = state.lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);

  // the table was removed / deactivated while an order was in progress
  useEffect(() => {
    if (state.tableId && tablesQ.isSuccess && !table) {
      order.setTable(null);
      setView("table");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tablesQ.isSuccess, table, state.tableId]);

  const pickTable = (id) => {
    order.setTable(id);
    setView("menu");
  };

  const addPlain = (item) =>
    order.addLine({ itemId: item.id, modifierOptionIds: [], quantity: 1, name: item.name, foodType: item.foodType, modifierLabels: [], unitPrice: item.basePrice });
  const setPlainQty = (item, n) => {
    const key = lineKey({ itemId: item.id });
    if (state.lines.some((l) => l.key === key)) order.setQty(key, n);
    else if (n > 0) addPlain(item);
  };

  if (!can("order:create")) {
    return (
      <div style={centerMsg}>
        <strong>Your role can't take orders.</strong>
        <span style={muted}>Ask your manager if you need to.</span>
      </div>
    );
  }

  const header = (
    <header style={bar}>
      <button
        type="button"
        onClick={() => (view === "review" ? setView("menu") : view === "menu" && !wide ? setView("table") : navigate("/orders"))}
        style={iconBtn}
        aria-label={view === "review" ? "Back to the menu" : "Leave Take order"}
      >
        <ArrowLeft size={18} />
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 800, fontSize: 16.5 }}>
          <ConciergeBell size={17} color="var(--color-primary)" /> Take order
        </div>
        <div style={{ ...muted, fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{outlet?.config?.identity?.name || outlet?.name}</div>
      </div>
      {table && view !== "table" && view !== "done" ? (
        <button type="button" onClick={() => setView("table")} style={tableChip} aria-label={`Table ${table.number} — change table`}>
          Table {table.number}
          <ChevronDown size={15} />
        </button>
      ) : null}
    </header>
  );

  let content;
  if (view === "done" && sent) {
    content = (
      <div style={centerMsg} className="ot-anim-pop">
        <span style={doneIcon}>
          <CircleCheckBig size={40} />
        </span>
        <h2 style={{ margin: "6px 0 0", fontSize: 24, fontWeight: 800, fontFamily: "var(--font-heading)" }}>Sent to the kitchen</h2>
        <p style={{ ...muted, margin: 0, fontSize: 15 }}>
          Order #{sent.orderNumber} · Table {sent.tableNumber} · {formatINR(sent.totals.grandTotal)}
          {sent.customer?.name ? ` · ${sent.customer.name}` : ""}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "min(340px, 100%)", marginTop: 18 }}>
          <button type="button" style={primaryBtn} onClick={() => setView("menu")}>
            Add more to Table {sent.tableNumber}
          </button>
          <button
            type="button"
            style={ghostBtn}
            onClick={() => {
              order.reset();
              setView("table");
            }}
          >
            New order for another table
          </button>
          <button type="button" style={{ ...ghostBtn, border: "none" }} onClick={() => navigate("/orders")}>
            View orders
          </button>
        </div>
      </div>
    );
  } else if (view === "table" || !table) {
    content = <TablePicker tables={tables} sessions={sessions} selectedId={state.tableId} onPick={pickTable} loading={tablesQ.isLoading} />;
  } else {
    const panel = (
      <OrderPanel
        outlet={outlet}
        table={table}
        session={session}
        partyKey={partyKey}
        order={order}
        wide={wide}
        onChangeTable={() => setView("table")}
        onBack={() => setView("menu")}
        onSent={(placed) => {
          setSent({ ...placed, tableNumber: table.number });
          order.clearItems();
          setView("done");
        }}
      />
    );
    const menu = menuQ.isLoading ? (
      <p style={{ ...muted, padding: 20 }}>Loading the menu…</p>
    ) : (
      <MenuBrowser menu={menuQ.data} lines={state.lines} onCustomise={setSheetItem} onAddPlain={addPlain} onSetPlainQty={setPlainQty} />
    );

    content = wide ? (
      <div style={split}>
        <div style={{ overflowY: "auto", minHeight: 0 }}>{menu}</div>
        <div style={{ minHeight: 0 }}>{panel}</div>
      </div>
    ) : view === "review" ? (
      <div style={{ overflowY: "auto", flex: 1 }}>{panel}</div>
    ) : (
      <>
        <div style={{ overflowY: "auto", flex: 1 }}>{menu}</div>
        {itemCount > 0 ? (
          <div style={cartBarWrap}>
            <button type="button" onClick={() => setView("review")} style={cartBar} className="ot-anim-rise">
              <span style={cartCount}>
                <ShoppingBag size={16} /> {itemCount}
              </span>
              <span style={{ flex: 1, textAlign: "left" }}>
                <span style={{ display: "block", fontSize: 12, opacity: 0.85 }}>Table {table.number}</span>
                <span style={{ fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{formatINR(estimate)}</span>
              </span>
              <span style={{ fontWeight: 800 }}>Review →</span>
            </button>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <div style={root}>
      {header}
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflowY: view === "table" || view === "done" ? "auto" : "hidden" }}>{content}</div>
      {sheetItem && menuQ.data ? (
        <ItemSheet
          item={sheetItem}
          menu={menuQ.data}
          wide={wide}
          onClose={() => setSheetItem(null)}
          onAdd={(line) => {
            order.addLine(line);
            setSheetItem(null);
          }}
        />
      ) : null}
    </div>
  );
}

// Above the dashboard's sidebar, below dialogs (the item sheet sits at 85).
const root = { position: "fixed", inset: 0, zIndex: 60, display: "flex", flexDirection: "column", background: "var(--color-bg)", color: "var(--color-text)" };
const bar = { display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", paddingTop: "calc(10px + env(safe-area-inset-top))", borderBottom: "1px solid var(--color-border)", background: "var(--color-bg)", flexShrink: 0 };
const tableChip = { display: "inline-flex", alignItems: "center", gap: 6, minHeight: 40, padding: "0 14px", borderRadius: 999, border: "none", background: "var(--color-text)", color: "var(--color-bg)", font: "inherit", fontWeight: 800, fontSize: 14, cursor: "pointer", flexShrink: 0 };
const split = { display: "grid", gridTemplateColumns: "minmax(0, 1fr) clamp(340px, 34vw, 440px)", flex: 1, minHeight: 0 };
const cartBarWrap = { padding: "10px 12px calc(12px + env(safe-area-inset-bottom))", background: "linear-gradient(to top, var(--color-bg) 70%, transparent)", position: "sticky", bottom: 0 };
const cartBar = { ...primaryBtn, width: "100%", minHeight: 60, justifyContent: "space-between", gap: 14, padding: "0 16px", boxShadow: "0 10px 30px color-mix(in srgb, var(--color-primary) 35%, transparent)" };
const cartCount = { display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 10, background: "rgba(255,255,255,0.18)", fontWeight: 800 };
const centerMsg = { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, textAlign: "center", padding: "48px 20px", minHeight: "60vh" };
const doneIcon = { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 76, height: 76, borderRadius: 99, background: "var(--tone-success-wash)", color: "var(--tone-success)" };
