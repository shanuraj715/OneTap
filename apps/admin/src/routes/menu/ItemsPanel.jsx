import { useMemo, useState } from "react";
import { categoryPathLabel, categorySubtreeIds, flattenCategories, itemImageUrl, itemPriceLabel } from "@rasoipulse/config-schema";
import { Download, Sparkles, Trash2 } from "lucide-react";
import { useAuth } from "../../lib/useAuth";
import { useDeleteItem, useDeleteItems, useUpdateItem } from "../../lib/useMenu";
import { Button, Card, Checkbox, Modal, Toast } from "../../ui";
import { GenerateImagesDialog } from "./GenerateImagesDialog";
import { bulkBar, checkStyle, dangerBtn, iconBtn, linkBtn, selectAllState } from "./shared";

/**
 * The dishes of the selected category — and, if you like, of the categories inside it. Tick any number of them to
 * delete them together.
 */
export function ItemsPanel({ outlet, menu, categoryId, onNew, onEdit, onImport, selection }) {
  const update = useUpdateItem(outlet);
  const removeOne = useDeleteItem(outlet);
  const [includeInside, setIncludeInside] = useState(true);
  const [confirming, setConfirming] = useState(null); // item ids being confirmed
  // AI pictures are the platform admin's tool: the button exists only for them, never for a store owner or their team
  const isSuperAdmin = Boolean(useAuth().user?.isSuperAdmin);
  const [aiItem, setAiItem] = useState(null);

  const categories = menu.categories;
  const order = useMemo(() => new Map(flattenCategories(categories).map((e, n) => [e.category.id, n])), [categories]);
  const hasChildren = categories.some((c) => c.parentId === categoryId);
  const inside = useMemo(() => new Set(categoryId ? (includeInside ? categorySubtreeIds(categories, categoryId) : [categoryId]) : []), [categories, categoryId, includeInside]);

  // this category's own dishes first, then those of the categories inside it in menu order
  const items = menu.items
    .filter((i) => inside.has(i.categoryId))
    .sort((a, b) => (order.get(a.categoryId) ?? 0) - (order.get(b.categoryId) ?? 0) || a.sortOrder - b.sortOrder);

  const ids = items.map((i) => i.id);
  const everything = selectAllState(ids, selection.ids);
  const disabled = !categoryId;

  return (
    <Card
      title="Items"
      subtitle={categoryId ? categoryPathLabel(categories, categoryId) : undefined}
      action={
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {onImport && (
            <Button onClick={onImport} disabled={disabled} style={{ display: "inline-flex", gap: 6, alignItems: "center" }} title="Import items into this category from another outlet">
              <Download size={13} /> Import
            </Button>
          )}
          <Button onClick={onNew} disabled={disabled}>
            Add item
          </Button>
        </div>
      }
    >
      {hasChildren ? (
        <div style={{ marginBottom: 10 }}>
          <Checkbox checked={includeInside} onChange={setIncludeInside} label="Also show dishes from the categories inside this one" />
        </div>
      ) : null}

      {items.length > 0 ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 8px 2px", fontSize: 12.5, color: "var(--color-text-muted)" }}>
          <input
            type="checkbox"
            style={checkStyle}
            aria-label="Select all items"
            checked={everything.checked}
            ref={(el) => el && (el.indeterminate = everything.partly)}
            onChange={(e) => selection.setMany(ids, e.target.checked)}
          />
          <span>Select all {items.length}</span>
        </div>
      ) : null}

      {selection.size > 0 ? (
        <div style={bulkBar} data-testid="item-bulk">
          <strong>{selection.size} selected</strong>
          <button type="button" style={dangerBtn} onClick={() => setConfirming([...selection.ids])}>
            <Trash2 size={12} style={{ verticalAlign: -2 }} /> Delete selected
          </button>
          <button type="button" style={linkBtn} onClick={selection.clear}>
            Clear
          </button>
        </div>
      ) : null}

      {items.length === 0 ? (
        <p style={{ color: "var(--color-text-muted)", margin: 0, fontSize: 14 }}>{disabled ? "Pick a category." : "No items yet."}</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {items.map((it) => (
            <div key={it.id} style={itemRow} data-item={it.name} data-testid="item-row">
              <input type="checkbox" style={checkStyle} aria-label={`Select item ${it.name}`} checked={selection.has(it.id)} onChange={() => selection.toggle(it.id)} />
              {itemImageUrl(it, "1:1") ? <img src={itemImageUrl(it, "1:1")} alt="" style={{ width: 34, height: 34, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} /> : null}
              <Mark type={it.foodType} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{it.name}</div>
                <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                  {itemPriceLabel(it)}
                  {it.variants.length > 1 ? ` · ${it.variants.length} sizes` : ""}
                  {it.modifierGroupIds.length ? ` · ${it.modifierGroupIds.length} add-on group` : ""}
                  {it.categoryId !== categoryId ? ` · in ${categoryPathLabel(categories, it.categoryId)}` : ""}
                  {it.combo ? " · combo" : ""}
                  {it.availability ? " · has hours" : ""}
                </div>
              </div>
              {it.stock?.tracked ? (
                <button
                  type="button"
                  data-testid="item-stock-chip"
                  title="Change how many are left"
                  onClick={() => {
                    const n = window.prompt(`How many ${it.name} are left?`, String(it.stock.left));
                    if (n !== null && Number.isFinite(Number(n)) && Number(n) >= 0) update.mutate({ id: it.id, body: { stock: { ...it.stock, left: Math.round(Number(n)) } } });
                  }}
                  style={{ ...stockChip, ...(it.stock.left <= 0 ? stockOut : it.stock.left <= it.stock.lowAt ? stockLow : {}) }}
                >
                  {it.stock.left <= 0 ? "Sold out" : `${it.stock.left} left`}
                </button>
              ) : null}
              <label style={{ fontSize: 12, display: "flex", gap: 5, alignItems: "center" }}>
                <input type="checkbox" checked={it.isAvailable} onChange={(e) => update.mutate({ id: it.id, body: { isAvailable: e.target.checked } })} />
                available
              </label>
              {isSuperAdmin ? (
                <button type="button" style={iconBtn} title="Make pictures with AI" aria-label={`Make pictures of ${it.name} with AI`} data-testid="ai-button" onClick={() => setAiItem(it)}>
                  <Sparkles size={14} />
                </button>
              ) : null}
              <button type="button" style={iconBtn} title="Edit" onClick={() => onEdit(it)}>
                ✎
              </button>
              <button type="button" style={iconBtn} title="Delete" aria-label={`Delete ${it.name}`} onClick={() => setConfirming([it.id])}>
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      {removeOne.error ? <Toast kind="error">{removeOne.error.message}</Toast> : null}

      {aiItem ? <GenerateImagesDialog outlet={outlet} menu={menu} item={menu.items.find((i) => i.id === aiItem.id) ?? aiItem} onClose={() => setAiItem(null)} /> : null}
      {confirming ? (
        <DeleteItemsDialog
          outlet={outlet}
          menu={menu}
          ids={confirming}
          onClose={() => setConfirming(null)}
          onDone={() => {
            selection.clear();
            setConfirming(null);
          }}
        />
      ) : null}
    </Card>
  );
}

function DeleteItemsDialog({ outlet, menu, ids, onClose, onDone }) {
  const remove = useDeleteItems(outlet);
  const named = ids.map((id) => menu.items.find((i) => i.id === id)).filter(Boolean);
  return (
    <Modal onClose={onClose} width={420} ariaLabel="Delete items">
      <div style={{ padding: 22 }}>
        <h2 style={{ margin: "0 0 8px", fontSize: 19 }}>{named.length === 1 ? `Delete “${named[0].name}”?` : `Delete ${named.length} items?`}</h2>
        {named.length > 1 ? (
          <ul style={{ margin: "0 0 8px", paddingLeft: 18, fontSize: 14, lineHeight: 1.6 }}>
            {named.slice(0, 8).map((i) => <li key={i.id}>{i.name}</li>)}
            {named.length > 8 ? <li>…and {named.length - 8} more</li> : null}
          </ul>
        ) : null}
        <p style={{ margin: 0, fontSize: 13.5, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
          {named.length === 1 ? "It is" : "They are"} removed from the menu together with {named.length === 1 ? "its" : "their"} photos. Orders already placed keep what was ordered.
        </p>
        {remove.error ? <Toast kind="error">{remove.error.message}</Toast> : null}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <Button variant="outline" onClick={onClose} disabled={remove.isPending}>
            Keep {named.length === 1 ? "it" : "them"}
          </Button>
          <button type="button" style={{ ...dangerBtn, padding: "9px 16px" }} disabled={remove.isPending} onClick={() => remove.mutate(ids, { onSuccess: onDone })}>
            {remove.isPending ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Mark({ type }) {
  const color = type === "veg" ? "#0E8A3E" : type === "egg" ? "#C79A20" : "#B23B3B";
  const round = type !== "veg";
  return (
    <span style={{ width: 13, height: 13, flexShrink: 0, border: `2px solid ${color}`, borderRadius: round ? "50%" : 3, display: "grid", placeItems: "center" }}>
      <span style={{ width: 6, height: 6, background: color, borderRadius: round ? "50%" : 1 }} />
    </span>
  );
}

const itemRow = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 12px",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  background: "var(--color-bg)",
};
// counted stock on a dish row: plain when there's plenty, amber when running low, red when sold out
const stockChip = { font: "inherit", fontSize: 11.5, fontWeight: 700, padding: "3px 8px", borderRadius: 999, border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text)", cursor: "pointer", whiteSpace: "nowrap" };
const stockLow = { background: "var(--tone-warning-wash)", color: "var(--tone-warning)", borderColor: "transparent" };
const stockOut = { background: "var(--tone-danger-wash)", color: "var(--tone-danger)", borderColor: "transparent" };
