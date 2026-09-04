import { useMemo, useState } from "react";
                                           
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { formatINR,                                      } from "@onetap/config-schema";
import {
  Minus,
  NotepadText,
  Phone,
  Plus,
  Search,
  ShoppingBasket,
  Trash2,
  User,
  UtensilsCrossed,
  X,
} from "lucide-react";
import * as api from "../../lib/api";
                                                        
import { Button, Field, InfoHint, Modal, Note, Pill, TextInput, Toast } from "../../ui";

                     
              
                 
                     
               
                        
                    
                   
                
                                                                            
                    
 

/**
 * Edit an order after it has been placed — the customer adds a drink, or the
 * kitchen is out of something.
 *
 * The totals shown here are an estimate. The server re-prices the whole cart
 * against the live menu on save, so nothing here can talk the price down; if the
 * two disagree, the server's number is the one that sticks.
 */
export function OrderEditModal({
  outlet,
  order,
  menu,
  onClose,
}   
                 
                    
                             
                      
 ) {
  const qc = useQueryClient();
  const [lines, setLines] = useState             (() =>
    order.lines.map((l, i) => ({
      key: `existing-${i}`,
      itemId: l.itemId,
      variantId: l.variantId,
      name: l.name,
      variantLabel: l.variantLabel,
      unitPrice: l.unitPrice,
      quantity: l.quantity,
      note: l.note,
      existing: true,
    })),
  );
  const [note, setNote] = useState(order.note ?? "");
  const [name, setName] = useState(order.customer?.name ?? "");
  const [phone, setPhone] = useState(order.customer?.phone ?? "");
  const [search, setSearch] = useState("");
  const [picking, setPicking] = useState(false);

  const save = useMutation({
    mutationFn: () =>
      api.editOrder(outlet, order.id, {
        cart: {
          lines: lines.map((l) => ({
            itemId: l.itemId,
            variantId: l.variantId,
            quantity: l.quantity,
            modifiers: [],
            note: l.note,
          })),
        },
        note,
        customerName: name,
        customerPhone: phone,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["orders"] });
      onClose();
    },
  });

  const estimate = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const delta = estimate - order.totals.grandTotal;

  const catalogue = useMemo(() => {
    if (!menu) return [];
    const q = search.trim().toLowerCase();
    const categoryName = new Map(menu.categories.map((c) => [c.id, c.name]));
    return menu.items
      .filter((item) => item.isAvailable && (!q || item.name.toLowerCase().includes(q)))
      .map((item) => ({ item, category: categoryName.get(item.categoryId) ?? "" }))
      .slice(0, 40);
  }, [menu, search]);

  const addItem = (item          ) => {
    const variant = item.variants?.[0];
    setLines((prev) => [
      ...prev,
      {
        key: `new-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        itemId: item.id,
        variantId: variant?.id,
        name: item.name,
        variantLabel: variant?.label,
        unitPrice: variant?.price ?? item.basePrice,
        quantity: 1,
        existing: false,
      },
    ]);
    setPicking(false);
    setSearch("");
  };

  const setQty = (key        , q        ) =>
    setLines((prev) =>
      q <= 0 ? prev.filter((l) => l.key !== key) : prev.map((l) => (l.key === key ? { ...l, quantity: q } : l)),
    );

  return (
    <Modal onClose={onClose} width={640} ariaLabel={`Edit order ${order.orderNumber}`}>
        <header style={header}>
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <span style={headerIcon}>
              <NotepadText size={18} />
            </span>
            <div>
              <h3 style={{ margin: 0, fontFamily: "var(--font-heading)", fontSize: 18 }}>Edit order #{order.orderNumber}</h3>
              <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--color-text-muted)" }}>
                {order.channel} · placed {new Date(order.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} style={closeBtn} aria-label="Close">
            <X size={17} />
          </button>
        </header>

        <div style={body}>
          <Note icon={<ShoppingBasket size={15} />}>
            Prices are recalculated from the live menu when you save, so this total is an estimate. The change is
            recorded against the order with your name on it.
          </Note>

          {/* ------------------------------------------------------- items */}

          <div style={sectionHead}>
            <UtensilsCrossed size={14} />
            Items
            <InfoHint
              title="Editing items"
              text="Change quantities, remove a line, or add something new. Setting a quantity to zero removes the line. An order needs at least one item — you cannot empty it here; cancel the order instead."
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
            {lines.map((line) => (
              <div key={line.key} style={lineRow}>
                <span style={lineThumb} aria-hidden>
                  <UtensilsCrossed size={15} />
                </span>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>
                    {line.name}
                    {!line.existing ? (
                      <span style={{ marginLeft: 7 }}>
                        <Pill tone="info">added</Pill>
                      </span>
                    ) : null}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                    {line.variantLabel ? `${line.variantLabel} · ` : ""}
                    {formatINR(line.unitPrice)} each
                  </div>
                </div>

                <span style={stepper}>
                  <button type="button" onClick={() => setQty(line.key, line.quantity - 1)} style={stepBtn} aria-label="One fewer">
                    <Minus size={13} />
                  </button>
                  <span style={{ minWidth: 22, textAlign: "center", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                    {line.quantity}
                  </span>
                  <button type="button" onClick={() => setQty(line.key, line.quantity + 1)} style={stepBtn} aria-label="One more">
                    <Plus size={13} />
                  </button>
                </span>

                <span style={{ minWidth: 76, textAlign: "right", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                  {formatINR(line.unitPrice * line.quantity)}
                </span>

                <button type="button" onClick={() => setQty(line.key, 0)} style={rowDelete} aria-label={`Remove ${line.name}`}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            {!lines.length ? (
              <p style={{ fontSize: 13, color: "var(--tone-danger)", margin: 0 }}>
                An order needs at least one item. Add something, or cancel the order instead.
              </p>
            ) : null}
          </div>

          {picking ? (
            <div style={picker}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <Search size={14} style={{ color: "var(--color-text-muted)" }} />
                <TextInput
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search the menu…"
                  style={{ flex: 1, fontSize: 13 }}
                />
                <button type="button" onClick={() => setPicking(false)} style={closeBtn} aria-label="Close menu">
                  <X size={15} />
                </button>
              </div>
              <div style={{ maxHeight: 210, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
                {catalogue.map(({ item, category }) => (
                  <button key={item.id} type="button" onClick={() => addItem(item)} style={pickRow}>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontWeight: 600, fontSize: 13 }}>{item.name}</span>
                      <span style={{ display: "block", fontSize: 11.5, color: "var(--color-text-muted)" }}>{category}</span>
                    </span>
                    <Plus size={14} />
                  </button>
                ))}
                {!catalogue.length ? (
                  <p style={{ fontSize: 12.5, color: "var(--color-text-muted)", margin: 6 }}>Nothing matches that.</p>
                ) : null}
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              type="button"
              onClick={() => setPicking(true)}
              style={{ fontSize: 13, display: "inline-flex", gap: 7, alignItems: "center", marginBottom: 16 }}
            >
              <Plus size={14} /> Add an item
            </Button>
          )}

          {/* ------------------------------------------------------ totals */}

          <div style={totalsBox}>
            <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>Estimated total</span>
            <span style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              {delta !== 0 ? (
                <Pill tone={delta > 0 ? "warn" : "ok"}>
                  {delta > 0 ? "+" : "−"}
                  {formatINR(Math.abs(delta))}
                </Pill>
              ) : null}
              <strong style={{ fontSize: 18, fontVariantNumeric: "tabular-nums" }}>{formatINR(estimate)}</strong>
            </span>
          </div>

          {/* ---------------------------------------------------- customer */}

          <div style={sectionHead}>
            <User size={14} />
            Customer & notes
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Field
              label="Name"
              info="Who the order is for. Printed on the receipt and read out when the food is ready — fix a misheard name here."
              style={{ flex: 1, minWidth: 190, maxWidth: "none" }}
            >
              <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Walk-in" />
            </Field>
            <Field
              label="Phone"
              info="Used to call the customer if there is a problem with the order, and to send a digital receipt if that is switched on."
              style={{ flex: 1, minWidth: 190, maxWidth: "none" }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Phone size={14} style={{ color: "var(--color-text-muted)", flexShrink: 0 }} />
                <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} style={{ flex: 1 }} />
              </span>
            </Field>
          </div>

          <Field
            label="Kitchen note"
            info="Anything the cooks need to know — 'less spicy', 'no onion', 'pack separately'. This prints on the kitchen ticket in bold."
            style={{ maxWidth: "none" }}
          >
            <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="Less spicy, no onion…" />
          </Field>

          {save.error ? <Toast kind="error">{(save.error         ).message}</Toast> : null}
        </div>

        <footer style={footer}>
          <Button variant="outline" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={!lines.length || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Saving…" : "Save changes"}
          </Button>
        </footer>
    </Modal>
  );
}

/* ------------------------------------------------------------------ styles */

const header                = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  padding: "18px 20px",
  borderBottom: "1px solid var(--color-border)",
};
const headerIcon                = {
  display: "grid",
  placeItems: "center",
  width: 38,
  height: 38,
  borderRadius: 10,
  background: "color-mix(in srgb, var(--color-primary) 14%, transparent)",
  color: "var(--color-primary)",
  flexShrink: 0,
};
const body                = { padding: "16px 20px", overflowY: "auto", flex: 1 };
const footer                = {
  display: "flex",
  gap: 9,
  justifyContent: "flex-end",
  padding: "14px 20px",
  borderTop: "1px solid var(--color-border)",
  background: "var(--color-surface)",
};
const sectionHead                = {
  display: "flex",
  alignItems: "center",
  gap: 7,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--color-text-muted)",
  margin: "16px 0 9px",
};
const lineRow                = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "9px 11px",
  border: "1px solid var(--color-border)",
  borderRadius: 10,
  background: "var(--color-surface)",
};
const lineThumb                = {
  display: "grid",
  placeItems: "center",
  width: 34,
  height: 34,
  borderRadius: 8,
  background: "var(--color-bg)",
  color: "var(--color-text-muted)",
  flexShrink: 0,
};
const stepper                = {
  display: "inline-flex",
  alignItems: "center",
  gap: 3,
  padding: 3,
  borderRadius: 8,
  border: "1px solid var(--color-border)",
  background: "var(--color-bg)",
};
const stepBtn                = {
  font: "inherit",
  display: "grid",
  placeItems: "center",
  width: 24,
  height: 24,
  border: 0,
  borderRadius: 6,
  background: "transparent",
  color: "var(--color-text)",
  cursor: "pointer",
};
const rowDelete                = {
  font: "inherit",
  display: "grid",
  placeItems: "center",
  width: 28,
  height: 28,
  border: "1px solid var(--color-border)",
  borderRadius: 7,
  background: "var(--color-bg)",
  color: "var(--tone-danger)",
  cursor: "pointer",
  flexShrink: 0,
};
const closeBtn                = {
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
const picker                = {
  border: "1px solid var(--color-border)",
  borderRadius: 10,
  padding: 11,
  background: "var(--color-surface)",
  marginBottom: 16,
};
const pickRow                = {
  font: "inherit",
  display: "flex",
  alignItems: "center",
  gap: 10,
  width: "100%",
  padding: "8px 10px",
  border: 0,
  borderRadius: 8,
  background: "var(--color-bg)",
  color: "var(--color-text)",
  cursor: "pointer",
  textAlign: "left",
};
const totalsBox                = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "12px 14px",
  borderRadius: 10,
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
};
