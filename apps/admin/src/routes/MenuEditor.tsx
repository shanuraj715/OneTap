import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import {
  formatINR,
  itemPriceLabel,
  type FoodType,
  type Menu,
  type MenuItem,
} from "@onetap/config-schema";
import type { Outlet } from "../lib/api";
import { useOutlet } from "../lib/useOutlet";
import {
  useCreateCategory,
  useCreateItem,
  useCreateModifierGroup,
  useDeleteCategory,
  useDeleteItem,
  useDeleteModifierGroup,
  useMenu,
  useUpdateCategory,
  useUpdateItem,
} from "../lib/useMenu";
import { Button, Card, Field, PageHeader, TextInput, Toast } from "../ui";

const toPaise = (rupees: string) => Math.round(Number(rupees || 0) * 100);
const toRupees = (paise: number) => String(paise / 100);

export function MenuEditor() {
  const { outlet } = useOutlet();
  const menuQuery = useMenu(outlet);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [editing, setEditing] = useState<MenuItem | "new" | null>(null);

  const menu = menuQuery.data;

  useEffect(() => {
    if (menu && !categoryId && menu.categories[0]) setCategoryId(menu.categories[0].id);
  }, [menu, categoryId]);

  if (!outlet) {
    return (
      <>
        <PageHeader title="Menu" />
        <Card>Seed an outlet from the Dashboard first.</Card>
      </>
    );
  }
  if (!menu) {
    return (
      <>
        <PageHeader title="Menu" />
        <Card>{menuQuery.error ? `⚠ ${(menuQuery.error as Error).message}` : "Loading…"}</Card>
      </>
    );
  }

  const items = menu.items
    .filter((i) => i.categoryId === categoryId)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <>
      <PageHeader
        title="Menu"
        subtitle={`${menu.categories.length} categories · ${menu.items.length} items`}
      />

      <div style={{ display: "grid", gridTemplateColumns: "230px 1fr", gap: 20, alignItems: "start" }}>
        <Categories
          outlet={outlet}
          menu={menu}
          selected={categoryId}
          onSelect={(id) => {
            setCategoryId(id);
            setEditing(null);
          }}
        />

        <div>
          {editing ? (
            <ItemForm
              outlet={outlet}
              menu={menu}
              categoryId={categoryId ?? ""}
              item={editing === "new" ? null : editing}
              onDone={() => setEditing(null)}
            />
          ) : (
            <Items
              outlet={outlet}
              items={items}
              disabled={!categoryId}
              onNew={() => setEditing("new")}
              onEdit={setEditing}
            />
          )}
        </div>
      </div>

      <ModifierGroups outlet={outlet} menu={menu} />
    </>
  );
}

/* --------------------------------------------------------------- categories */

function Categories({
  outlet,
  menu,
  selected,
  onSelect,
}: {
  outlet: Outlet;
  menu: Menu;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const create = useCreateCategory(outlet);
  const update = useUpdateCategory(outlet);
  const remove = useDeleteCategory(outlet);

  const add = () => {
    if (!name.trim()) return;
    create.mutate({ name: name.trim(), sortOrder: menu.categories.length }, { onSuccess: () => setName("") });
  };

  return (
    <Card title="Categories">
      <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 12 }}>
        {menu.categories
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((c) => {
            const count = menu.items.filter((i) => i.categoryId === c.id).length;
            const active = c.id === selected;
            return (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <button
                  type="button"
                  onClick={() => onSelect(c.id)}
                  style={{
                    ...catBtn,
                    background: active ? "var(--color-primary)" : "transparent",
                    color: active ? "var(--color-on-primary)" : "var(--color-text)",
                  }}
                >
                  <span>{c.name}</span>
                  <span style={{ opacity: 0.7, fontSize: 12 }}>{count}</span>
                </button>
                <button
                  type="button"
                  title="Rename"
                  onClick={() => {
                    const next = window.prompt("Category name", c.name);
                    if (next && next !== c.name) update.mutate({ id: c.id, body: { name: next } });
                  }}
                  style={iconBtn}
                >
                  ✎
                </button>
                <button
                  type="button"
                  title="Delete"
                  onClick={() => {
                    if (window.confirm(`Delete "${c.name}"?`)) remove.mutate(c.id);
                  }}
                  style={iconBtn}
                >
                  ×
                </button>
              </div>
            );
          })}
      </div>

      <div style={{ display: "flex", gap: 6 }}>
        <TextInput
          value={name}
          placeholder="New category"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          style={{ flex: 1, minWidth: 0 }}
        />
        <Button onClick={add} disabled={create.isPending}>
          +
        </Button>
      </div>
      {remove.error ? <Toast kind="error">{(remove.error as Error).message}</Toast> : null}
    </Card>
  );
}

/* -------------------------------------------------------------------- items */

function Items({
  outlet,
  items,
  disabled,
  onNew,
  onEdit,
}: {
  outlet: Outlet;
  items: MenuItem[];
  disabled: boolean;
  onNew: () => void;
  onEdit: (item: MenuItem) => void;
}) {
  const update = useUpdateItem(outlet);
  const remove = useDeleteItem(outlet);

  return (
    <Card
      title="Items"
      action={
        <Button onClick={onNew} disabled={disabled}>
          Add item
        </Button>
      }
    >
      {items.length === 0 ? (
        <p style={{ color: "var(--color-text-muted)", margin: 0, fontSize: 14 }}>
          {disabled ? "Pick a category." : "No items yet."}
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {items.map((it) => (
            <div key={it.id} style={itemRow}>
              <Mark type={it.foodType} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{it.name}</div>
                <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                  {itemPriceLabel(it)}
                  {it.variants.length > 1 ? ` · ${it.variants.length} sizes` : ""}
                  {it.modifierGroupIds.length ? ` · ${it.modifierGroupIds.length} add-on group` : ""}
                </div>
              </div>
              <label style={{ fontSize: 12, display: "flex", gap: 5, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={it.isAvailable}
                  onChange={(e) => update.mutate({ id: it.id, body: { isAvailable: e.target.checked } })}
                />
                available
              </label>
              <button type="button" style={iconBtn} title="Edit" onClick={() => onEdit(it)}>
                ✎
              </button>
              <button
                type="button"
                style={iconBtn}
                title="Delete"
                onClick={() => window.confirm(`Delete "${it.name}"?`) && remove.mutate(it.id)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ---------------------------------------------------------------- item form */

function ItemForm({
  outlet,
  menu,
  categoryId,
  item,
  onDone,
}: {
  outlet: Outlet;
  menu: Menu;
  categoryId: string;
  item: MenuItem | null;
  onDone: () => void;
}) {
  const create = useCreateItem(outlet);
  const update = useUpdateItem(outlet);

  const [name, setName] = useState(item?.name ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [foodType, setFoodType] = useState<FoodType>(item?.foodType ?? "veg");
  const [basePrice, setBasePrice] = useState(toRupees(item?.basePrice ?? 0));
  const [variants, setVariants] = useState(
    (item?.variants ?? []).map((v) => ({ id: v.id, label: v.label, price: toRupees(v.price) })),
  );
  const [groupIds, setGroupIds] = useState<string[]>(item?.modifierGroupIds ?? []);
  const [tags, setTags] = useState((item?.tags ?? []).join(", "));

  const pending = create.isPending || update.isPending;
  const error = (create.error ?? update.error) as Error | null;

  const save = () => {
    if (!name.trim()) return;
    const body = {
      categoryId,
      name: name.trim(),
      description: description.trim(),
      foodType,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      basePrice: variants.length ? 0 : toPaise(basePrice),
      variants: variants
        .filter((v) => v.label.trim())
        .map((v) => ({ id: v.id, label: v.label.trim(), price: toPaise(v.price) })),
      modifierGroupIds: groupIds,
    };
    if (item) update.mutate({ id: item.id, body }, { onSuccess: onDone });
    else create.mutate(body, { onSuccess: onDone });
  };

  return (
    <Card
      title={item ? "Edit item" : "New item"}
      action={
        <Button variant="outline" onClick={onDone}>
          Back
        </Button>
      }
    >
      <Field label="Name" info="What diners see on the menu and what the kitchen reads on the ticket. Keep it short — long names wrap awkwardly on a 58 mm receipt roll.">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </Field>
      <Field label="Description" info="One line under the item on the website. Use it for what is actually in the dish; it never prints on a kitchen ticket, so it costs the cooks nothing.">
        <TextInput value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <Field label="Food type" hint="Shown as the FSSAI veg / non-veg mark" info="Sets the green or brown square beside the item. Indian packaging and menu rules require this mark, and diners scan for it before they read anything else — getting it wrong on a single item is a real complaint.">
        <select
          value={foodType}
          onChange={(e) => setFoodType(e.target.value as FoodType)}
          style={selectStyle}
        >
          <option value="veg">Veg</option>
          <option value="non-veg">Non-veg</option>
          <option value="egg">Contains egg</option>
        </select>
      </Field>
      <Field label="Tags" hint="Comma separated, e.g. bestseller, spicy" info="Short labels shown as chips on the item card. Use them for the things people choose by — bestseller, spicy, jain — not for a second description.">
        <TextInput value={tags} onChange={(e) => setTags(e.target.value)} />
      </Field>

      <div style={{ borderTop: "1px solid var(--color-border)", margin: "6px 0 14px", paddingTop: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Pricing</div>
        {variants.length === 0 ? (
          <Field label="Price (₹)" info="What the customer pays for this size. Enter it the way it appears on your menu board — tax is already inside this figure unless you switched that off in tax settings.">
            <TextInput
              type="number"
              value={basePrice}
              onChange={(e) => setBasePrice(e.target.value)}
              style={{ width: 120 }}
            />
          </Field>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
            {variants.map((v, idx) => (
              <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <TextInput
                  value={v.label}
                  placeholder="Size, e.g. 8 pcs"
                  onChange={(e) =>
                    setVariants(variants.map((x, i) => (i === idx ? { ...x, label: e.target.value } : x)))
                  }
                  style={{ flex: 1 }}
                />
                <TextInput
                  type="number"
                  value={v.price}
                  placeholder="₹"
                  onChange={(e) =>
                    setVariants(variants.map((x, i) => (i === idx ? { ...x, price: e.target.value } : x)))
                  }
                  style={{ width: 100 }}
                />
                <button
                  type="button"
                  style={iconBtn}
                  onClick={() => setVariants(variants.filter((_, i) => i !== idx))}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <Button
          variant="outline"
          onClick={() => setVariants([...variants, { id: undefined as unknown as string, label: "", price: "0" }])}
        >
          + Add size / variant
        </Button>
      </div>

      {menu.modifierGroups.length > 0 && (
        <div style={{ borderTop: "1px solid var(--color-border)", margin: "6px 0 14px", paddingTop: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Add-on groups</div>
          {menu.modifierGroups.map((g) => (
            <label key={g.id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, marginBottom: 6 }}>
              <input
                type="checkbox"
                checked={groupIds.includes(g.id)}
                onChange={(e) =>
                  setGroupIds(e.target.checked ? [...groupIds, g.id] : groupIds.filter((id) => id !== g.id))
                }
              />
              {g.name}
              <span style={{ color: "var(--color-text-muted)", fontSize: 12 }}>
                ({g.options.length} options)
              </span>
            </label>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 10 }}>
        <Button onClick={save} disabled={pending}>
          {pending ? "Saving…" : item ? "Save changes" : "Create item"}
        </Button>
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
      </div>
      {error ? <Toast kind="error">{error.message}</Toast> : null}
    </Card>
  );
}

/* ---------------------------------------------------------- modifier groups */

function ModifierGroups({ outlet, menu }: { outlet: Outlet; menu: Menu }) {
  const [name, setName] = useState("");
  const [options, setOptions] = useState("");
  const create = useCreateModifierGroup(outlet);
  const remove = useDeleteModifierGroup(outlet);

  const add = () => {
    if (!name.trim()) return;
    const parsed = options
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        const [label, price] = s.split("+").map((x) => x.trim());
        return { label: label ?? s, priceDelta: toPaise(price ?? "0") };
      });
    create.mutate(
      { name: name.trim(), maxSelect: Math.max(1, parsed.length), options: parsed },
      {
        onSuccess: () => {
          setName("");
          setOptions("");
        },
      },
    );
  };

  return (
    <Card title="Add-on groups">
      {menu.modifierGroups.length === 0 ? (
        <p style={{ color: "var(--color-text-muted)", margin: "0 0 14px", fontSize: 14 }}>None yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          {menu.modifierGroups.map((g) => (
            <div key={g.id} style={itemRow}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{g.name}</div>
                <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                  {g.options.map((o) => `${o.label} +${formatINR(o.priceDelta)}`).join(" · ") || "no options"}
                </div>
              </div>
              <button
                type="button"
                style={iconBtn}
                title="Delete"
                onClick={() => window.confirm(`Delete "${g.name}"?`) && remove.mutate(g.id)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
        <Field label="Group name" info="The heading a diner sees above a set of choices — 'Extra dips', 'Choose your spice'. It appears when they tap an item to customise it.">
          <TextInput value={name} placeholder="Add-ons" onChange={(e) => setName(e.target.value)} style={{ width: 180 }} />
        </Field>
        <Field label="Options" hint="Comma separated, e.g. Cheese Dip + 30, Extra Mayo + 15" info="Each choice and what it adds to the price. Write 'Cheese Dip + 30' to charge ₹30 extra, or just 'No onion' for a free option. These print on the kitchen ticket under the item, so cooks see them.">
          <TextInput value={options} onChange={(e) => setOptions(e.target.value)} style={{ width: 340 }} />
        </Field>
        <div style={{ marginBottom: 14 }}>
          <Button onClick={add} disabled={create.isPending}>
            Add group
          </Button>
        </div>
      </div>
      {create.error ? <Toast kind="error">{(create.error as Error).message}</Toast> : null}
    </Card>
  );
}

/* ------------------------------------------------------------------- shared */

function Mark({ type }: { type: FoodType }) {
  const color = type === "veg" ? "#0E8A3E" : type === "egg" ? "#C79A20" : "#B23B3B";
  const round = type !== "veg";
  return (
    <span
      style={{
        width: 13,
        height: 13,
        flexShrink: 0,
        border: `2px solid ${color}`,
        borderRadius: round ? "50%" : 3,
        display: "grid",
        placeItems: "center",
      }}
    >
      <span style={{ width: 6, height: 6, background: color, borderRadius: round ? "50%" : 1 }} />
    </span>
  );
}

const catBtn: CSSProperties = {
  flex: 1,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
  font: "inherit",
  fontSize: 14,
  textAlign: "left",
  padding: "7px 10px",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
};
const iconBtn: CSSProperties = {
  font: "inherit",
  fontSize: 14,
  lineHeight: 1,
  width: 26,
  height: 26,
  border: "1px solid var(--color-border)",
  borderRadius: 6,
  background: "var(--color-bg)",
  color: "var(--color-text-muted)",
  cursor: "pointer",
  flexShrink: 0,
};
const itemRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 12px",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  background: "var(--color-bg)",
};
const selectStyle: CSSProperties = {
  font: "inherit",
  fontSize: 14,
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid var(--color-border)",
  background: "var(--color-bg)",
  color: "var(--color-text)",
  width: 180,
};
