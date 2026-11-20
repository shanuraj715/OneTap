import { useEffect, useMemo, useRef, useState } from "react";
import { categoryHeight, categoryLevel, categorySubtreeIds, flattenCategories, cleanCategoryName, duplicateCategoryName, IMAGE_RULES, MAX_CATEGORIES_AT_ONCE, MAX_CATEGORY_DEPTH, planCategoryMove } from "@onetap/config-schema";
import { ArrowDown, ArrowUp, Download, FolderPlus, GripVertical, ImagePlus, Loader, Minus, MoreHorizontal, Pencil, Plus, Trash2, X } from "lucide-react";
import * as api from "../../lib/api";
import { useCreateCategories, useCreateCategory, useDeleteCategories, useMoveCategory, useReorderCategories, useUpdateCategory } from "../../lib/useMenu";
import { useImageUpload } from "../../lib/useStorage";
import { Button, Card, Checkbox, Field, Menu, Modal, TextInput, Toast } from "../../ui";
import { bulkBar, checkStyle, dangerBtn, iconBtn, linkBtn, selectAllState, selectStyle } from "./shared";

/**
 * The menu's categories as a real tree: South Indian → Dosa → Rava Dosa, drawn with connecting lines and a node for
 * each category. Each can hold dishes AND other categories, can have a picture, and can be dragged: drop it on the
 * top or bottom edge of a row to put it before or after that row, on the middle of a row to put it inside that
 * category, or on the strip below the tree to make it top-level. The ⋯ menu (Move up / Move down / Edit → Inside)
 * does the same without a mouse. Tick any number of categories to delete them together.
 */
const COL = 20; // width of one level of the tree

export function CategoriesPanel({ outlet, menu, selected, onSelect, onImport, selection }) {
  const [name, setName] = useState("");
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [dialog, setDialog] = useState(null); // { kind: "edit" | "add", category?, parentId? }
  const [deleting, setDeleting] = useState(null); // ids being confirmed
  const [dragId, setDragId] = useState(null);
  const [drop, setDrop] = useState(null); // { targetId, zone: "before" | "after" | "inside" | "end" } — only ever a valid place
  const create = useCreateCategory(outlet);
  const reorder = useReorderCategories(outlet);
  const move = useMoveCategory(outlet);

  const categories = menu.categories;
  const all = useMemo(() => flattenCategories(categories), [categories]);
  const byId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const subtreeCount = (id) => {
    const inside = new Set(categorySubtreeIds(categories, id));
    return menu.items.filter((i) => inside.has(i.categoryId)).length;
  };

  // siblings in order, and whether a category is the last of its level (where its connecting line stops)
  const kids = useMemo(() => {
    const m = new Map();
    for (const { category: c } of all) {
      const key = c.parentId && byId.has(c.parentId) ? c.parentId : null;
      if (!m.has(key)) m.set(key, []);
      m.get(key).push(c.id);
    }
    return m;
  }, [all, byId]);
  const parentOf = (c) => (c.parentId && byId.has(c.parentId) ? c.parentId : null);
  const isLast = (c) => kids.get(parentOf(c))?.at(-1) === c.id;

  // a row is hidden while any category above it is folded shut
  const rows = all.filter(({ category }) => {
    for (let p = byId.get(category.parentId ?? ""), guard = 0; p && guard < 30; p = byId.get(p.parentId ?? ""), guard += 1) {
      if (collapsed.has(p.id)) return false;
    }
    return true;
  });

  const add = () => {
    const clean = cleanCategoryName(name);
    if (clean) create.mutate({ name: clean, parentId: null }, { onSuccess: () => setName("") });
  };

  const moveWithinLevel = (category, dir) => {
    const siblings = (kids.get(parentOf(category)) ?? []).map((id) => byId.get(id));
    const at = siblings.findIndex((c) => c.id === category.id);
    const to = at + dir;
    if (to < 0 || to >= siblings.length) return;
    const next = [...siblings];
    [next[at], next[to]] = [next[to], next[at]];
    reorder.mutate(next.map((c) => c.id));
  };

  /* ------------------------------------------------------------- drag and drop */

  /** Where dropping on `target` (on this part of it) would put the dragged category — or null if that isn't allowed. */
  const placeFor = (target, zone) => {
    let place;
    if (zone === "inside") place = { parentId: target.id, beforeId: null };
    else if (zone === "before") place = { parentId: parentOf(target), beforeId: target.id };
    else if (zone === "end") place = { parentId: null, beforeId: null };
    else {
      const open = !collapsed.has(target.id) && (kids.get(target.id)?.length ?? 0) > 0;
      if (open) place = { parentId: target.id, beforeId: kids.get(target.id)[0] }; // just under an open parent = its first child
      else {
        const sibs = kids.get(parentOf(target)) ?? [];
        place = { parentId: parentOf(target), beforeId: sibs[sibs.indexOf(target.id) + 1] ?? null };
      }
    }
    if (place.beforeId === dragId) return null;
    return planCategoryMove(categories, dragId, place.parentId, place.beforeId).ok ? place : null;
  };

  const zoneAt = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const y = (e.clientY - r.top) / Math.max(1, r.height);
    return y < 0.27 ? "before" : y > 0.73 ? "after" : "inside";
  };

  const finishDrop = (target, zone) => {
    const place = placeFor(target, zone);
    setDragId(null);
    setDrop(null);
    if (!place) return;
    if (zone === "inside") setCollapsed((prev) => { const next = new Set(prev); next.delete(target.id); return next; });
    move.mutate({ id: dragId, ...place });
  };

  const ids = all.map((e) => e.category.id);
  const everything = selectAllState(ids, selection.ids);

  return (
    <Card
      title="Categories"
      action={
        onImport ? (
          <button type="button" onClick={onImport} style={smallBtn} title="Import categories from another outlet">
            <Download size={12} /> Import
          </button>
        ) : null
      }
    >
      {ids.length > 0 ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 8px 2px", fontSize: 12.5, color: "var(--color-text-muted)" }}>
          <input
            type="checkbox"
            style={checkStyle}
            aria-label="Select all categories"
            checked={everything.checked}
            ref={(el) => el && (el.indeterminate = everything.partly)}
            onChange={(e) => selection.setMany(ids, e.target.checked)}
          />
          <span>Select all</span>
          <span style={{ marginLeft: "auto", fontSize: 11.5 }}>Drag ⠿ to move</span>
        </div>
      ) : null}

      {selection.size > 0 ? (
        <div style={bulkBar} data-testid="cat-bulk">
          <strong>{selection.size} selected</strong>
          <button type="button" style={dangerBtn} onClick={() => setDeleting([...selection.ids])}>
            <Trash2 size={12} style={{ verticalAlign: -2 }} /> Delete selected
          </button>
          <button type="button" style={linkBtn} onClick={selection.clear}>
            Clear
          </button>
        </div>
      ) : null}

      <div style={{ display: "flex", flexDirection: "column", marginBottom: 12 }} role="tree" aria-label="Menu categories" data-testid="cat-tree">
        {rows.map(({ category: c, depth }) => {
          const active = c.id === selected;
          const hasKids = (kids.get(c.id)?.length ?? 0) > 0;
          const open = !collapsed.has(c.id);
          const count = subtreeCount(c.id);
          // the level markers to the left: a pass-through line for each ancestor that has more below it
          const chain = [];
          for (let p = byId.get(parentOf(c) ?? ""), guard = 0; p && guard < 30; p = byId.get(parentOf(p) ?? ""), guard += 1) chain.unshift(p);
          const here = drop?.targetId === c.id ? drop.zone : null;

          return (
            <div
              key={c.id}
              role="treeitem"
              aria-selected={active}
              aria-level={depth + 1}
              data-category={c.name}
              data-testid="cat-row"
              draggable
              onDragStart={(e) => {
                setDragId(c.id);
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", c.id);
              }}
              onDragEnd={() => {
                setDragId(null);
                setDrop(null);
              }}
              onDragOver={(e) => {
                if (!dragId) return;
                const zone = zoneAt(e);
                if (placeFor(c, zone)) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (drop?.targetId !== c.id || drop.zone !== zone) setDrop({ targetId: c.id, zone });
                } else if (drop) setDrop(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId) finishDrop(c, zoneAt(e));
              }}
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                gap: 4,
                minHeight: 38,
                opacity: dragId === c.id ? 0.4 : 1,
                borderRadius: 8,
                background: here === "inside" ? "color-mix(in srgb, var(--color-primary) 12%, transparent)" : "transparent",
                outline: here === "inside" ? "2px dashed var(--color-primary)" : "none",
                outlineOffset: -2,
              }}
            >
              <input type="checkbox" style={checkStyle} aria-label={`Select category ${c.name}`} checked={selection.has(c.id)} onChange={() => selection.toggle(c.id)} />
              <span aria-hidden title="Drag to move" style={grip}>
                <GripVertical size={14} />
              </span>

              {/* the tree: pass-through lines, the elbow joining this node to its parent, then the node itself */}
              <div style={{ display: "flex", alignSelf: "stretch", flexShrink: 0 }} data-testid="cat-lines" data-depth={depth}>
                {chain.slice(1).map((anc, i) => (
                  <span key={i} style={{ position: "relative", width: COL, alignSelf: "stretch" }}>
                    {!isLast(anc) ? <i style={{ ...vLine, top: 0, bottom: 0 }} data-line="through" /> : null}
                  </span>
                ))}
                {depth > 0 ? (
                  <span style={{ position: "relative", width: COL, alignSelf: "stretch" }} data-testid="cat-elbow" data-last={isLast(c) ? "true" : "false"}>
                    <i style={{ ...vLine, top: 0, bottom: isLast(c) ? "50%" : 0 }} data-line="elbow-v" />
                    <i style={{ ...hLine }} data-line="elbow-h" />
                  </span>
                ) : null}
                <span style={{ position: "relative", width: COL, alignSelf: "stretch", display: "grid", placeItems: "center" }}>
                  {hasKids && open ? <i style={{ ...vLine, top: "50%", bottom: 0 }} data-line="stem" /> : null}
                  {hasKids ? (
                    <button
                      type="button"
                      aria-label={open ? `Fold ${c.name}` : `Unfold ${c.name}`}
                      aria-expanded={open}
                      data-testid="cat-node"
                      onClick={() => setCollapsed((prev) => {
                        const next = new Set(prev);
                        if (next.has(c.id)) next.delete(c.id);
                        else next.add(c.id);
                        return next;
                      })}
                      style={{ ...node, ...nodeParent }}
                    >
                      {open ? <Minus size={9} strokeWidth={3} /> : <Plus size={9} strokeWidth={3} />}
                    </button>
                  ) : (
                    <span data-testid="cat-node" style={{ ...node, ...nodeLeaf, background: active ? "var(--color-primary)" : "var(--color-bg)", borderColor: active ? "var(--color-primary)" : nodeLine }} />
                  )}
                </span>
              </div>

              <button
                type="button"
                onClick={() => onSelect(c.id)}
                style={{ ...catBtn, background: active ? "var(--color-primary)" : "transparent", color: active ? "var(--color-on-primary)" : "var(--color-text)", opacity: c.isActive ? 1 : 0.55 }}
                title={c.isActive ? c.name : `${c.name} — hidden from the storefront`}
              >
                {c.image?.url ? <img src={c.image.url} alt="" style={thumb} /> : null}
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, textAlign: "left" }}>{c.name}</span>
                <span style={{ opacity: 0.7, fontSize: 12, flexShrink: 0 }}>{count}</span>
              </button>
              <Menu
                header={c.name}
                width={220}
                options={[
                  { value: "add", label: "Add sub-category", icon: <FolderPlus size={13} />, disabled: categoryLevel(categories, c.id) >= MAX_CATEGORY_DEPTH },
                  { value: "edit", label: "Edit…", description: "Name, picture, where it sits", icon: <Pencil size={13} /> },
                  { value: "up", label: "Move up", icon: <ArrowUp size={13} /> },
                  { value: "down", label: "Move down", icon: <ArrowDown size={13} /> },
                  { value: "delete", label: "Delete…", icon: <Trash2 size={13} />, danger: true },
                ]}
                onSelect={(v) => {
                  if (v === "add") setDialog({ kind: "add", parentId: c.id });
                  if (v === "edit") setDialog({ kind: "edit", category: c });
                  if (v === "up") moveWithinLevel(c, -1);
                  if (v === "down") moveWithinLevel(c, 1);
                  if (v === "delete") setDeleting([c.id]);
                }}
                trigger={({ toggle }) => (
                  <button type="button" onClick={toggle} style={iconBtn} aria-label={`Actions for ${c.name}`}>
                    <MoreHorizontal size={14} />
                  </button>
                )}
              />

              {/* where it would land, when it is dropped between rows */}
              {here === "before" || here === "after" ? (
                <span
                  aria-hidden
                  data-testid="drop-line"
                  style={{ position: "absolute", left: 40 + (here === "after" && !collapsed.has(c.id) && hasKids ? depth + 1 : depth) * COL, right: 36, [here === "before" ? "top" : "bottom"]: -1, height: 3, borderRadius: 3, background: "var(--color-primary)", pointerEvents: "none", zIndex: 2 }}
                />
              ) : null}
            </div>
          );
        })}
        {rows.length === 0 ? <p style={{ margin: 0, fontSize: 13, color: "var(--color-text-muted)" }}>No categories yet.</p> : null}

        {/* while dragging: a place to make a category top-level (at the end) */}
        {dragId ? (
          <div
            data-testid="drop-top-level"
            onDragOver={(e) => {
              if (placeFor({ id: "", parentId: null }, "end")) {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (drop?.zone !== "end") setDrop({ targetId: "", zone: "end" });
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              finishDrop({ id: "", parentId: null }, "end");
            }}
            style={{
              marginTop: 8,
              padding: "10px 12px",
              borderRadius: 8,
              border: `2px dashed ${drop?.zone === "end" ? "var(--color-primary)" : "var(--color-border)"}`,
              background: drop?.zone === "end" ? "color-mix(in srgb, var(--color-primary) 12%, transparent)" : "transparent",
              fontSize: 12.5,
              textAlign: "center",
              color: "var(--color-text-muted)",
            }}
          >
            Drop here to make it a top-level category
          </div>
        ) : null}
      </div>

      <div style={{ display: "flex", gap: 6 }}>
        <TextInput
          value={name}
          placeholder="New category"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          style={{ flex: 1, minWidth: 0 }}
        />
        <Button onClick={add} disabled={create.isPending} aria-label="Add category">
          +
        </Button>
      </div>
      <button type="button" style={{ ...linkBtn, marginTop: 8, display: "inline-flex", alignItems: "center", gap: 5 }} onClick={() => setDialog({ kind: "add", parentId: null })} data-testid="add-several">
        <Plus size={12} /> Add several categories…
      </button>
      {create.error ? <Toast kind="error">{create.error.message}</Toast> : null}
      {reorder.error ? <Toast kind="error">{reorder.error.message}</Toast> : null}
      {move.error ? <Toast kind="error">{move.error.message}</Toast> : null}

      {dialog?.kind === "edit" ? <CategoryDialog outlet={outlet} menu={menu} dialog={dialog} onClose={() => setDialog(null)} /> : null}
      {dialog?.kind === "add" ? <AddCategoriesDialog outlet={outlet} menu={menu} parentId={dialog.parentId ?? ""} onClose={() => setDialog(null)} /> : null}
      {deleting ? (
        <DeleteCategoriesDialog
          outlet={outlet}
          menu={menu}
          ids={deleting}
          onClose={() => setDeleting(null)}
          onDone={() => {
            selection.clear();
            setDeleting(null);
          }}
        />
      ) : null}
    </Card>
  );
}

/* ------------------------------------------------------- add / edit a category */

function CategoryDialog({ outlet, menu, dialog, onClose }) {
  const editing = dialog.category;
  const [name, setName] = useState(editing.name);
  const [parentId, setParentId] = useState(editing.parentId ?? "");
  const [image, setImage] = useState(editing.image ?? null);
  const [isActive, setIsActive] = useState(editing.isActive ?? true);
  const [uploaded, setUploaded] = useState([]); // pictures uploaded in this dialog (cleaned up if not saved)
  const update = useUpdateCategory(outlet);
  const { upload, busy, error: uploadError, clearError } = useImageUpload(outlet, { kind: "menu-categories" });
  const fileRef = useRef(null);

  const categories = menu.categories;
  const options = useMemo(() => {
    const inside = new Set(categorySubtreeIds(categories, editing.id));
    const height = categoryHeight(categories, editing.id);
    return flattenCategories(categories).map(({ category, depth }) => ({
      id: category.id,
      label: `${"   ".repeat(depth)}${depth ? "↳ " : ""}${category.name}`,
      // not inside itself, and not so deep that the whole branch no longer fits
      disabled: inside.has(category.id) || categoryLevel(categories, category.id) + height > MAX_CATEGORY_DEPTH,
    }));
  }, [categories, editing]);

  const pending = update.isPending;
  const error = update.error;

  // a picture uploaded in this dialog but not saved is deleted again (replaced, removed or cancelled)
  const dropUploaded = (key) => {
    if (!key || !uploaded.includes(key)) return;
    void api.deleteStorageObject(outlet, key);
    setUploaded((u) => u.filter((k) => k !== key));
  };

  const pick = async (files) => {
    clearError();
    try {
      const [stored] = await upload(Array.from(files ?? []).slice(0, 1));
      if (!stored) return;
      dropUploaded(image?.key);
      setUploaded((u) => [...u, stored.key]);
      setImage(stored);
    } catch {
      /* the hook shows the reason */
    }
  };

  const cancel = () => {
    for (const key of uploaded) void api.deleteStorageObject(outlet, key);
    onClose();
  };

  const save = () => {
    if (!name.trim()) return;
    const body = { name: cleanCategoryName(name), parentId: parentId || null, image: image ? { url: image.url, key: image.key ?? "", width: image.width, height: image.height } : null, isActive };
    update.mutate({ id: editing.id, body }, { onSuccess: onClose });
  };

  return (
    <Modal onClose={cancel} width={460} ariaLabel="Edit category">
      <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
        <h2 style={{ margin: 0, fontSize: 19 }}>Edit category</h2>

        <Field label="Name" style={{ maxWidth: "none" }}>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} autoFocus onKeyDown={(e) => e.key === "Enter" && save()} placeholder="e.g. Dosa" />
        </Field>

        <Field label="Inside" hint="Leave empty for a top-level category" info="Put this category inside another, like Dosa inside South Indian. It then shows under that category on the menu." style={{ maxWidth: "none" }}>
          <select value={parentId} onChange={(e) => setParentId(e.target.value)} style={selectStyle} aria-label="Inside">
            <option value="">— Top level —</option>
            {options.map((o) => (
              <option key={o.id} value={o.id} disabled={o.disabled}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>

        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Picture</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {image ? (
              <div style={{ position: "relative" }}>
                <img src={image.url} alt="" style={{ width: 72, height: 72, borderRadius: 12, objectFit: "cover", border: "1px solid var(--color-border)" }} />
                <button
                  type="button"
                  aria-label="Remove picture"
                  title="Remove picture"
                  onClick={() => {
                    dropUploaded(image.key);
                    setImage(null);
                  }}
                  style={{ ...iconBtn, position: "absolute", top: -8, right: -8, width: 22, height: 22 }}
                >
                  <X size={12} />
                </button>
              </div>
            ) : null}
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={busy} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
              {busy ? <Loader size={14} /> : <ImagePlus size={14} />} {image ? "Change picture" : "Add a picture"}
            </Button>
          </div>
          <input ref={fileRef} type="file" accept={IMAGE_RULES.acceptAttr} hidden onChange={(e) => { void pick(e.target.files); e.target.value = ""; }} aria-label="Category picture" />
          <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.5 }}>Shown beside the category's heading and in the category lists on your menu. Any format — it is compressed for you.</p>
          {uploadError ? <Toast kind="error">{uploadError}</Toast> : null}
        </div>

        <Checkbox checked={isActive} onChange={setIsActive} label="Show on the menu" info="Switch off to hide this category — and everything inside it — from customers without deleting it." />

        {error ? <Toast kind="error">{error.message}</Toast> : null}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button variant="outline" onClick={cancel}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending || busy || !name.trim()}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------- add one or several categories */

let nextRowId = 1;
const blankRow = () => ({ id: nextRowId++, name: "", image: null });

/**
 * Add categories: one box to start with, "Add another category" for more — each box has its own name and its own
 * picture button. Empty boxes are ignored; Enter in a box moves on to the next (making one if it was the last).
 */
function AddCategoriesDialog({ outlet, menu, parentId: startParent, onClose }) {
  const [rows, setRows] = useState(() => [blankRow()]);
  const [parentId, setParentId] = useState(startParent);
  const [isActive, setIsActive] = useState(true);
  const [uploaded, setUploaded] = useState([]); // pictures uploaded in this window (cleaned up if not saved)
  const [busyRows, setBusyRows] = useState(() => new Set());
  const [focusId, setFocusId] = useState(null);
  const createMany = useCreateCategories(outlet);

  const categories = menu.categories;
  const options = useMemo(
    () => flattenCategories(categories).map(({ category, depth }) => ({
      id: category.id,
      label: `${"   ".repeat(depth)}${depth ? "↳ " : ""}${category.name}`,
      // the new categories sit one level below it
      disabled: categoryLevel(categories, category.id) + 1 > MAX_CATEGORY_DEPTH,
    })),
    [categories],
  );

  const named = rows.filter((r) => cleanCategoryName(r.name));
  const nameless = rows.filter((r) => !cleanCategoryName(r.name) && r.image); // a picture with no name to go with it
  const twice = duplicateCategoryName(rows.map((r) => r.name));
  const problem = nameless.length > 0 ? "Give each picture's category a name — or remove the picture." : twice ? `“${twice}” is in the list twice.` : null;
  const busy = busyRows.size > 0;
  const canAdd = named.length > 0 && !problem && !busy && !createMany.isPending;

  const patch = (id, change) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...change } : r)));
  const addRow = () => {
    if (rows.length >= MAX_CATEGORIES_AT_ONCE) return null;
    const row = blankRow();
    setRows((rs) => [...rs, row]);
    return row.id;
  };
  const forget = (key) => {
    if (!key || !uploaded.includes(key)) return;
    void api.deleteStorageObject(outlet, key);
    setUploaded((u) => u.filter((k) => k !== key));
  };
  const removeRow = (row) => {
    forget(row.image?.key);
    setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.id !== row.id) : [{ ...blankRow() }]));
  };
  const cancel = () => {
    for (const key of uploaded) void api.deleteStorageObject(outlet, key);
    onClose();
  };

  const save = () => {
    if (!canAdd) return;
    const categoriesToAdd = named.map((r) => ({
      name: cleanCategoryName(r.name),
      image: r.image ? { url: r.image.url, key: r.image.key ?? "", width: r.image.width, height: r.image.height } : null,
    }));
    createMany.mutate({ parentId: parentId || null, categories: categoriesToAdd, isActive }, { onSuccess: onClose });
  };

  const parentName = parentId ? categories.find((c) => c.id === parentId)?.name : null;
  const title = parentName ? `Add categories inside “${parentName}”` : "Add categories";

  return (
    <Modal onClose={cancel} width={540} ariaLabel="Add category">
      <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
        <h2 style={{ margin: 0, fontSize: 19 }}>{title}</h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }} data-testid="new-cat-rows">
          {rows.map((row, i) => (
            <NewCategoryRow
              key={row.id}
              outlet={outlet}
              row={row}
              index={i}
              onlyOne={rows.length === 1}
              autoFocus={row.id === focusId || (i === 0 && focusId === null)}
              duplicate={twice !== null && cleanCategoryName(row.name).toLowerCase() === twice.toLowerCase()}
              onName={(name) => patch(row.id, { name })}
              onImage={(image) => {
                forget(row.image?.key);
                if (image?.key) setUploaded((u) => [...u, image.key]);
                patch(row.id, { image });
              }}
              onRemove={() => removeRow(row)}
              onEnter={() => {
                const next = rows[i + 1]?.id ?? (cleanCategoryName(row.name) ? addRow() : null);
                if (next) setFocusId(next);
              }}
              onBusy={(isBusy) => setBusyRows((prev) => {
                if (prev.has(row.id) === isBusy) return prev;
                const next = new Set(prev);
                if (isBusy) next.add(row.id);
                else next.delete(row.id);
                return next;
              })}
            />
          ))}
        </div>

        <div>
          <button
            type="button"
            onClick={() => setFocusId(addRow())}
            disabled={rows.length >= MAX_CATEGORIES_AT_ONCE}
            style={{ ...smallBtn, fontSize: 13, padding: "6px 11px" }}
            data-testid="add-another"
          >
            <Plus size={13} /> Add another category
          </button>
          {rows.length >= MAX_CATEGORIES_AT_ONCE ? <span style={{ marginLeft: 10, fontSize: 12, color: "var(--color-text-muted)" }}>{MAX_CATEGORIES_AT_ONCE} at a time is the most.</span> : null}
        </div>

        <Field label="Inside" hint="Leave empty for top-level categories" info="Put these categories inside another, like Dosa inside South Indian. They then show under that category on the menu." style={{ maxWidth: "none" }}>
          <select value={parentId} onChange={(e) => setParentId(e.target.value)} style={selectStyle} aria-label="Inside">
            <option value="">— Top level —</option>
            {options.map((o) => (
              <option key={o.id} value={o.id} disabled={o.disabled}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>

        <Checkbox checked={isActive} onChange={setIsActive} label="Show on the menu" info="Switch off to hide these categories — and everything inside them — from customers without deleting them." />

        {problem ? <Toast kind="error">{problem}</Toast> : null}
        {createMany.error ? <Toast kind="error">{createMany.error.message}</Toast> : null}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button variant="outline" onClick={cancel}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!canAdd}>
            {createMany.isPending ? "Saving…" : named.length > 1 ? `Add ${named.length} categories` : "Add category"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/** One box in the Add window: a name, and a picture button of its own. */
function NewCategoryRow({ outlet, row, index, onlyOne, autoFocus, duplicate, onName, onImage, onRemove, onEnter, onBusy }) {
  const { upload, busy, error, clearError } = useImageUpload(outlet, { kind: "menu-categories" });
  const fileRef = useRef(null);
  const inputRef = useRef(null);
  const label = cleanCategoryName(row.name) || `category ${index + 1}`;

  useEffect(() => {
    onBusy(busy);
    return () => onBusy(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy]);
  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const pick = async (files) => {
    clearError();
    try {
      const [stored] = await upload(Array.from(files ?? []).slice(0, 1));
      if (stored) onImage(stored);
    } catch {
      /* the hook shows the reason */
    }
  };

  return (
    <div data-testid="new-cat-row" data-index={index}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {/* a slot of the same size in every box, so the names line up whether or not a picture is set */}
        <div style={{ position: "relative", flexShrink: 0, width: 38, height: 38 }}>
          {row.image ? (
            <>
              <img src={row.image.url} alt="" style={{ width: 38, height: 38, borderRadius: 9, objectFit: "cover", border: "1px solid var(--color-border)", display: "block" }} />
              <button type="button" aria-label={`Remove the picture of ${label}`} title="Remove picture" onClick={() => onImage(null)} style={{ ...iconBtn, position: "absolute", top: -7, right: -7, width: 18, height: 18 }}>
                <X size={10} />
              </button>
            </>
          ) : (
            <span aria-hidden style={{ width: 38, height: 38, boxSizing: "border-box", borderRadius: 9, border: "1px dashed var(--color-border)", display: "grid", placeItems: "center", color: "var(--color-text-muted)", opacity: 0.7 }}>
              <ImagePlus size={15} />
            </span>
          )}
        </div>
        <TextInput
          ref={inputRef}
          value={row.name}
          aria-label={`Name of category ${index + 1}`}
          placeholder={index === 0 ? "e.g. Dosa" : "Another category"}
          onChange={(e) => onName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onEnter();
            }
          }}
          style={{ flex: 1, minWidth: 0, borderColor: duplicate ? "var(--tone-danger)" : "var(--color-border)" }}
        />
        <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={busy} style={{ display: "inline-flex", gap: 6, alignItems: "center", justifyContent: "center", flexShrink: 0, width: 104 }} aria-label={`${row.image ? "Change" : "Add"} the picture of ${label}`}>
          {busy ? <Loader size={14} /> : <ImagePlus size={14} />} {row.image ? "Change" : "Picture"}
        </Button>
        <input ref={fileRef} type="file" accept={IMAGE_RULES.acceptAttr} hidden onChange={(e) => { void pick(e.target.files); e.target.value = ""; }} aria-label={`Picture file for ${label}`} />
        <button type="button" aria-label={`Remove ${label} from the list`} title={onlyOne ? "Clear" : "Remove from the list"} onClick={onRemove} style={{ ...iconBtn, flexShrink: 0, opacity: onlyOne && !row.name && !row.image ? 0.35 : 1 }}>
          <X size={14} />
        </button>
      </div>
      {error ? <Toast kind="error">{error}</Toast> : null}
    </div>
  );
}

/* ---------------------------------------------------------------- delete dialog */

function DeleteCategoriesDialog({ outlet, menu, ids, onClose, onDone }) {
  const [alsoItems, setAlsoItems] = useState(false);
  const remove = useDeleteCategories(outlet);
  const categories = menu.categories;
  const named = ids.map((id) => categories.find((c) => c.id === id)).filter(Boolean);
  const doomed = new Set(ids.flatMap((id) => categorySubtreeIds(categories, id)));
  const inside = doomed.size - named.length;
  const itemCount = menu.items.filter((i) => doomed.has(i.categoryId)).length;
  const label = named.length === 1 ? `“${named[0].name}”` : `${named.length} categories`;

  return (
    <Modal onClose={onClose} width={440} ariaLabel="Delete categories">
      <div style={{ padding: 22 }}>
        <h2 style={{ margin: "0 0 8px", fontSize: 19 }}>Delete {label}?</h2>
        <div style={{ fontSize: 14, lineHeight: 1.6 }}>
          {named.length > 1 ? (
            <ul style={{ margin: "0 0 8px", paddingLeft: 18 }}>
              {named.slice(0, 6).map((c) => <li key={c.id}>{c.name}</li>)}
              {named.length > 6 ? <li>…and {named.length - 6} more</li> : null}
            </ul>
          ) : null}
          {inside > 0 ? <p style={{ margin: "0 0 8px" }}>This also deletes the {inside} {inside === 1 ? "category" : "categories"} inside {named.length === 1 ? "it" : "them"}.</p> : null}
          {itemCount > 0 ? (
            <div style={{ padding: "10px 12px", border: "1px solid var(--tone-warning)", borderRadius: 8, background: "color-mix(in srgb, var(--tone-warning) 10%, var(--color-bg))" }} data-testid="delete-cat-items">
              <p style={{ margin: "0 0 8px" }}>
                {doomed.size === 1 ? "It holds" : "They hold"} <strong>{itemCount} {itemCount === 1 ? "item" : "items"}</strong>. Move {itemCount === 1 ? "it" : "them"} to another category first — or delete {itemCount === 1 ? "it" : "them"} too.
              </p>
              <Checkbox checked={alsoItems} onChange={setAlsoItems} label={`Also delete the ${itemCount} ${itemCount === 1 ? "item" : "items"}`} />
            </div>
          ) : (
            <p style={{ margin: 0, color: "var(--color-text-muted)" }}>There are no items in {doomed.size === 1 ? "it" : "them"}.</p>
          )}
        </div>
        {remove.error ? <Toast kind="error">{remove.error.message}</Toast> : null}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <Button variant="outline" onClick={onClose} disabled={remove.isPending}>
            Keep {named.length === 1 ? "it" : "them"}
          </Button>
          <button
            type="button"
            style={{ ...dangerBtn, padding: "9px 16px", opacity: itemCount > 0 && !alsoItems ? 0.5 : 1 }}
            disabled={remove.isPending || (itemCount > 0 && !alsoItems)}
            onClick={() => remove.mutate({ ids, deleteItems: alsoItems }, { onSuccess: onDone })}
          >
            {remove.isPending ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

const smallBtn = {
  font: "inherit",
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  fontSize: 12,
  padding: "2px 7px",
  borderRadius: 6,
  border: "1px solid var(--color-border)",
  background: "var(--color-bg)",
  color: "var(--color-text)",
  cursor: "pointer",
};
const catBtn = {
  flex: 1,
  minWidth: 0,
  display: "flex",
  alignItems: "center",
  gap: 8,
  font: "inherit",
  fontSize: 14,
  padding: "6px 10px",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
};
const nodeLine = "color-mix(in srgb, var(--color-text-muted) 55%, transparent)";
const lineStyle = `1px solid ${nodeLine}`;
/** a vertical line through the middle of a level's column */
const vLine = { position: "absolute", left: COL / 2, borderLeft: lineStyle, width: 0 };
/** the horizontal arm from a parent's line to this node */
const hLine = { position: "absolute", left: COL / 2, right: 0, top: "50%", borderTop: lineStyle, height: 0 };
const node = { position: "relative", zIndex: 1, boxSizing: "border-box", borderRadius: 999, padding: 0, display: "grid", placeItems: "center" };
const nodeParent = { width: 15, height: 15, border: `1.5px solid ${nodeLine}`, background: "var(--color-bg)", color: "var(--color-text-muted)", cursor: "pointer" };
const nodeLeaf = { width: 9, height: 9, border: `1.5px solid ${nodeLine}` };
const grip = { display: "inline-grid", placeItems: "center", width: 16, height: 24, color: "var(--color-text-muted)", cursor: "grab", flexShrink: 0, opacity: 0.7 };
const thumb = { width: 22, height: 22, borderRadius: 6, objectFit: "cover", flexShrink: 0 };
