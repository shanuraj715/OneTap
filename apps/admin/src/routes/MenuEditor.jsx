import { useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_IMAGE_RATIO, flattenCategories, formatINR, IMAGE_RULES, imageRatioMeta, imageRatioOf, imageRoom, ITEM_IMAGE_RATIOS, limitImages, modifierRuleText, PREP_STATION_LABELS } from "@onetap/config-schema";
import { ClipboardPaste, Download, ImagePlus, Loader, Star, X } from "lucide-react";
import * as api from "../lib/api";
import { ImportMenuModal } from "../components/ImportMenuModal";

import { useOutlet } from "../lib/useOutlet";
import { useImageUpload } from "../lib/useStorage";
import { readClipboardImages, usePasteImages } from "../lib/usePasteImages";
import {
  useCreateItem,
  useCreateModifierGroup,
  useDeleteModifierGroup,
  useMenu,
  useUpdateItem,
  useUpdateModifierGroup,
} from "../lib/useMenu";
import { CategoriesPanel } from "./menu/CategoriesPanel";
import { ItemsPanel } from "./menu/ItemsPanel";
import { ComboEditor, ItemHours, PairsEditor, StockEditor } from "./menu/ItemExtras";
import { useSelection } from "./menu/shared";
import { AwesomeLoader, Button, Card, Field, Modal, PageHeader, TextInput, Toast } from "../ui";

const toPaise = (rupees        ) => Math.round(Number(rupees || 0) * 100);
const toRupees = (paise        ) => String(paise / 100);

export function MenuEditor() {
  const { outlet } = useOutlet();
  const menuQuery = useMenu(outlet);
  const [categoryId, setCategoryId] = useState               (null);
  const [editing, setEditing] = useState                         (null);
  const [importModal, setImportModal] = useState(null);
  // ticked categories / ticked items, for "delete selected"
  const catSel = useSelection();
  const itemSel = useSelection();

  const menu = menuQuery.data;

  // land on the first top-level category; if the selected one was deleted, fall back to it
  useEffect(() => {
    if (!menu) return;
    if (categoryId && menu.categories.some((c) => c.id === categoryId)) return;
    const first = flattenCategories(menu.categories)[0]?.category;
    setCategoryId(first ? first.id : null);
  }, [menu, categoryId]);

  // ticks never outlive the thing they were on
  useEffect(() => {
    if (!menu) return;
    catSel.keepOnly(new Set(menu.categories.map((c) => c.id)));
    itemSel.keepOnly(new Set(menu.items.map((i) => i.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menu]);

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
        <Card>
          {menuQuery.error ? (
            `⚠ ${(menuQuery.error         ).message}`
          ) : (
            <AwesomeLoader compact label="Loading menu items & categories…" />
          )}
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Menu"
        subtitle={`${menu.categories.length} categories · ${menu.items.length} items`}
        action={
          <Button
            onClick={() => setImportModal({ targetCategoryId: null })}
            style={{ display: "inline-flex", gap: 6, alignItems: "center" }}
          >
            <Download size={14} /> Import from outlet
          </Button>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "minmax(340px, 420px) minmax(0, 1fr)", gap: 20, alignItems: "start" }}>
        <CategoriesPanel
          outlet={outlet}
          menu={menu}
          selected={categoryId}
          onSelect={(id) => {
            setCategoryId(id);
            setEditing(null);
            itemSel.clear();
          }}
          onImport={() => setImportModal({ targetCategoryId: null })}
          selection={catSel}
        />

        <div>
          <ItemsPanel
            outlet={outlet}
            menu={menu}
            categoryId={categoryId}
            onNew={() => setEditing("new")}
            onEdit={setEditing}
            onImport={() => setImportModal({ targetCategoryId: categoryId })}
            selection={itemSel}
          />
        </div>
      </div>

      {/* the item form is a pop-up: its header and its Save / Cancel buttons stay put while the form scrolls; Esc closes it */}
      {editing ? (
        <ItemForm
          key={editing === "new" ? "new" : editing.id}
          outlet={outlet}
          menu={menu}
          categoryId={categoryId ?? ""}
          item={editing === "new" ? null : editing}
          onDone={() => setEditing(null)}
        />
      ) : null}

      <ModifierGroups outlet={outlet} menu={menu} />

      {importModal && (
        <ImportMenuModal
          outlet={outlet}
          currentMenu={menu}
          initialTargetCategoryId={importModal.targetCategoryId}
          onClose={() => setImportModal(null)}
        />
      )}
    </>
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
  // which kitchen-ticket printer makes it: "" = the same as its category
  const [prepStation, setPrepStation] = useState(item?.prepStation ?? "");
  // counted stock, its own hours, what a combo is made of, what goes well with it
  const [stock, setStock] = useState(item?.stock ?? null);
  const [availability, setAvailability] = useState(item?.availability ?? null);
  const [combo, setCombo] = useState(item?.combo ?? null);
  const [pairsWith, setPairsWith] = useState(item?.pairsWith ?? []);
  // where the dish lives — any category in the tree, so a dish can be placed or moved
  const [catId, setCatId] = useState(item?.categoryId ?? categoryId);
  const categoryChoices = useMemo(
    () => flattenCategories(menu.categories).map(({ category, depth }) => ({ id: category.id, label: `${"\u00A0\u00A0\u00A0".repeat(depth)}${depth ? "↳ " : ""}${category.name}` })),
    [menu.categories],
  );

  const pending = create.isPending || update.isPending;
  const error = (create.error ?? update.error)                ;

  /*
   * Photos are saved the moment they change — an upload, a paste, a replace, a removal, a new order — without pressing
   * Save (that is for the other fields). A dish that doesn't exist yet has nothing to save them to, so a NEW dish keeps
   * its photos in the form and saves them with "Create item".
   */
  const photoSave = useUpdateItem(outlet);
  const imagesBody = (list) => list.map((im) => ({ url: im.url, key: im.key ?? "", width: im.width, height: im.height, ratio: imageRatioOf(im) }));
  const savedImages = useRef(item?.images ?? []); // what the server has
  const photoQueue = useRef(Promise.resolve()); // saves go one after another, in the order they were made
  const [photoState, setPhotoState] = useState("idle"); // idle | saving | saved | error
  const [photoError, setPhotoError] = useState(null);
  const photoJobs = useRef(0); // saves still waiting or running
  const changeImages = (next) => {
    setImages(next);
    if (!item) return;
    photoJobs.current += 1;
    setPhotoState("saving");
    setPhotoError(null);
    photoQueue.current = photoQueue.current.then(async () => {
      try {
        const r = await photoSave.mutateAsync({ id: item.id, body: { images: imagesBody(next) } });
        savedImages.current = r?.item?.images ?? next;
        photoJobs.current -= 1;
        if (photoJobs.current === 0) setPhotoState((st) => (st === "error" ? st : "saved"));
      } catch (e) {
        photoJobs.current -= 1;
        // put the photos back to what is really saved, and say so
        setImages(savedImages.current);
        setPhotoError(e instanceof Error ? e.message : "The photos couldn't be saved.");
        setPhotoState("error");
      }
    });
  };

  // Closing a NEW dish throws away the photos it uploaded (nothing else holds them); an existing dish's photos are already saved.
  const close = () => {
    if (!item) for (const im of images) if (im.key) void api.deleteStorageObject(outlet, im.key);
    onDone();
  };

  const save = () => {
    if (!name.trim()) return;
    const body = {
      categoryId: catId,
      name: name.trim(),
      description: description.trim(),
      foodType,
      // an existing dish's photos are saved as they change; only a new dish sends them here
      ...(item ? {} : { images: imagesBody(images) }),
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      basePrice: variants.length ? 0 : toPaise(basePrice),
      variants: variants
        .filter((v) => v.label.trim())
        .map((v) => ({ id: v.id, label: v.label.trim(), price: toPaise(v.price) })),
      modifierGroupIds: groupIds,
      prepStation: prepStation || null,
      availability,
      combo: combo?.items?.some((p) => p.itemId) ? { items: combo.items.filter((p) => p.itemId) } : null,
      pairsWith,
      // stock only when it was changed here — orders may have changed the count while the form was open
      ...(JSON.stringify(stock) !== JSON.stringify(item?.stock ?? null) ? { stock } : {}),
    };
    if (item) update.mutate({ id: item.id, body }, { onSuccess: onDone });
    else create.mutate(body, { onSuccess: onDone }); // (its photos go with it, so they are NOT thrown away by close())
  };

  return (
    <Modal onClose={close} width={1200} panelStyle={{ height: "min(92vh, 820px)", maxHeight: "92vh" }} ariaLabel={item ? "Edit item" : "New item"} closeOnOverlay={false}>
      <header style={formHead}>
        <h2 style={{ margin: 0, fontSize: 18, fontFamily: "var(--font-heading)" }}>{item ? `Edit ${item.name}` : "New item"}</h2>
        <button type="button" onClick={close} aria-label="Close" title="Close (Esc)" style={formX} data-testid="item-form-close">
          <X size={16} />
        </button>
      </header>
      <div style={formBody} data-testid="item-form-body">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        <Field label="Name" info="What diners see on the menu and what the kitchen reads on the ticket. Keep it short — long names wrap awkwardly on a 58 mm receipt roll." style={{ maxWidth: "none" }}>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <Field label="Category" hint="Where it appears on the menu" info="Any category, including one inside another (South Indian → Dosa). Change it to move the dish." style={{ maxWidth: "none" }}>
          <select value={catId} onChange={(e) => setCatId(e.target.value)} style={selectStyle} aria-label="Category">
            {categoryChoices.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
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
        <Field
          label="Prepared at"
          hint="Which kitchen-ticket printer gets this dish"
          info="Decides where this dish's kitchen ticket (KOT) prints. “Same as its category” follows the category it is in (and the one above that…); if none says otherwise it is made in the Kitchen. Pick Bar for drinks so the bar printer — not the kitchen — gets them."
        >
          <select value={prepStation} onChange={(e) => setPrepStation(e.target.value)} style={selectStyle} aria-label="Prepared at" data-testid="item-prep-station">
            <option value="">Same as its category</option>
            {Object.entries(PREP_STATION_LABELS).map(([id, label]) => (
              <option key={id} value={id}>{label}</option>
            ))}
          </select>
        </Field>
      </div>

      <div style={{ borderTop: "1px solid var(--color-border)", margin: "6px 0 14px", paddingTop: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3, display: "flex", alignItems: "center", gap: 10 }}>
          Photos
          {item ? (
            <span style={{ fontSize: 12, fontWeight: 600, color: photoState === "error" ? "var(--tone-danger)" : "var(--color-text-muted)" }} data-testid="photos-status" role="status">
              {photoState === "saving" ? "Saving…" : photoState === "saved" ? "Saved" : photoState === "error" ? "Not saved" : ""}
            </span>
          ) : null}
        </div>
        <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 10, lineHeight: 1.5 }}>
          Menu cards come in different shapes, so a dish can have a picture for each: <strong>square</strong>, <strong>landscape 4:3</strong>,{" "}
          <strong>wide 16:9</strong> and <strong>portrait 3:4</strong>. A card shows the picture of its own shape; if the dish has none for it, the
          square one is used. Any format (JPEG, PNG, WebP, AVIF, HEIC…) — compressed automatically. TablePe sets where photos are kept and how
          small they are made. Copied a picture? Press Ctrl+V (⌘V on a Mac) here, or use Paste.{" "}
          <strong>{item ? "Photos are saved as soon as you add, change or remove them — you don't need to press Save for them." : "Photos are saved when you create the item."}</strong>
        </div>
        <ItemPhotos outlet={outlet} images={images} persisted={Boolean(item)} onChange={changeImages} />
        {photoError ? <Toast kind="error">{photoError}</Toast> : null}
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
          {/* as many columns as fit (each at least 190px wide), so a long list runs across the box, not down the page */}
          <div data-testid="item-addon-groups" style={groupGrid}>
            {menu.modifierGroups.map((g) => (
              <label key={g.id} data-testid="item-addon-group" data-group={g.name} style={groupCheck}>
                <input
                  type="checkbox"
                  style={{ marginTop: 3, flexShrink: 0 }}
                  checked={groupIds.includes(g.id)}
                  onChange={(e) =>
                    setGroupIds(e.target.checked ? [...groupIds, g.id] : groupIds.filter((id) => id !== g.id))
                  }
                />
                <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>
                  {g.name}
                  <span style={{ display: "block", color: "var(--color-text-muted)", fontSize: 12 }}>
                    {g.options.length} {g.options.length === 1 ? "option" : "options"}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      <StockEditor value={stock} onChange={setStock} />
      <ItemHours value={availability} onChange={setAvailability} />
      <ComboEditor menu={menu} itemId={item?.id} value={combo} onChange={setCombo} price={variants.length ? Math.min(...variants.map((v) => toPaise(v.price))) : toPaise(basePrice)} />
      <PairsEditor menu={menu} itemId={item?.id} value={pairsWith} onChange={setPairsWith} />

      </div>
      {/* the buttons stay put while the form above scrolls */}
      <footer style={formFoot} data-testid="item-form-footer">
        <span style={{ flex: 1, minWidth: 0 }}>{error ? <Toast kind="error">{error.message}</Toast> : null}</span>
        <Button variant="outline" onClick={close} data-testid="item-form-cancel">
          Cancel
        </Button>
        <Button onClick={save} disabled={pending || !name.trim()} data-testid="item-form-save">
          {pending ? "Saving…" : item ? "Save changes" : "Create item"}
        </Button>
      </footer>
    </Modal>
  );
}

const formHead = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 22px", borderBottom: "1px solid var(--color-border)", flex: "0 0 auto" };
const formBody = { flex: "1 1 auto", minHeight: 0, overflowY: "auto", padding: "18px 22px 8px", overscrollBehavior: "contain" };
const formFoot = { display: "flex", alignItems: "center", gap: 10, padding: "12px 22px", borderTop: "1px solid var(--color-border)", background: "var(--color-bg)", flex: "0 0 auto" };
const formX = { display: "inline-grid", placeItems: "center", width: 30, height: 30, borderRadius: 8, border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text-muted)", cursor: "pointer" };

/* --------------------------------------------------------------- item photos */

function ItemPhotos({ outlet, images, persisted, onChange }) {
  const { upload, busy, error, clearError } = useImageUpload(outlet);
  const inputs = useRef({});
  const [dragOver, setDragOver] = useState(null);
  // where Ctrl/⌘+V (and a slot's own Paste button) puts a picture — the last section the person clicked
  const [target, setTarget] = useState(DEFAULT_IMAGE_RATIO);
  // which section is receiving a picture right now — the "Uploading…" label stays there even if another section is clicked
  const [uploadingRatio, setUploadingRatio] = useState(null);
  // what to tell the person after a paste that couldn't be used (the upload hook reports its own errors)
  const [pasteNote, setPasteNote] = useState(null);

  const of = (ratio) => images.filter((im) => imageRatioOf(im) === ratio);
  const others = (ratio) => images.filter((im) => imageRatioOf(im) !== ratio);

  // A dish that exists saves its photos as they change, and the server deletes the file of one that is taken off. A
  // NEW dish has saved nothing yet, so a photo taken off it is deleted from storage here.
  const discard = (img) => {
    if (!persisted && img?.key) void api.deleteStorageObject(outlet, img.key);
  };

  /** Add pictures to one shape. A shape that holds one picture swaps it for the new one; squares add up to six. */
  const addFiles = async (fileList, ratio) => {
    clearError();
    setPasteNote(null);
    const meta = imageRatioMeta(ratio);
    const replaces = meta.max === 1;
    const files = Array.from(fileList ?? []).slice(0, replaces ? 1 : Math.max(0, imageRoom(images, ratio)));
    if (!files.length) return;
    setUploadingRatio(ratio);
    try {
      const stored = (await upload(files)).map((s) => ({ ...s, ratio }));
      if (replaces) {
        for (const old of of(ratio)) discard(old);
        onChange(limitImages([...others(ratio), ...stored]));
      } else onChange(limitImages([...of(ratio), ...stored, ...others(ratio)]));
    } catch {
      /* error surfaced by the hook */
    } finally {
      setUploadingRatio(null);
    }
  };

  // A picture pasted from the clipboard (Ctrl/⌘+V, or a Paste button) is added like one picked from the file box.
  const addPasted = (files, ratio) => {
    setPasteNote(null);
    if (busy) return;
    const meta = imageRatioMeta(ratio);
    const room = imageRoom(images, ratio);
    if (meta.max > 1 && room <= 0) {
      setPasteNote(`This item already has ${meta.max} ${meta.label.toLowerCase()} photos — remove one to paste another.`);
      return;
    }
    if (meta.max > 1 && files.length > room) setPasteNote(`Only the first ${room} of ${files.length} pasted pictures fit (up to ${meta.max} ${meta.label.toLowerCase()} per item).`);
    if (meta.max === 1 && files.length > 1) setPasteNote("A card shows one picture of this shape, so only the first pasted picture was used.");
    void addFiles(files, ratio);
  };
  usePasteImages((files) => addPasted(files, target));

  const pasteFromButton = async (ratio) => {
    setPasteNote(null);
    setTarget(ratio);
    const r = await readClipboardImages();
    if (r.files) addPasted(r.files, ratio);
    else if (r.reason === "empty") setPasteNote("There's no picture on your clipboard. Copy a picture first, then press Paste.");
    else if (r.reason === "denied") setPasteNote("Your browser didn't allow reading the clipboard. Click on this page and press Ctrl+V (⌘V on a Mac) instead.");
    else setPasteNote("This browser can't paste from a button. Press Ctrl+V (⌘V on a Mac) instead.");
  };

  const remove = (img) => {
    discard(img);
    onChange(images.filter((x) => x !== img));
  };

  // squares are a row: the first is the cover, and they can be put in order
  const moveSquare = (idx, dir) => {
    const squares = of(DEFAULT_IMAGE_RATIO);
    const to = idx + dir;
    if (to < 0 || to >= squares.length) return;
    const next = [...squares];
    [next[idx], next[to]] = [next[to], next[idx]];
    onChange([...next, ...others(DEFAULT_IMAGE_RATIO)]);
  };

  const dropProps = (ratio) => ({
    onDragOver: (e) => {
      e.preventDefault();
      setDragOver(ratio);
    },
    onDragLeave: () => setDragOver((d) => (d === ratio ? null : d)),
    onDrop: (e) => {
      e.preventDefault();
      setDragOver(null);
      setTarget(ratio);
      void addFiles(e.dataTransfer.files, ratio);
    },
  });

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }} data-testid="item-photo-slots">
        {ITEM_IMAGE_RATIOS.map((meta) => {
          const ratio = meta.id;
          const list = of(ratio);
          const isSquare = ratio === DEFAULT_IMAGE_RATIO;
          const room = imageRoom(images, ratio);
          const idSuffix = isSquare ? "" : `-${ratio}`;
          const tileH = 104;
          const tileW = Math.round(tileH * meta.aspect);
          return (
            <section
              key={ratio}
              data-testid={`photo-slot-${ratio}`}
              data-active={target === ratio}
              onClick={() => setTarget(ratio)}
              style={{ ...slotBox, ...(target === ratio ? slotBoxOn : null) }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                <strong style={{ fontSize: 13 }}>
                  {meta.label} <span style={{ color: "var(--color-text-muted)", fontWeight: 600 }}>{ratio}</span>
                </strong>
                {isSquare ? <span style={defaultBadge}>Default</span> : null}
                <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                  {meta.hint}
                  {isSquare ? ` Up to ${meta.max}; the first is the cover.` : " One picture."}
                </span>
              </div>

              <div {...dropProps(ratio)} style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {list.map((im, idx) => {
                  const off = im.width && im.height ? Math.abs(im.width / im.height / meta.aspect - 1) > 0.08 : false;
                  return (
                    <div key={im.key || im.url} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <div style={{ ...thumbBox, width: tileW, height: tileH }} data-testid={`item-photo${idSuffix}`}>
                        <img src={im.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        {isSquare && idx === 0 ? (
                          <span style={coverBadge}>
                            <Star size={9} fill="currentColor" /> Cover
                          </span>
                        ) : null}
                        <div style={thumbActions}>
                          {isSquare && idx > 0 ? (
                            <button type="button" title="Make cover / move left" style={thumbBtn} onClick={() => moveSquare(idx, -1)}>
                              ←
                            </button>
                          ) : null}
                          {isSquare && idx < list.length - 1 ? (
                            <button type="button" title="Move right" style={thumbBtn} onClick={() => moveSquare(idx, 1)}>
                              →
                            </button>
                          ) : null}
                          {!isSquare ? (
                            <button type="button" title="Replace with another photo" style={thumbBtn} disabled={busy} onClick={() => inputs.current[ratio]?.click()} data-testid={`replace-photo${idSuffix}`}>
                              {busy && uploadingRatio === ratio ? "Uploading…" : "Replace"}
                            </button>
                          ) : null}
                          <button type="button" title="Remove" style={{ ...thumbBtn, marginLeft: "auto" }} onClick={() => remove(im)} data-testid={`remove-photo${idSuffix}`}>
                            <X size={12} />
                          </button>
                        </div>
                      </div>
                      {off ? (
                        <span style={{ fontSize: 11, color: "var(--tone-warning)", maxWidth: tileW }} data-testid={`photo-trim${idSuffix}`}>
                          This one is not {ratio} — its edges are trimmed to fit.
                        </span>
                      ) : null}
                    </div>
                  );
                })}

                {room > 0 ? (
                  <button
                    type="button"
                    onClick={() => inputs.current[ratio]?.click()}
                    disabled={busy}
                    data-testid={`add-photo${idSuffix}`}
                    style={{
                      ...thumbBox,
                      ...addTile,
                      width: tileW,
                      height: tileH,
                      borderColor: dragOver === ratio ? "var(--color-primary)" : "var(--color-border)",
                      background: dragOver === ratio ? "color-mix(in srgb, var(--color-primary) 8%, var(--color-bg))" : "var(--color-bg)",
                    }}
                  >
                    {busy && uploadingRatio === ratio ? <Loader size={18} /> : <ImagePlus size={18} />}
                    <span style={{ fontSize: 11 }} data-testid={busy && uploadingRatio === ratio ? "photo-uploading" : undefined}>{busy && uploadingRatio === ratio ? "Uploading…" : isSquare ? "Add photo" : `Add ${meta.label.toLowerCase()} photo`}</span>
                  </button>
                ) : null}

                {room > 0 ? (
                  <button
                    type="button"
                    onClick={() => void pasteFromButton(ratio)}
                    disabled={busy}
                    title="Add the picture you copied (or press Ctrl+V / ⌘V)"
                    data-testid={`paste-photo${idSuffix}`}
                    style={{ ...thumbBox, ...addTile, width: isSquare ? tileW : 96, height: tileH, background: "var(--color-bg)", borderColor: "var(--color-border)" }}
                  >
                    <ClipboardPaste size={18} />
                    <span style={{ fontSize: 11 }}>Paste photo</span>
                  </button>
                ) : null}
              </div>

              <input
                ref={(el) => {
                  inputs.current[ratio] = el;
                }}
                type="file"
                accept={IMAGE_RULES.acceptAttr}
                multiple={isSquare}
                hidden
                data-testid={`photo-file${idSuffix}`}
                onChange={(e) => {
                  setTarget(ratio);
                  void addFiles(e.target.files, ratio);
                  e.target.value = "";
                }}
              />
            </section>
          );
        })}
      </div>
      <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--color-text-muted)" }} data-testid="paste-target">
        Ctrl+V (⌘V) pastes into the <strong>{imageRatioMeta(target).label.toLowerCase()} {target}</strong> section — click another section to change it.
      </p>
      {error ? <Toast kind="error">{error}</Toast> : null}
      {pasteNote ? <Toast kind="info">{pasteNote}</Toast> : null}
    </>
  );
}

const slotBox = { padding: "10px 12px 12px", border: "1px solid var(--color-border)", borderRadius: 12, background: "var(--color-surface)" };
const slotBoxOn = { borderColor: "var(--color-primary)", boxShadow: "0 0 0 1px var(--color-primary)" };
const defaultBadge = { fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", padding: "2px 7px", borderRadius: 999, background: "color-mix(in srgb, var(--color-primary) 14%, var(--color-bg))", color: "var(--color-primary)" };

/* ---------------------------------------------------------- modifier groups */

function ModifierGroups({ outlet, menu }) {
  const [name, setName] = useState("");
  const [options, setOptions] = useState("");
  const [editingId, setEditingId] = useState(null);
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
        // columns as wide as they can be while still fitting (at least 340px each); the group being edited takes the full width
        <div data-testid="group-list" style={groupListGrid}>
          {menu.modifierGroups.map((g) =>
            editingId === g.id ? (
              <GroupEditor key={g.id} outlet={outlet} group={g} onDone={() => setEditingId(null)} />
            ) : (
              <div key={g.id} style={itemRow} data-testid="group-row" data-group={g.name}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{g.name}</div>
                  <div style={{ fontSize: 12, color: "var(--color-text-muted)", overflowWrap: "anywhere" }}>
                    {g.options.map((o) => `${o.label} +${formatINR(o.priceDelta)}`).join(" · ") || "no options"}
                  </div>
                </div>
                <button
                  type="button"
                  style={iconBtn}
                  title="Edit"
                  aria-label={`Edit ${g.name}`}
                  data-testid="group-edit"
                  onClick={() => setEditingId(g.id)}
                >
                  ✎
                </button>
                <button
                  type="button"
                  style={iconBtn}
                  title="Delete"
                  aria-label={`Delete ${g.name}`}
                  onClick={() => window.confirm(`Delete "${g.name}"?`) && remove.mutate(g.id)}
                >
                  ×
                </button>
              </div>
            ),
          )}
        </div>
      )}

      {/*
        One row: both boxes and the button share a bottom edge and a height. The "how to write the options" hint sits under
        the whole row — inside the Options field it made that field taller and pushed its box out of line with the others.
      */}
      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
        <Field
          label="Group name"
          info="The heading a diner sees above a set of choices — 'Extra dips', 'Choose your spice'. It appears when they tap an item to customise it."
          style={{ marginBottom: 0, flex: "1 1 180px", maxWidth: 260 }}
        >
          <TextInput value={name} placeholder="Add-ons" onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field
          label="Options"
          info="Each choice and what it adds to the price. Write 'Cheese Dip + 30' to charge ₹30 extra, or just 'No onion' for a free option. These print on the kitchen ticket under the item, so cooks see them."
          style={{ marginBottom: 0, flex: "2 1 280px", maxWidth: 520 }}
        >
          <TextInput value={options} placeholder="Cheese Dip + 30, Extra Mayo + 15" onChange={(e) => setOptions(e.target.value)} />
        </Field>
        <Button onClick={add} disabled={create.isPending} style={{ height: 35, flexShrink: 0 }}>
          Add group
        </Button>
      </div>
      <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--color-text-muted)" }}>
        Separate the options with commas, and put a price after a + for an extra charge — e.g. Cheese Dip + 30, Extra Mayo + 15.
        To change a group later, press ✎ on it.
      </p>
      {create.error ? <Toast kind="error">{create.error.message}</Toast> : null}
      {remove.error ? <Toast kind="error">{remove.error.message}</Toast> : null}
    </Card>
  );
}

/**
 * What a group allows a customer to pick once it has `n` options. A group that let people pick any number keeps doing
 * so when options are added or removed; a group with a deliberate limit ("choose up to 2", "pick one") keeps its limit
 * (never more than it has options). Nothing here is typed in — the editor only changes the name and the options.
 */
function ruleFor(group, n) {
  const anyNumber = group.maxSelect >= group.options.length;
  const maxSelect = Math.max(1, anyNumber ? n : Math.min(group.maxSelect, n));
  return { maxSelect, minSelect: Math.min(group.minSelect, maxSelect) };
}

let rowKeyCounter = 0;
const nextRowKey = () => `opt-${++rowKeyCounter}`;

/** Edit one add-on group in place: rename it, change what each option is called and costs, add options, remove options. */
function GroupEditor({ outlet, group, onDone }) {
  const update = useUpdateModifierGroup(outlet);
  const [name, setName] = useState(group.name);
  // an existing option keeps its id (orders, carts and items refer to it); a new one gets its id from the server
  const [rows, setRows] = useState(() =>
    group.options.map((o) => ({ key: nextRowKey(), id: o.id, label: o.label, price: toRupees(o.priceDelta) })),
  );
  const [problem, setProblem] = useState(null);

  const setRow = (key, patch) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const save = () => {
    if (!name.trim()) return setProblem("Give the group a name.");
    if (rows.length === 0) return setProblem("A group needs at least one option — add one, or delete the group instead.");
    for (const r of rows) {
      if (!r.label.trim()) return setProblem("Every option needs a name — type it in, or remove the empty row.");
      const price = Number(r.price === "" ? 0 : r.price);
      if (!Number.isFinite(price) || price < 0) return setProblem(`"${r.label.trim()}": the extra price must be 0 or more.`);
    }
    setProblem(null);
    update.mutate(
      {
        id: group.id,
        body: {
          name: name.trim(),
          ...ruleFor(group, rows.length),
          options: rows.map((r) => ({ ...(r.id ? { id: r.id } : {}), label: r.label.trim(), priceDelta: toPaise(r.price) })),
        },
      },
      { onSuccess: onDone },
    );
  };

  const rule = modifierRuleText({ ...group, ...ruleFor(group, rows.length), options: rows });

  return (
    <div style={groupEditorBox} data-testid="group-editor" data-group={group.name}>
      <Field label="Group name" style={{ marginBottom: 0, maxWidth: 340 }}>
        <TextInput data-testid="group-name" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>

      <div>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
          Options <span style={{ fontWeight: 400, color: "var(--color-text-muted)" }}>— the extra price is in ₹; 0 means free</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 560 }}>
          {rows.map((r) => (
            <div key={r.key} style={{ display: "flex", gap: 8, alignItems: "center" }} data-testid="group-option">
              <TextInput
                data-testid="group-option-label"
                aria-label="Option name"
                value={r.label}
                placeholder="Option, e.g. Cheese Dip"
                onChange={(e) => setRow(r.key, { label: e.target.value })}
                style={{ flex: 1 }}
              />
              <TextInput
                data-testid="group-option-price"
                aria-label="Extra price in rupees"
                type="number"
                min="0"
                value={r.price}
                placeholder="₹"
                onChange={(e) => setRow(r.key, { price: e.target.value })}
                style={{ width: 100 }}
              />
              <button
                type="button"
                style={iconBtn}
                title="Remove this option"
                aria-label={`Remove ${r.label || "this option"}`}
                data-testid="group-option-remove"
                onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 8 }}>
          <Button
            variant="outline"
            data-testid="group-option-add"
            onClick={() => setRows((rs) => [...rs, { key: nextRowKey(), id: undefined, label: "", price: "0" }])}
          >
            + Add option
          </Button>
        </div>
      </div>

      <div style={{ fontSize: 12, color: "var(--color-text-muted)" }} data-testid="group-rule">
        {rule ? `${rule}.` : "Customers can pick any number of these."} Items that use this group keep using it.
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <Button onClick={save} disabled={update.isPending} data-testid="group-save">
          {update.isPending ? "Saving…" : "Save changes"}
        </Button>
        <Button variant="outline" onClick={onDone} data-testid="group-cancel">
          Cancel
        </Button>
      </div>
      {problem ? <Toast kind="error">{problem}</Toast> : null}
      {update.error ? <Toast kind="error">{update.error.message}</Toast> : null}
    </div>
  );
}

/* ------------------------------------------------------------------- shared */


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
const groupGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(190px, 100%), 1fr))", gap: "10px 18px" };
const groupCheck = { display: "flex", gap: 8, alignItems: "flex-start", fontSize: 14, minWidth: 0, cursor: "pointer" };
const groupListGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(340px, 100%), 1fr))", gap: 8, marginBottom: 16 };
const groupEditorBox = {
  gridColumn: "1 / -1",
  display: "flex",
  flexDirection: "column",
  gap: 14,
  padding: "14px 14px 16px",
  border: "1px solid var(--color-primary)",
  borderRadius: 8,
  background: "var(--color-bg)",
};
const itemRow = {
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
