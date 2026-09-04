import { useEffect, useRef, useState } from "react";
import { formatINR, IMAGE_RULES, itemPriceLabel } from "@onetap/config-schema";
import { ImagePlus, Loader, Star, X } from "lucide-react";
import * as api from "../lib/api";
import { useOutlet } from "../lib/useOutlet";
import { useImageUpload } from "../lib/useStorage";
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

const toPaise = (rupees        ) => Math.round(Number(rupees || 0) * 100);
const toRupees = (paise        ) => String(paise / 100);

export function MenuEditor() {
  const { outlet } = useOutlet();
  const menuQuery = useMenu(outlet);
  const [categoryId, setCategoryId] = useState               (null);
  const [editing, setEditing] = useState                         (null);

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
        <Card>{menuQuery.error ? `⚠ ${(menuQuery.error         ).message}` : "Loading…"}</Card>
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

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20, alignItems: "start" }}>
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
}   
                 
             
                          
                                 
 ) {
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
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                  <span style={{ opacity: 0.7, fontSize: 12, flexShrink: 0 }}>{count}</span>
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
      {remove.error ? <Toast kind="error">{(remove.error         ).message}</Toast> : null}
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
}   
                 
                    
                    
                    
                                   
 ) {
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
              {it.images?.[0]?.url ? (
                <img
                  src={it.images[0].url}
                  alt=""
                  style={{ width: 34, height: 34, borderRadius: 6, objectFit: "cover", flexShrink: 0 }}
                />
              ) : null}
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
}   
                 
             
                     
                        
                     
 ) {
  const create = useCreateItem(outlet);
  const update = useUpdateItem(outlet);

  const [name, setName] = useState(item?.name ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [images, setImages] = useState(item?.images ?? []);
  const [foodType, setFoodType] = useState          (item?.foodType ?? "veg");
  const [basePrice, setBasePrice] = useState(toRupees(item?.basePrice ?? 0));
  const [variants, setVariants] = useState(
    (item?.variants ?? []).map((v) => ({ id: v.id, label: v.label, price: toRupees(v.price) })),
  );
  const [groupIds, setGroupIds] = useState          (item?.modifierGroupIds ?? []);
  const [tags, setTags] = useState((item?.tags ?? []).join(", "));

  const pending = create.isPending || update.isPending;
  const error = (create.error ?? update.error)                ;

  const save = () => {
    if (!name.trim()) return;
    const body = {
      categoryId,
      name: name.trim(),
      description: description.trim(),
      foodType,
      images: images.map((im) => ({ url: im.url, key: im.key ?? "", width: im.width, height: im.height })),
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        <Field label="Name" info="What diners see on the menu and what the kitchen reads on the ticket. Keep it short — long names wrap awkwardly on a 58 mm receipt roll." style={{ maxWidth: "none" }}>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <Field label="Description" info="One line under the item on the website. Use it for what is actually in the dish; it never prints on a kitchen ticket, so it costs the cooks nothing." style={{ maxWidth: "none" }}>
          <TextInput value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="Food type" hint="Shown as the FSSAI veg / non-veg mark" info="Sets the green or brown square beside the item. Indian packaging and menu rules require this mark, and diners scan for it before they read anything else — getting it wrong on a single item is a real complaint." style={{ maxWidth: "none" }}>
          <select
            value={foodType}
            onChange={(e) => setFoodType(e.target.value            )}
            style={selectStyle}
          >
            <option value="veg">Veg</option>
            <option value="non-veg">Non-veg</option>
            <option value="egg">Contains egg</option>
          </select>
        </Field>
        <Field label="Tags" hint="Comma separated, e.g. bestseller, spicy" info="Short labels shown as chips on the item card. Use them for the things people choose by — bestseller, spicy, jain — not for a second description." style={{ maxWidth: "none" }}>
          <TextInput value={tags} onChange={(e) => setTags(e.target.value)} />
        </Field>
      </div>

      <div style={{ borderTop: "1px solid var(--color-border)", margin: "6px 0 14px", paddingTop: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>Photos</div>
        <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 10, lineHeight: 1.5 }}>
          Up to {IMAGE_RULES.maxPerItem}. The first is the cover shown on menu cards. Any format (JPEG, PNG, WebP,
          AVIF, HEIC…) — compressed automatically. Backend &amp; size settings under Storage.
        </div>
        <ItemPhotos outlet={outlet} images={images} originalKeys={item?.images ?? []} onChange={setImages} />
      </div>

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
          onClick={() => setVariants([...variants, { id: undefined                     , label: "", price: "0" }])}
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

/* --------------------------------------------------------------- item photos */

function ItemPhotos({ outlet, images, originalKeys, onChange }) {
  const { upload, busy, error, clearError } = useImageUpload(outlet);
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const originalKeySet = new Set((originalKeys ?? []).map((im) => im.key).filter(Boolean));
  const room = IMAGE_RULES.maxPerItem - images.length;

  const addFiles = async (fileList) => {
    clearError();
    const files = Array.from(fileList ?? []).slice(0, Math.max(0, room));
    if (!files.length) return;
    try {
      const stored = await upload(files);
      onChange([...images, ...stored].slice(0, IMAGE_RULES.maxPerItem));
    } catch {
      /* error surfaced by the hook */
    }
  };

  const removeAt = (idx) => {
    const img = images[idx];
    // A photo added in this editing session (not yet saved) is safe to delete
    // now; an original one is left for the server to clean up on save.
    if (img?.key && !originalKeySet.has(img.key)) {
      void api.deleteStorageObject(outlet, img.key);
    }
    onChange(images.filter((_, i) => i !== idx));
  };

  const move = (idx, dir) => {
    const to = idx + dir;
    if (to < 0 || to >= images.length) return;
    const next = [...images];
    [next[idx], next[to]] = [next[to], next[idx]];
    onChange(next);
  };

  return (
    <>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void addFiles(e.dataTransfer.files);
        }}
        style={{ display: "flex", flexWrap: "wrap", gap: 10 }}
      >
        {images.map((im, idx) => (
          <div key={im.key || im.url} style={thumbBox}>
            <img src={im.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            {idx === 0 ? (
              <span style={coverBadge}>
                <Star size={9} fill="currentColor" /> Cover
              </span>
            ) : null}
            <div style={thumbActions}>
              {idx > 0 ? (
                <button type="button" title="Make cover / move left" style={thumbBtn} onClick={() => move(idx, -1)}>
                  ←
                </button>
              ) : null}
              {idx < images.length - 1 ? (
                <button type="button" title="Move right" style={thumbBtn} onClick={() => move(idx, 1)}>
                  →
                </button>
              ) : null}
              <button type="button" title="Remove" style={{ ...thumbBtn, marginLeft: "auto" }} onClick={() => removeAt(idx)}>
                <X size={12} />
              </button>
            </div>
          </div>
        ))}

        {room > 0 ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            style={{
              ...thumbBox,
              ...addTile,
              borderColor: dragOver ? "var(--color-primary)" : "var(--color-border)",
              background: dragOver ? "color-mix(in srgb, var(--color-primary) 8%, var(--color-bg))" : "var(--color-bg)",
            }}
          >
            {busy ? <Loader size={18} /> : <ImagePlus size={18} />}
            <span style={{ fontSize: 11 }}>{busy ? "Uploading…" : "Add photo"}</span>
          </button>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={IMAGE_RULES.acceptAttr}
        multiple
        hidden
        onChange={(e) => {
          void addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {error ? <Toast kind="error">{error}</Toast> : null}
    </>
  );
}

/* ---------------------------------------------------------- modifier groups */

function ModifierGroups({ outlet, menu }                                ) {
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
      {create.error ? <Toast kind="error">{(create.error         ).message}</Toast> : null}
    </Card>
  );
}

/* ------------------------------------------------------------------- shared */

function Mark({ type }                    ) {
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

const catBtn = {
  flex: 1,
  minWidth: 0,
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
const iconBtn                = {
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
const itemRow                = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 12px",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  background: "var(--color-bg)",
};
const selectStyle                = {
  font: "inherit",
  fontSize: 14,
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid var(--color-border)",
  background: "var(--color-bg)",
  color: "var(--color-text)",
  width: 180,
};
const thumbBox = {
  position: "relative",
  width: 104,
  height: 104,
  borderRadius: 10,
  overflow: "hidden",
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
  flexShrink: 0,
};
const addTile = {
  font: "inherit",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 5,
  border: "1.5px dashed var(--color-border)",
  color: "var(--color-text-muted)",
  cursor: "pointer",
};
const coverBadge = {
  position: "absolute",
  top: 4,
  left: 4,
  display: "inline-flex",
  alignItems: "center",
  gap: 3,
  fontSize: 9.5,
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  padding: "2px 6px",
  borderRadius: 5,
  background: "var(--color-primary)",
  color: "var(--color-on-primary)",
};
const thumbActions = {
  position: "absolute",
  left: 0,
  right: 0,
  bottom: 0,
  display: "flex",
  alignItems: "center",
  gap: 3,
  padding: 4,
  background: "linear-gradient(transparent, rgba(0,0,0,0.55))",
};
const thumbBtn = {
  font: "inherit",
  fontSize: 12,
  lineHeight: 1,
  display: "grid",
  placeItems: "center",
  minWidth: 20,
  height: 20,
  padding: "0 4px",
  border: "none",
  borderRadius: 5,
  background: "rgba(255,255,255,0.92)",
  color: "#111",
  cursor: "pointer",
};
