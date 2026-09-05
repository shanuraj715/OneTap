import { useEffect, useMemo, useRef, useState } from "react";
                                           
import { useQuery } from "@tanstack/react-query";
import {
  formatElapsed,
  formatINR,
  NEXT_STATUSES,
  ORDER_CHANNELS,
  ORDER_STATUS_LABELS,
  ORDER_STATUSES,
  PLACED_BY_LABELS,
  statusSince,
                      
                    
                   
                 
} from "@onetap/config-schema";
import {
  AlertTriangle,
  Bell,
  BellOff,
  Bike,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  Filter,
  Gauge,
  Keyboard,
  MapPin,
  MoreHorizontal,
  Pencil,
  Printer,
  Radio,
  RefreshCw,
  Search,
  ShoppingBag,
  StickyNote,
  Store,
  Tag,
  Timer,
  User,
  UtensilsCrossed,
  Wallet,
  X,
} from "lucide-react";
import * as api from "../lib/api";
                                                           
import { useAuth } from "../lib/useAuth";
import { useMenu } from "../lib/useMenu";
import { useCapacity, useOrders, useSetOrderStatus } from "../lib/useOrders";
import { useOrderStream } from "../lib/useOrderStream";
import { useOutlet } from "../lib/useOutlet";
import { usePrinters, usePrintOrderOn } from "../lib/usePrinting";
import { useSlaAlerts } from "../lib/useSlaAlerts";
import { useManualStatus } from "../lib/useOrders";
import { AwesomeLoader, Button, Card, Empty, IconChip, Menu, Modal, MultiFilter, Pill, Select, Table, Td, TextInput, Th, Toast } from "../ui";
import { OrderEditModal } from "./orders/OrderEditModal";

/** Rows-per-page, remembered per browser. */
const PAGE_SIZE_KEY = "onetap.ordersPageSize";
const PAGE_SIZES = [10, 25, 50, 100]         ;
const SEARCH_INPUT_ID = "orders-search-input";

const SHORTCUTS                                      = [
  { keys: ["["], label: "Collapse every open row" },
  { keys: ["]"], label: "Expand every visible row" },
  { keys: ["/"], label: "Focus the search box" },
  { keys: ["R"], label: "Refresh the order list" },
  { keys: ["O"], label: "Toggle ‘Open only’" },
  { keys: ["?"], label: "Show this shortcuts panel" },
  { keys: ["\\"], label: "Collapse or expand the sidebar (any page)" },
  { keys: ["Enter"], label: "Confirm a status change" },
  { keys: ["Esc"], label: "Cancel a status change, or close a dialog" },
];

function loadPageSize()         {
  try {
    const raw = Number(localStorage.getItem(PAGE_SIZE_KEY));
    return PAGE_SIZES.includes(raw                               ) ? raw : 10;
  } catch {
    return 10;
  }
}

const OPEN_STATUSES                = ["placed", "accepted", "preparing", "ready"];

                                                                                        
                                                                
                                                             

const CHANNEL_ICON                               = {
  takeaway: ShoppingBag,
  "dine-in": UtensilsCrossed,
  delivery: Bike,
};

const CHANNEL_LABEL                         = {
  takeaway: "Takeaway",
  "dine-in": "Dine-in",
  delivery: "Delivery",
};

/** Compact codes for the Type column — the full name is a hover away. */
const CHANNEL_SHORT                         = {
  takeaway: "TA",
  "dine-in": "DI",
  delivery: "Del",
};

const STATUS_TONE                                                                    = {
  placed: "warn",
  accepted: "info",
  preparing: "info",
  ready: "warn",
  completed: "ok",
  cancelled: "neutral",
};

/**
 * The action button is coloured by the state it moves the order *into*, not by
 * the brand accent. During a rush staff read the colour before the word, so
 * "Ready" being green and "Cancel" being red is doing real work.
 */
const ACTION_COLOR                              = {
  placed: "var(--tone-warning)",
  accepted: "var(--tone-info)",
  preparing: "var(--tone-warning)",
  ready: "var(--tone-success)",
  completed: "var(--tone-success)",
  cancelled: "var(--tone-danger)",
};

function actionStyle(status             )                {
  const c = ACTION_COLOR[status];
  return {
    ...primaryBtn,
    background: c,
    borderColor: c,
    // These tone colours are all dark enough to carry white text in both themes.
    color: "#fff",
  };
}

export function Orders() {
  const { outlet } = useOutlet();
  const { can } = useAuth();

  const [search, setSearch] = useState("");
  const [statuses, setStatuses] = useState               ([]);
  const [channels, setChannels] = useState                ([]);
  const [payments, setPayments] = useState                 ([]);
  const [prints, setPrints] = useState               ([]);
  // Not auto-selected — the list opens showing every loaded order, and staff
  // narrow it down from there.
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [onlyLate, setOnlyLate] = useState(false);
  // Unpaid prepaid orders (abandoned checkout / failed payment) are hidden by
  // default; this reveals just them.
  const [showPending, setShowPending] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [editing, setEditing] = useState                   (null);
  const [expanded, setExpanded] = useState             (new Set());
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [confirming, setConfirming] = useState                                                                    (null);
  const [pageSize, setPageSize] = useState(loadPageSize);
  const [page, setPage] = useState(1);

  useEffect(() => {
    try {
      localStorage.setItem(PAGE_SIZE_KEY, String(pageSize));
    } catch {
      /* private window — it just won't be remembered */
    }
  }, [pageSize]);

  const ops = outlet?.config.operations;
  const orders = useOrders(outlet, undefined, ops?.orders.pollSeconds, showPending ? "only" : "hide");
  const pendingCount = orders.data?.counts.paymentPending ?? 0;
  const capacity = useCapacity(outlet, true, ops?.orders.pollSeconds ?? 10);
  const cap = capacity.data;
  const setStatus = useSetOrderStatus(outlet);
  const manual = useManualStatus(outlet);
  const printOn = usePrintOrderOn(outlet);
  const printers = usePrinters(outlet, can("printer:read"));
  const menu = useMenu(outlet);

  const stream = useOrderStream(outlet, can("order:read"));
  const all = useMemo(() => orders.data?.orders ?? [], [orders.data]);

  const orderIds = all.map((o) => o.id);
  const printStatus = useQuery({
    queryKey: ["order-print-status", outlet?._id, orderIds.join(",")],
    queryFn: () => api.printStatusForOrders(outlet , orderIds),
    enabled: Boolean(outlet) && can("printer:read") && orderIds.length > 0,
    refetchInterval: 15_000,
  });

  const openOrders = useMemo(() => all.filter((o) => OPEN_STATUSES.includes(o.status)), [all]);
  // No SLA chimes for abandoned prepaid checkouts — they're not the kitchen's
  // problem, and (default view) they're already excluded from `all` anyway.
  const sla = useSlaAlerts(showPending ? [] : openOrders, ops?.sla);
  const breachByOrder = useMemo(
    () => new Map(sla.breaches.map((b) => [b.orderId, b])),
    [sla.breaches],
  );

  const printSummaryFor = (id        )                           => printStatus.data?.status[id];

  const rows = all.filter((o) => {
    // In the payment-pending view the server already narrowed to that bucket —
    // don't also apply "open only", which would hide completed-but-unpaid ones.
    if (!showPending && onlyOpen && !OPEN_STATUSES.includes(o.status)) return false;
    if (onlyLate && !breachByOrder.has(o.id)) return false;
    if (statuses.length && !statuses.includes(o.status)) return false;
    if (channels.length && !channels.includes(o.channel)) return false;
    if (payments.length && !payments.includes(o.payment.status                 )) return false;

    if (prints.length) {
      const s = printSummaryFor(o.id);
      const state              = !s || s.total === 0 ? "none" : s.failed ? "failed" : s.pending ? "pending" : "printed";
      if (!prints.includes(state)) return false;
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const hay = `${o.orderNumber} ${o.customer?.name ?? ""} ${o.customer?.phone ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const sorted = ops?.orders.oldestFirst
    ? [...rows].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))
    : rows;

  const activeFilters = statuses.length + channels.length + payments.length + prints.length + (search ? 1 : 0);

  // A filter (or the page size) changing can leave `page` pointing past the
  // new end — reset to the first page rather than showing an empty table.
  useEffect(() => {
    setPage(1);
  }, [statuses, channels, payments, prints, search, onlyOpen, onlyLate, showPending, pageSize]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Always holds the currently visible order ids, read at key-press time —
  // registering the listener once (not on every filter change) while "]" still
  // expands exactly what's on screen right now.
  const sortedIdsRef = useRef          ([]);
  sortedIdsRef.current = sorted.map((o) => o.id);
  const refetchRef = useRef(orders.refetch);
  refetchRef.current = orders.refetch;

  useEffect(() => {
    const onKey = (e               ) => {
      const t = e.target                      ;
      // Don't hijack a shortcut while someone is typing in the search box or
      // any other field, and never fight a browser/OS shortcut that happens
      // to share a letter (Cmd/Ctrl+R, etc).
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "[") setExpanded(new Set());
      else if (e.key === "]") setExpanded(new Set(sortedIdsRef.current));
      else if (e.key === "/") {
        e.preventDefault();
        document.getElementById(SEARCH_INPUT_ID)?.focus();
      } else if (e.key === "r") {
        void refetchRef.current();
      } else if (e.key === "o") {
        setOnlyOpen((v) => !v);
      } else if (e.key === "?") {
        setShowShortcuts(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!can("order:read")) {
    return (
      <Card>
        <p>Your role can&apos;t view orders.</p>
      </Card>
    );
  }

  return (
    <>
      <div style={pageHead}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h1 style={{ fontFamily: "var(--font-heading)", fontSize: 26, margin: 0 }}>Orders</h1>
            <LiveBadge status={stream.status} refreshing={orders.isFetching} pollSeconds={ops?.orders.pollSeconds ?? 10} />
            {cap ? <CapacityPill status={cap} /> : null}
          </div>
          <p style={{ color: "var(--color-text-muted)", margin: "6px 0 0", fontSize: 13.5 }}>
            {showPending ? (
              <>{all.length} order{all.length === 1 ? "" : "s"} awaiting payment</>
            ) : (
              <>
                {openOrders.length} open · {all.length} loaded
                {pendingCount ? ` · ${pendingCount} awaiting payment` : ""}
              </>
            )}
          </p>
        </div>
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "var(--color-text-muted)" }}>
            Rows
            <Select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              style={{ fontSize: 12.5, padding: "5px 8px", width: "auto" }}
              aria-label="Rows per page"
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </label>
          <Button
            variant="outline"
            onClick={() => setShowShortcuts(true)}
            style={{ display: "inline-flex", gap: 6, alignItems: "center" }}
          >
            <Keyboard size={13} /> Shortcuts
          </Button>
        </span>
      </div>

      <SlaBanner sla={sla} onShowLate={() => setOnlyLate(true)} soundReady={sla.soundReady} />

      {/* ------------------------------------------------------------ filters */}

      <div style={toolbar}>
        <span
          style={{
            ...searchWrap,
            borderColor: searchFocused ? "var(--color-primary)" : "var(--color-border)",
            boxShadow: searchFocused ? "0 0 0 3px color-mix(in srgb, var(--color-primary) 18%, transparent)" : "none",
          }}
        >
          <Search size={14} style={{ color: "var(--color-text-muted)", flexShrink: 0 }} />
          <TextInput
            id={SEARCH_INPUT_ID}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Order number, customer, phone…"
            style={{ border: 0, outline: "none", background: "transparent", padding: "7px 2px", flex: 1, minWidth: 0 }}
          />
          {search ? (
            <button type="button" onClick={() => setSearch("")} style={clearBtn} aria-label="Clear search">
              <X size={13} />
            </button>
          ) : null}
        </span>

        <MultiFilter
          label="Status"
          icon={<Filter size={13} />}
          value={statuses}
          onChange={setStatuses}
          options={ORDER_STATUSES.map((s) => ({ value: s, label: ORDER_STATUS_LABELS[s] }))}
        />
        <MultiFilter
          label="Type"
          icon={<UtensilsCrossed size={13} />}
          value={channels}
          onChange={setChannels}
          options={ORDER_CHANNELS.map((c) => ({ value: c, label: CHANNEL_LABEL[c] ?? c }))}
        />
        <MultiFilter
          label="Payment"
          icon={<CreditCard size={13} />}
          value={payments}
          onChange={setPayments}
          options={[
            { value: "paid", label: "Paid" },
            { value: "pending", label: "Pending" },
            { value: "failed", label: "Failed" },
            { value: "refunded", label: "Refunded" },
          ]}
        />
        <MultiFilter
          label="Print"
          icon={<Printer size={13} />}
          value={prints}
          onChange={setPrints}
          options={[
            { value: "printed", label: "Printed" },
            { value: "failed", label: "Print failed" },
            { value: "pending", label: "Printing" },
            { value: "none", label: "Not printed" },
          ]}
        />

        <ToggleChip active={onlyOpen} onClick={() => setOnlyOpen((v) => !v)} icon={<Clock size={13} />}>
          Open only
        </ToggleChip>
        <ToggleChip active={onlyLate} onClick={() => setOnlyLate((v) => !v)} icon={<AlertTriangle size={13} />} danger>
          Running late{sla.breaches.length ? ` (${sla.breaches.length})` : ""}
        </ToggleChip>
        <ToggleChip
          active={showPending}
          onClick={() => setShowPending((v) => !v)}
          icon={<CreditCard size={13} />}
          danger
        >
          Payment pending{pendingCount ? ` (${pendingCount})` : ""}
        </ToggleChip>

        {activeFilters > 0 ? (
          <button
            type="button"
            onClick={() => {
              setStatuses([]);
              setChannels([]);
              setPayments([]);
              setPrints([]);
              setSearch("");
            }}
            style={clearAll}
          >
            Clear {activeFilters} filter{activeFilters === 1 ? "" : "s"}
          </button>
        ) : null}
      </div>

      {setStatus.error ? <Toast kind="error">{(setStatus.error         ).message}</Toast> : null}
      {manual.error ? <Toast kind="error">{(manual.error         ).message}</Toast> : null}
      {printOn.error ? <Toast kind="error">{(printOn.error         ).message}</Toast> : null}

      {/* -------------------------------------------------------------- table */}

      {orders.isLoading ? (
        <Card>
          <AwesomeLoader compact label="Loading orders…" subtext="Connecting to live stream" />
        </Card>
      ) : !sorted.length ? (
        <Card>
          <Empty
            icon={<ShoppingBag size={28} />}
            title={showPending ? "No orders awaiting payment" : "No orders match"}
          >
            {showPending
              ? "Prepaid orders where the customer didn't complete payment would show here."
              : activeFilters || onlyLate
                ? "Try clearing a filter."
                : "Orders will appear here as they come in."}
          </Empty>
        </Card>
      ) : (
        <Table minWidth={1040}>
          <thead>
            <tr>
              <Th width={34} />
              <Th width={92}>Order</Th>
              <Th width={170}>Customer</Th>
              <Th width={68} align="center">Type</Th>
              <Th width={70} align="center">Items</Th>
              <Th width={104} align="right">Amount</Th>
              <Th width={52} align="center">Print</Th>
              <Th width={148}>Status</Th>
              <Th width={92}>Waiting</Th>
              <Th width={220} align="right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((order) => (
              <OrderRow
                key={order.id}
                order={order}
                breach={breachByOrder.get(order.id)}
                printSummary={printSummaryFor(order.id)}
                printers={printers.data?.printers ?? []}
                canUpdate={can("order:update")}
                canPrint={can("print:job")}
                showTimer={ops?.orders.showTimers ?? true}
                isNew={stream.lastCreatedId === order.id}
                expanded={expanded.has(order.id)}
                onToggleExpand={() =>
                  setExpanded((prev) => {
                    const next = new Set(prev);
                    if (next.has(order.id)) next.delete(order.id);
                    else next.add(order.id);
                    return next;
                  })
                }
                onRequestStatus={(status, isManual) => setConfirming({ order, status, manual: isManual })}
                onPrint={(printerId) => printOn.mutate({ orderId: order.id, printerId })}
                onEdit={() => setEditing(order)}
              />
            ))}
          </tbody>
        </Table>
      )}

      {sorted.length > 0 ? (
        <div style={paginationBar}>
          <span style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>
            Page {currentPage} of {totalPages} · {sorted.length} order{sorted.length === 1 ? "" : "s"}
          </span>
          <span style={{ display: "inline-flex", gap: 6 }}>
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              style={pageBtn}
              aria-label="Previous page"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              style={pageBtn}
              aria-label="Next page"
            >
              <ChevronRight size={14} />
            </button>
          </span>
        </div>
      ) : null}

      {editing && outlet ? (
        <OrderEditModal outlet={outlet} order={editing} menu={menu.data} onClose={() => setEditing(null)} />
      ) : null}

      {confirming ? (
        <ConfirmDialog
          order={confirming.order}
          toStatus={confirming.status}
          manual={confirming.manual}
          busy={setStatus.isPending || manual.isPending}
          onCancel={() => setConfirming(null)}
          onConfirm={() => {
            if (confirming.manual) manual.mutate({ id: confirming.order.id, status: confirming.status });
            else setStatus.mutate({ id: confirming.order.id, status: confirming.status });
            setConfirming(null);
          }}
        />
      ) : null}

      {showShortcuts ? <ShortcutsModal onClose={() => setShowShortcuts(false)} /> : null}
    </>
  );
}

/* ------------------------------------------------------------------- row */

function OrderRow({
  order,
  breach,
  printSummary,
  printers,
  canUpdate,
  canPrint,
  showTimer,
  isNew,
  expanded,
  onToggleExpand,
  onRequestStatus,
  onPrint,
  onEdit,
}   
                    
                     
                              
                           
                     
                    
                     
                 
                    
                             
                                                                              
                                                                 
                                                                  
                                       
                     
 ) {
  const next = NEXT_STATUSES[order.status].filter((s) => s !== "cancelled");
  const primary = next[0];
  const Icon = CHANNEL_ICON[order.channel] ?? Store;
  const elapsed = statusSince(order);
  const activePrinters = printers.filter((p) => p.isActive);

  const itemCount = order.lines.reduce((n, l) => n + l.quantity, 0);
  // A note the kitchen needs to see — on the order as a whole, or on any line.
  // Marked on the collapsed row so staff know to expand rather than trusting the
  // ticket to have caught it.
  const hasNote = Boolean(order.note?.trim()) || order.lines.some((l) => l.note?.trim());

  return (
    <>
    <tr
      className={isNew ? "ot-anim-fade" : undefined}
      onClick={onToggleExpand}
      style={{
        // A late order is tinted across the whole row, so it reads at a glance
        // from across the counter without blocking anything. An expanded row
        // gets a faint tint of its own — NOT `--color-bg`, which is a different
        // token from the table's `--color-surface` and made the row look like
        // its background had been stripped rather than just marked "open".
        background: breach
          ? "var(--tone-danger-wash)"
          : expanded
            ? "color-mix(in srgb, var(--color-primary) 6%, var(--color-surface))"
            : undefined,
        cursor: "pointer",
      }}
    >
      <Td>
        <button
          type="button"
          // The whole row toggles, so this stops the click counting twice.
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand();
          }}
          style={expandBtn}
          aria-expanded={expanded}
          aria-label={expanded ? `Hide items in order ${order.orderNumber}` : `Show items in order ${order.orderNumber}`}
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
      </Td>

      <Td nowrap>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontWeight: 700, fontFamily: "var(--font-heading)" }}>#{order.orderNumber}</span>
          {hasNote ? (
            <span
              style={noteFlag}
              title="This order has a kitchen note — expand the row to read it"
              aria-label="Has a kitchen note"
            >
              <StickyNote size={12} aria-hidden />
            </span>
          ) : null}
        </span>
        <span style={{ display: "block", fontSize: 11, color: "var(--color-text-muted)" }}>
          {new Date(order.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </Td>

      <Td>
        <div style={{ maxWidth: 180 }}>
          <span
            style={{
              fontWeight: 600,
              display: "block",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={order.customer?.name || "Walk-in"}
          >
            {order.customer?.name || "Walk-in"}
          </span>
          {order.customer?.phone ? (
            <span style={{ display: "block", fontSize: 11.5, color: "var(--color-text-muted)", whiteSpace: "nowrap" }}>
              {order.customer.phone}
            </span>
          ) : null}
        </div>
      </Td>

      <Td align="center">
        <span title={CHANNEL_LABEL[order.channel] ?? order.channel}>
          <Pill icon={<Icon size={11} />}>{CHANNEL_SHORT[order.channel] ?? order.channel}</Pill>
        </span>
      </Td>

      <Td align="center">
        <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
          {order.lines.reduce((n, l) => n + l.quantity, 0)}
        </span>
      </Td>

      <Td align="right">
        <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{formatINR(order.totals.grandTotal)}</span>
      </Td>

      <Td align="center">
        <PrintCell summary={printSummary} />
      </Td>

      <Td>
        <Pill tone={STATUS_TONE[order.status]}>{ORDER_STATUS_LABELS[order.status]}</Pill>
        {breach ? (
          <span style={{ display: "block", fontSize: 10.5, color: "var(--tone-danger)", fontWeight: 700, marginTop: 3 }}>
            {breach.waitedMinutes}m — over {breach.limitMinutes}m limit
          </span>
        ) : null}
      </Td>

      <Td nowrap>
        {showTimer && OPEN_STATUSES.includes(order.status) ? (
          <span
            style={{
              fontVariantNumeric: "tabular-nums",
              fontWeight: breach ? 700 : 500,
              color: breach ? "var(--tone-danger)" : "var(--color-text-muted)",
            }}
          >
            {formatElapsed(elapsed)}
          </span>
        ) : (
          <span style={{ color: "var(--color-text-muted)" }}>—</span>
        )}
      </Td>

      <Td align="right">
        <span
          onClick={(e) => e.stopPropagation()}
          role="presentation"
          style={{ display: "inline-flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}
        >
          {canUpdate && primary ? (
            <Button onClick={() => onRequestStatus(primary, false)} style={actionStyle(primary)}>
              {ORDER_STATUS_LABELS[primary]}
            </Button>
          ) : null}

          {/* The third button: set any status directly, for a mis-tap. */}
          {canUpdate ? (
            <Menu
              header="Set status manually"
              selected={order.status}
              options={ORDER_STATUSES.map((s) => ({
                value: s,
                label: ORDER_STATUS_LABELS[s],
                description: s === order.status ? "Current" : undefined,
                danger: s === "cancelled",
              }))}
              onSelect={(s) => {
                if (s === order.status) return;
                onRequestStatus(s, true);
              }}
              trigger={({ toggle }) => (
                <button type="button" onClick={toggle} style={iconBtn} aria-label="Set status manually" title="Set status manually">
                  <ChevronDown size={14} />
                </button>
              )}
            />
          ) : null}

          {canPrint && activePrinters.length ? (
            <Menu
              header="Print this order on"
              options={activePrinters.map((p) => ({
                value: p.id,
                label: p.name,
                description: `${p.station} · ${p.docType}`,
                icon: <Printer size={13} />,
              }))}
              onSelect={onPrint}
              trigger={({ toggle }) => (
                <button type="button" onClick={toggle} style={iconBtn} aria-label="Print" title="Print this order">
                  <Printer size={14} />
                </button>
              )}
            />
          ) : null}

          {canUpdate ? (
            <Menu
              options={[
                { value: "edit", label: "Edit order", description: "Change items, customer or note", icon: <Pencil size={13} /> },
                { value: "cancel", label: "Cancel order", icon: <X size={13} />, danger: true, disabled: order.status === "cancelled" },
              ]}
              onSelect={(v) => {
                if (v === "edit") onEdit();
                if (v === "cancel") onRequestStatus("cancelled", true);
              }}
              trigger={({ toggle }) => (
                <button type="button" onClick={toggle} style={iconBtn} aria-label="More actions">
                  <MoreHorizontal size={14} />
                </button>
              )}
            />
          ) : null}
        </span>
      </Td>
    </tr>

    {expanded ? (
      <tr>
        <td colSpan={10} style={detailCell}>
          <div className="ot-anim-fade" style={detailBox}>
            {/* --------------------------------------------------- order facts */}
            <SectionHead icon={<Store size={13} />}>Order details</SectionHead>
            <div style={factGrid}>
              <Fact icon={<Icon size={13} />} label="Type" value={CHANNEL_LABEL[order.channel] ?? order.channel} />
              <Fact
                icon={<User size={13} />}
                label="Placed by"
                value={
                  order.placedBy === "staff"
                    ? `${PLACED_BY_LABELS.staff} — ${order.staffName || "unnamed"}`
                    : PLACED_BY_LABELS.customer
                }
              />
              <Fact
                icon={<Clock size={13} />}
                label="Placed at"
                value={new Date(order.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
              />
              {order.etaMinutes ? <Fact icon={<Timer size={13} />} label="Quoted ETA" value={`${order.etaMinutes} min`} /> : null}
              {order.couponCode ? (
                <Fact
                  icon={<Tag size={13} />}
                  label="Coupon"
                  value={`${order.couponCode}${order.totals.discount ? ` — ${formatINR(order.totals.discount)} off` : ""}`}
                />
              ) : null}
              {order.tableId ? <Fact icon={<UtensilsCrossed size={13} />} label="Table session" value="Linked to an open table" /> : null}
            </div>

            {/* ------------------------------------------------------- customer */}
            {order.customer?.name || order.customer?.phone || order.customer?.email ? (
              <>
                <SectionHead icon={<User size={13} />}>Customer</SectionHead>
                <div style={factGrid}>
                  {order.customer?.name ? <Fact label="Name" value={order.customer.name} /> : null}
                  {order.customer?.phone ? <Fact label="Phone" value={order.customer.phone} /> : null}
                  {order.customer?.email ? <Fact label="Email" value={order.customer.email} /> : null}
                </div>
              </>
            ) : null}

            {/* -------------------------------------------------------- payment */}
            <SectionHead icon={<Wallet size={13} />}>Payment</SectionHead>
            <div style={factGrid}>
              <Fact
                label="Method"
                value={order.payment.gateway === "cod" ? "Cash on delivery / at counter" : `Prepaid — ${order.payment.gateway}`}
              />
              <Fact
                label="Status"
                value={order.payment.status}
                tone={order.payment.status === "paid" ? "ok" : order.payment.status === "failed" ? "error" : "warn"}
              />
              {order.payment.paymentId ? <Fact label="Payment ref" value={order.payment.paymentId} mono /> : null}
            </div>

            {/* ------------------------------------------------------- delivery */}
            {order.deliveryAddress ? (
              <>
                <SectionHead icon={<MapPin size={13} />}>Delivery address</SectionHead>
                <div style={{ fontSize: 13, marginBottom: 14, lineHeight: 1.5 }}>
                  {order.deliveryAddress.text}
                  {order.deliveryAddress.landmark ? (
                    <span style={{ color: "var(--color-text-muted)" }}> · near {order.deliveryAddress.landmark}</span>
                  ) : null}
                  <span style={{ display: "block", fontSize: 11.5, color: "var(--color-text-muted)" }}>
                    {order.deliveryAddress.distanceKm} km from the outlet
                  </span>
                </div>
              </>
            ) : null}

            {/* ----------------------------------------------------------- items */}
            <SectionHead icon={<UtensilsCrossed size={13} />}>
              {itemCount} item{itemCount === 1 ? "" : "s"}
            </SectionHead>

            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <tbody>
                {order.lines.map((line, i) => (
                  <tr key={i}>
                    <td style={{ ...detailTd, width: 44, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                      {line.quantity}×
                    </td>
                    <td style={detailTd}>
                      <span style={{ fontWeight: 600 }}>{line.name}</span>
                      {line.variantLabel ? (
                        <span style={{ color: "var(--color-text-muted)" }}> · {line.variantLabel}</span>
                      ) : null}
                      {line.modifiers.length ? (
                        <span style={{ display: "block", fontSize: 12, color: "var(--color-text-muted)" }}>
                          + {line.modifiers.map((m) => m.label).join(", ")}
                        </span>
                      ) : null}
                      {line.note ? (
                        <span style={{ display: "block", fontSize: 12, color: "var(--tone-warning)", fontWeight: 600 }}>
                          ! {line.note}
                        </span>
                      ) : null}
                    </td>
                    <td style={{ ...detailTd, textAlign: "right", fontVariantNumeric: "tabular-nums", width: 100 }}>
                      {formatINR(line.lineTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={detailTotals}>
              <span>Subtotal <strong>{formatINR(order.totals.subtotal)}</strong></span>
              {order.totals.discount ? (
                <span style={{ color: "var(--tone-success)" }}>Discount <strong>− {formatINR(order.totals.discount)}</strong></span>
              ) : null}
              {order.totals.deliveryFee ? <span>Delivery <strong>{formatINR(order.totals.deliveryFee)}</strong></span> : null}
              {order.totals.serviceCharge ? <span>Service <strong>{formatINR(order.totals.serviceCharge)}</strong></span> : null}
              {order.totals.taxAmount ? (
                <span>
                  CGST <strong>{formatINR(order.totals.cgst)}</strong> · SGST <strong>{formatINR(order.totals.sgst)}</strong>
                </span>
              ) : null}
              {order.totals.roundOff ? <span>Round off <strong>{formatINR(order.totals.roundOff)}</strong></span> : null}
              <span style={{ marginLeft: "auto", fontSize: 15 }}>
                Total <strong>{formatINR(order.totals.grandTotal)}</strong>
              </span>
            </div>
            {order.pricesIncludeTax ? (
              <p style={{ fontSize: 11, color: "var(--color-text-muted)", margin: "4px 0 0" }}>Prices include GST.</p>
            ) : null}

            {order.note ? (
              <div style={detailNote}>
                <strong>Kitchen note:</strong> {order.note}
              </div>
            ) : null}

            {/* -------------------------------------------------------- history */}
            {order.statusHistory.length ? (
              <>
                <SectionHead icon={<Clock size={13} />}>Status history</SectionHead>
                <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 4 }}>
                  {order.statusHistory.map((h, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 8, fontSize: 12.5 }}>
                      <span style={{ color: "var(--color-text-muted)", fontVariantNumeric: "tabular-nums", minWidth: 64 }}>
                        {new Date(h.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span style={{ fontWeight: 600 }}>{ORDER_STATUS_LABELS[h.status]}</span>
                      {h.manual ? <Pill tone="info">manual{h.from ? ` from ${ORDER_STATUS_LABELS[h.from]}` : ""}</Pill> : null}
                      {h.edited ? <Pill tone="info">edited</Pill> : null}
                      {h.reason ? <span style={{ color: "var(--color-text-muted)" }}>— {h.reason}</span> : null}
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </td>
      </tr>
    ) : null}
    </>
  );
}

/* ------------------------------------------------------------ small parts */

/** A section title inside the expanded row — same look for every sub-section. */
function SectionHead({ icon, children }                                                      ) {
  return (
    <div style={detailHead}>
      {icon}
      {children}
    </div>
  );
}

/** One label/value pair in the expanded row's fact grid. */
function Fact({
  icon,
  label,
  value,
  tone,
  mono,
}   
                         
                
                
                                 
                 
 ) {
  const color = tone === "ok" ? "var(--tone-success)" : tone === "error" ? "var(--tone-danger)" : tone === "warn" ? "var(--tone-warning)" : "var(--color-text)";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 120 }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--color-text-muted)" }}>
        {icon}
        {label}
      </span>
      <span style={{ fontSize: 13, fontWeight: 600, color, fontFamily: mono ? "ui-monospace, monospace" : undefined }}>{value}</span>
    </div>
  );
}

/** A keyboard key, styled like a physical cap — for the "[ / ]" shortcut hint. */
function Kbd({ children }                               ) {
  return <kbd style={kbdStyle}>{children}</kbd>;
}

/**
 * A coloured icon badge instead of a text pill — the print column only ever
 * needs to answer "did it print", and an icon says that in a third of the
 * width, leaving more of the row for everything else.
 */
function PrintCell({ summary }                            ) {
  if (!summary || summary.total === 0) {
    return <IconChip tone="neutral" icon={<X size={13} />} label="Not printed" />;
  }
  if (summary.failed) {
    return (
      <IconChip
        tone="error"
        icon={<AlertTriangle size={13} />}
        label={`${summary.failed} print job${summary.failed === 1 ? "" : "s"} failed`}
      />
    );
  }
  if (summary.pending) {
    return <IconChip tone="warn" icon={<Clock size={13} />} label={`Printing — ${summary.printed}/${summary.total} done`} />;
  }
  return <IconChip tone="ok" icon={<CheckCircle2 size={13} />} label="Printed" />;
}

function LiveBadge({
  status,
  refreshing,
  pollSeconds,
}   
                                            
                      
                      
 ) {
  const map = {
    live: { tone: "ok"         , label: "Live", title: "Connected — orders arrive the moment they're placed." },
    connecting: { tone: "warn"         , label: "Connecting…", title: "Opening the live connection." },
    offline: {
      tone: "warn"         ,
      label: `Reconnecting · polling ${pollSeconds}s`,
      title: "The live connection dropped. Falling back to refreshing the list on a timer.",
    },
  }[status];

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }} title={map.title}>
      {refreshing ? <RefreshCw size={13} className="ot-spin" style={{ color: "var(--color-text-muted)" }} /> : null}
      <Pill tone={map.tone} icon={status === "live" ? <Radio size={11} /> : <RefreshCw size={11} className={status === "connecting" ? "ot-spin" : undefined} />}>
        {map.label}
      </Pill>
    </span>
  );
}

/** The load-management badge — only appears once something is actually off normal. */
function CapacityPill({ status }                            ) {
  if (!status.enabled || (status.orderLevel === "normal" && status.deliveryLevel === "normal")) return null;

  const stopped = status.orderLevel === "stopped" || status.deliveryLevel === "stopped";
  const label =
    status.orderLevel === "stopped"
      ? "Not accepting orders"
      : status.deliveryLevel === "stopped"
        ? "Delivery off"
        : status.orderLevel === "high"
          ? "High orders"
          : "Limited riders";
  const title = [status.orderMessage, status.deliveryMessage].filter(Boolean).join(" · ");

  return (
    <span title={title}>
      <Pill tone={stopped ? "error" : "warn"} icon={<Gauge size={11} />}>
        {label}
      </Pill>
    </span>
  );
}

/**
 * Every status-changing button in this table routes through here rather than
 * mutating on click — a busy service is exactly when a mis-tap costs the
 * most (marking the wrong order Ready, cancelling instead of accepting).
 * `Enter` confirms and `Esc` cancels, mirrored as tooltips on the two
 * buttons so the shortcut is discoverable without opening the Shortcuts panel.
 */
function ConfirmDialog({
  order,
  toStatus,
  manual,
  busy,
  onConfirm,
  onCancel,
}   
                    
                        
                  
                
                        
                       
 ) {
  useEffect(() => {
    const onKey = (e               ) => {
      if (e.key === "Enter") {
        e.preventDefault();
        onConfirm();
      }
      // Esc is handled by Modal itself (calls onCancel).
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onConfirm]);

  const isCancel = toStatus === "cancelled";

  return (
    <Modal onClose={onCancel} width={400} ariaLabel="Confirm status change">
      <div style={confirmBody}>
        <span style={{ ...confirmIcon, background: `color-mix(in srgb, ${ACTION_COLOR[toStatus]} 16%, transparent)`, color: ACTION_COLOR[toStatus] }}>
          {isCancel ? <X size={19} /> : <CheckCircle2 size={19} />}
        </span>
        <h3 style={{ margin: "12px 0 4px", fontSize: 16, fontFamily: "var(--font-heading)" }}>
          {isCancel ? `Cancel order #${order.orderNumber}?` : `Mark order #${order.orderNumber} as ${ORDER_STATUS_LABELS[toStatus]}?`}
        </h3>
        <p style={{ margin: 0, fontSize: 13, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
          {isCancel
            ? "This can't be undone from here — the order is removed from the active queue."
            : manual
              ? "This sets the status directly, overriding the normal step-by-step flow."
              : "Any printers or alerts configured for this status fire immediately."}
        </p>
      </div>
      <footer style={confirmFooter}>
        <Button variant="outline" type="button" onClick={onCancel} disabled={busy} title="Shortcut key: Esc">
          Cancel
        </Button>
        <Button type="button" onClick={onConfirm} disabled={busy} style={actionStyle(toStatus)} title="Shortcut key: Enter">
          {busy ? "Working…" : "Confirm"}
        </Button>
      </footer>
    </Modal>
  );
}

function ShortcutsModal({ onClose }                         ) {
  return (
    <Modal onClose={onClose} width={420} ariaLabel="Keyboard shortcuts">
      <header style={shortcutsHeader}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
          <span style={shortcutsHeaderIcon}>
            <Keyboard size={16} />
          </span>
          <h3 style={{ margin: 0, fontSize: 16, fontFamily: "var(--font-heading)" }}>Keyboard shortcuts</h3>
        </span>
        <button type="button" onClick={onClose} style={iconBtn} aria-label="Close">
          <X size={15} />
        </button>
      </header>
      <div style={{ padding: "6px 20px 20px", display: "flex", flexDirection: "column", gap: 11 }}>
        {SHORTCUTS.map((s) => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, fontSize: 13 }}>
            <span>{s.label}</span>
            <span style={{ display: "inline-flex", gap: 4, flexShrink: 0 }}>
              {s.keys.map((k) => (
                <Kbd key={k}>{k}</Kbd>
              ))}
            </span>
          </div>
        ))}
      </div>
    </Modal>
  );
}

/**
 * The missed-order warning.
 *
 * Deliberately a banner and not a modal: it must be impossible to miss and
 * equally impossible for it to stop somebody working. Staff can dismiss a
 * specific order and carry on; the row stays tinted underneath.
 */
function SlaBanner({
  sla,
  onShowLate,
  soundReady,
}   
                                       
                         
                      
 ) {
  if (!sla.breaches.length) return null;
  const worst = sla.breaches[0] ;

  return (
    <div style={banner} role="status" aria-live="polite">
      <span style={bannerIcon}>
        <AlertTriangle size={17} />
      </span>

      <div style={{ flex: 1, minWidth: 200 }}>
        <strong style={{ fontSize: 14 }}>
          {sla.breaches.length === 1
            ? `Order #${worst.orderNumber} needs attention`
            : `${sla.breaches.length} orders need attention`}
        </strong>
        <div style={{ fontSize: 12.5, marginTop: 3, lineHeight: 1.5 }}>
          #{worst.orderNumber} {worst.message} for <strong>{worst.waitedMinutes} minutes</strong> — the limit is{" "}
          {worst.limitMinutes}.
          {sla.breaches.length > 1 ? ` And ${sla.breaches.length - 1} more.` : ""}
        </div>
        {!soundReady ? (
          <div style={{ fontSize: 11.5, marginTop: 5, opacity: 0.85, display: "inline-flex", gap: 5, alignItems: "center" }}>
            <BellOff size={11} /> Click anywhere once to allow the alert sound.
          </div>
        ) : (
          <div style={{ fontSize: 11.5, marginTop: 5, opacity: 0.85, display: "inline-flex", gap: 5, alignItems: "center" }}>
            <Bell size={11} /> Sound on
          </div>
        )}
      </div>

      <span style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
        <Button variant="outline" onClick={onShowLate} style={{ fontSize: 12.5, padding: "6px 12px" }}>
          Show late orders
        </Button>
        <button type="button" onClick={sla.dismissAll} style={clearBtn} aria-label="Dismiss all warnings">
          <X size={15} />
        </button>
      </span>
    </div>
  );
}

function ToggleChip({
  active,
  onClick,
  icon,
  danger,
  children,
}   
                  
                      
                         
                   
                            
 ) {
  const accent = danger ? "var(--tone-danger)" : "var(--color-primary)";
  return (
    <button
      type="button"
      onClick={onClick}
      className="ot-press"
      style={{
        ...chipBtn,
        borderColor: active ? accent : "var(--color-border)",
        background: active ? `color-mix(in srgb, ${accent} 12%, var(--color-bg))` : "var(--color-bg)",
        color: active ? accent : "var(--color-text)",
      }}
    >
      {icon}
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ styles */

// Sticky, same trick as PageHeader in ui.jsx — the content area has no top
// padding of its own, so this supplies it and stays pinned while the table
// scrolls underneath. The gap below is padding, not margin: a margin isn't
// part of the sticky box, so it scrolls out from underneath once stuck and
// scrolled content ends up touching the header.
const pageHead                = {
  position: "sticky",
  top: 0,
  zIndex: 5,
  background: "var(--color-bg)",
  paddingTop: 28,
  paddingBottom: 18,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  flexWrap: "wrap",
};
const toolbar                = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  alignItems: "center",
  marginBottom: 16,
};
const searchWrap                = {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  padding: "0 10px",
  borderRadius: 8,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--color-border)",
  background: "var(--color-bg)",
  width: 300,
  maxWidth: "100%",
  transition: "border-color 120ms, box-shadow 120ms",
};
const chipBtn                = {
  font: "inherit",
  fontSize: 12.5,
  fontWeight: 600,
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "7px 12px",
  borderRadius: 8,
  border: "1px solid var(--color-border)",
  cursor: "pointer",
  whiteSpace: "nowrap",
};
const clearBtn                = {
  font: "inherit",
  display: "grid",
  placeItems: "center",
  width: 24,
  height: 24,
  padding: 0,
  border: 0,
  borderRadius: 6,
  background: "transparent",
  color: "inherit",
  cursor: "pointer",
  flexShrink: 0,
};
const clearAll                = {
  font: "inherit",
  fontSize: 12.5,
  padding: "7px 10px",
  border: 0,
  borderRadius: 8,
  background: "transparent",
  color: "var(--color-text-muted)",
  cursor: "pointer",
  textDecoration: "underline",
};
const primaryBtn                = { fontSize: 12.5, padding: "7px 13px", whiteSpace: "nowrap" };
const iconBtn                = {
  font: "inherit",
  display: "grid",
  placeItems: "center",
  width: 32,
  height: 32,
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  background: "var(--color-bg)",
  color: "var(--color-text)",
  cursor: "pointer",
  flexShrink: 0,
};
const noteFlag                = {
  display: "inline-grid",
  placeItems: "center",
  width: 18,
  height: 18,
  borderRadius: 5,
  background: "var(--tone-warning-wash)",
  color: "var(--tone-warning)",
  flexShrink: 0,
};
const expandBtn                = {
  font: "inherit",
  display: "grid",
  placeItems: "center",
  width: 24,
  height: 24,
  padding: 0,
  border: 0,
  borderRadius: 6,
  background: "transparent",
  color: "var(--color-text-muted)",
  cursor: "pointer",
};
const detailCell                = {
  padding: 0,
  borderBottom: "1px solid var(--color-border)",
  background: "var(--color-bg)",
};
const detailBox                = { padding: "14px 18px 16px 52px" };
const detailHead                = {
  display: "flex",
  alignItems: "center",
  gap: 7,
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--color-text-muted)",
  margin: "18px 0 9px",
};
const factGrid                = {
  display: "flex",
  flexWrap: "wrap",
  gap: "10px 24px",
  marginBottom: 14,
};
const kbdStyle                = {
  display: "inline-block",
  font: "inherit",
  fontSize: 11,
  fontWeight: 700,
  padding: "1px 6px",
  borderRadius: 4,
  border: "1px solid var(--color-border)",
  borderBottomWidth: 2,
  background: "var(--color-surface)",
  color: "var(--color-text)",
};
const detailTd                = { padding: "6px 8px", borderBottom: "1px solid var(--color-border)", verticalAlign: "top" };
const detailTotals                = {
  display: "flex",
  gap: 18,
  flexWrap: "wrap",
  alignItems: "baseline",
  marginTop: 10,
  fontSize: 12.5,
  color: "var(--color-text-muted)",
};
const detailNote                = {
  marginTop: 10,
  padding: "8px 11px",
  borderRadius: 8,
  background: "var(--tone-warning-wash)",
  color: "var(--tone-warning)",
  fontSize: 12.5,
};
const banner                = {
  display: "flex",
  gap: 12,
  alignItems: "center",
  flexWrap: "wrap",
  padding: "13px 15px",
  borderRadius: 11,
  border: "1px solid var(--tone-danger)",
  background: "var(--tone-danger-wash)",
  color: "var(--tone-danger)",
  marginBottom: 16,
};
const bannerIcon                = {
  display: "grid",
  placeItems: "center",
  width: 34,
  height: 34,
  borderRadius: 9,
  background: "color-mix(in srgb, var(--tone-danger) 18%, transparent)",
  flexShrink: 0,
};
const paginationBar                = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  marginTop: 12,
};
const pageBtn                = {
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
};
const confirmBody                = { padding: "22px 22px 16px", textAlign: "center" };
const confirmIcon                = {
  display: "inline-grid",
  placeItems: "center",
  width: 44,
  height: 44,
  borderRadius: "50%",
};
const confirmFooter                = {
  display: "flex",
  gap: 9,
  justifyContent: "center",
  padding: "14px 20px",
  borderTop: "1px solid var(--color-border)",
  background: "var(--color-surface)",
};
const shortcutsHeader                = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: "16px 20px",
  borderBottom: "1px solid var(--color-border)",
};
const shortcutsHeaderIcon                = {
  display: "grid",
  placeItems: "center",
  width: 32,
  height: 32,
  borderRadius: 9,
  background: "color-mix(in srgb, var(--color-primary) 14%, transparent)",
  color: "var(--color-primary)",
  flexShrink: 0,
};
