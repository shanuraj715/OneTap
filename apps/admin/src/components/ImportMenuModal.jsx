import { useMemo, useState } from "react";
import { formatINR } from "@onetap/config-schema";
import { useQuery } from "@tanstack/react-query";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  Layers,
  Search,
  X,
} from "lucide-react";
import * as api from "../lib/api";
import { useImportMenu } from "../lib/useMenu";
import { useOutlets } from "../lib/useOutlet";
import { AwesomeLoader, Button, Field, Modal, Select, TextInput, Toast } from "../ui";

export function Mark({ type }) {
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
      title={type ?? "veg"}
    >
      <span style={{ width: 6, height: 6, background: color, borderRadius: round ? "50%" : 1 }} />
    </span>
  );
}

export function ImportMenuModal({
  outlet,
  currentMenu,
  initialTargetCategoryId = null,
  onClose,
  onSuccess,
}) {
  const { outlets, scope } = useOutlets();
  const importMutation = useImportMenu(outlet);

  // Available source outlets in the same brand (excluding current outlet)
  const availableOutlets = useMemo(() => {
    return (outlets || []).filter((o) => (!scope || o.brandId === outlet?.brandId) && o._id !== outlet?._id);
  }, [outlets, scope, outlet]);

  const [sourceOutletId, setSourceOutletId] = useState(() => availableOutlets[0]?._id ?? "");
  const [destMode, setDestMode] = useState(() => (initialTargetCategoryId ? "target" : "preserve"));
  const [targetCatId, setTargetCatId] = useState(() => initialTargetCategoryId || currentMenu?.categories?.[0]?.id || "");

  // Selection states
  const [selectedCatIds, setSelectedCatIds] = useState(new Set());
  const [selectedItemIds, setSelectedItemIds] = useState(new Set());
  const [collapsedCatIds, setCollapsedCatIds] = useState(new Set());
  const [search, setSearch] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const selectedSourceOutlet = availableOutlets.find((o) => o._id === sourceOutletId);

  // Fetch source menu
  const { data: sourceMenu, isLoading: isSourceLoading, error: sourceError } = useQuery({
    queryKey: ["menu", sourceOutletId],
    queryFn: () => (selectedSourceOutlet ? api.getMenu(selectedSourceOutlet) : null),
    enabled: Boolean(selectedSourceOutlet),
  });

  const sourceCategories = sourceMenu?.categories ?? [];
  const sourceItems = sourceMenu?.items ?? [];

  // Filtered categories & items
  const normalizedSearch = search.trim().toLowerCase();
  const filteredCategories = useMemo(() => {
    if (!normalizedSearch) return sourceCategories;
    return sourceCategories.filter((cat) => {
      const matchCat = cat.name.toLowerCase().includes(normalizedSearch);
      const hasMatchingItem = sourceItems.some(
        (it) => it.categoryId === cat.id && (it.name.toLowerCase().includes(normalizedSearch) || it.tags?.some((t) => t.toLowerCase().includes(normalizedSearch)))
      );
      return matchCat || hasMatchingItem;
    });
  }, [sourceCategories, sourceItems, normalizedSearch]);

  const toggleCollapse = (catId) => {
    setCollapsedCatIds((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  };

  const handleToggleCategory = (catId) => {
    const catItems = sourceItems.filter((it) => it.categoryId === catId);
    const catItemIds = catItems.map((it) => it.id);

    setSelectedCatIds((prevCats) => {
      const nextCats = new Set(prevCats);
      const isCurrentlySelected = nextCats.has(catId);

      setSelectedItemIds((prevItems) => {
        const nextItems = new Set(prevItems);
        if (isCurrentlySelected) {
          // Deselect category and all its items
          nextCats.delete(catId);
          catItemIds.forEach((id) => nextItems.delete(id));
        } else {
          // Select category and all its items
          nextCats.add(catId);
          catItemIds.forEach((id) => nextItems.add(id));
        }
        return nextItems;
      });

      return nextCats;
    });
  };

  const handleSelectCategoryOnly = (catId) => {
    const catItems = sourceItems.filter((it) => it.categoryId === catId);
    const catItemIds = catItems.map((it) => it.id);

    setSelectedCatIds((prev) => new Set(prev).add(catId));
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      catItemIds.forEach((id) => next.delete(id));
      return next;
    });
  };

  const handleSelectCategoryAllItems = (catId) => {
    const catItems = sourceItems.filter((it) => it.categoryId === catId);
    const catItemIds = catItems.map((it) => it.id);

    setSelectedCatIds((prev) => new Set(prev).add(catId));
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      catItemIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const handleDeselectCategory = (catId) => {
    const catItems = sourceItems.filter((it) => it.categoryId === catId);
    const catItemIds = catItems.map((it) => it.id);

    setSelectedCatIds((prev) => {
      const next = new Set(prev);
      next.delete(catId);
      return next;
    });
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      catItemIds.forEach((id) => next.delete(id));
      return next;
    });
  };

  const handleToggleItem = (itemId) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedCatIds(new Set(sourceCategories.map((c) => c.id)));
    setSelectedItemIds(new Set(sourceItems.map((i) => i.id)));
  };

  const handleClearAll = () => {
    setSelectedCatIds(new Set());
    setSelectedItemIds(new Set());
  };

  const selectedItemCount = selectedItemIds.size;
  const selectedCatCount = selectedCatIds.size;
  const totalSelected = selectedItemCount + selectedCatCount;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (totalSelected === 0) return;

    try {
      const payload = {
        sourceOutletId,
        categoryIds: destMode === "target" ? [] : Array.from(selectedCatIds),
        itemIds: Array.from(selectedItemIds),
        targetCategoryId: destMode === "target" ? targetCatId : undefined,
      };

      const res = await importMutation.mutateAsync(payload);
      setSuccessMsg(
        `Imported successfully: ${res.importedItemsCount} items, ${res.importedCategoriesCount} new categories.`
      );
      setTimeout(() => {
        onSuccess?.(res);
        onClose();
      }, 900);
    } catch {
      // Error is captured in importMutation.error
    }
  };

  return (
    <Modal onClose={onClose} ariaLabel="Import menu from another outlet" width={720}>
      <header style={modalHeader}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={headerIcon}>
            <Download size={20} />
          </span>
          <div>
            <h3 style={{ margin: 0, fontFamily: "var(--font-heading)", fontSize: 18 }}>
              Import Menu
            </h3>
            <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--color-text-muted)" }}>
              Copy categories and items from another outlet into <strong>{outlet?.name}</strong>
            </p>
          </div>
        </div>
        <button type="button" onClick={onClose} style={closeBtn} aria-label="Close">
          <X size={17} />
        </button>
      </header>

      {availableOutlets.length === 0 ? (
        <div style={{ padding: "32px 24px", textAlign: "center" }}>
          <Layers size={40} style={{ margin: "0 auto 12px", color: "var(--color-text-muted)", opacity: 0.6 }} />
          <h4 style={{ margin: "0 0 6px", fontSize: 16 }}>No other outlets found</h4>
          <p style={{ margin: "0 0 18px", fontSize: 13, color: "var(--color-text-muted)", maxWidth: 400, marginInline: "auto" }}>
            You need at least one other outlet in this brand to import menu data. Create another outlet first from Settings → Outlets.
          </p>
          <Button onClick={onClose}>Close</Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", maxHeight: "80vh" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--color-border)", display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Top row: source outlet selector & destination mode */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field label="Import from outlet" style={{ maxWidth: "none" }}>
                <Select
                  value={sourceOutletId}
                  onChange={(e) => {
                    setSourceOutletId(e.target.value);
                    setSelectedCatIds(new Set());
                    setSelectedItemIds(new Set());
                  }}
                  disabled={importMutation.isPending}
                >
                  {availableOutlets.map((o) => (
                    <option key={o._id} value={o._id}>
                      {o.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Destination structure" style={{ maxWidth: "none" }}>
                <Select
                  value={destMode}
                  onChange={(e) => setDestMode(e.target.value)}
                  disabled={importMutation.isPending}
                >
                  <option value="preserve">Keep source categories</option>
                  <option value="target">Place all selected items into one category</option>
                </Select>
              </Field>
            </div>

            {destMode === "target" && (
              <div style={{ background: "var(--color-bg-subtle, #f8f9fa)", padding: "10px 14px", borderRadius: 8, border: "1px solid var(--color-border)" }}>
                {currentMenu?.categories?.length > 0 ? (
                  <Field label="Choose target category in this outlet" style={{ maxWidth: "none", margin: 0 }}>
                    <Select
                      value={targetCatId}
                      onChange={(e) => setTargetCatId(e.target.value)}
                      disabled={importMutation.isPending}
                    >
                      {currentMenu.categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                ) : (
                  <p style={{ margin: 0, fontSize: 13, color: "var(--color-text-muted)" }}>
                    This outlet doesn&apos;t have any categories yet. Switch to &ldquo;Keep source categories&rdquo; to auto-create categories.
                  </p>
                )}
              </div>
            )}

            {/* Filter and quick actions */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div style={{ position: "relative", flex: 1, maxWidth: 300 }}>
                <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)" }} />
                <TextInput
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter categories or items…"
                  style={{ paddingLeft: 30, fontSize: 13 }}
                />
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={handleSelectAll} style={subtleBtn}>
                  Select all
                </button>
                <button type="button" onClick={handleClearAll} style={subtleBtn}>
                  Clear
                </button>
              </div>
            </div>
          </div>

          {/* Content Area */}
          <div style={{ padding: "14px 20px", overflowY: "auto", flex: 1, minHeight: 240, maxHeight: "45vh" }}>
            {isSourceLoading ? (
              <div style={{ padding: 40, textAlign: "center" }}>
                <AwesomeLoader compact label="Loading outlet menu…" />
              </div>
            ) : sourceError ? (
              <Toast kind="error">Failed to load source menu: {sourceError.message}</Toast>
            ) : filteredCategories.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center", color: "var(--color-text-muted)" }}>
                {normalizedSearch ? "No categories or items match your search." : "This outlet has no categories or items yet."}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {filteredCategories.map((cat) => {
                  const catItems = sourceItems.filter((it) => it.categoryId === cat.id);
                  const matchingItems = normalizedSearch
                    ? catItems.filter((it) => it.name.toLowerCase().includes(normalizedSearch) || it.tags?.some((t) => t.toLowerCase().includes(normalizedSearch)))
                    : catItems;

                  const isCatSelected = selectedCatIds.has(cat.id);
                  const selectedCountInCat = catItems.filter((it) => selectedItemIds.has(it.id)).length;
                  const isCollapsed = collapsedCatIds.has(cat.id);

                  return (
                    <div key={cat.id} style={categoryCard}>
                      {/* Category Header Bar */}
                      <div style={categoryHeader}>
                        <button
                          type="button"
                          onClick={() => toggleCollapse(cat.id)}
                          style={collapseBtn}
                          title={isCollapsed ? "Expand items" : "Collapse items"}
                        >
                          {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                        </button>

                        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", flex: 1, fontWeight: 600, fontSize: 14 }}>
                          <input
                            type="checkbox"
                            checked={isCatSelected}
                            onChange={() => handleToggleCategory(cat.id)}
                            style={{ accentColor: "var(--color-primary)", width: 16, height: 16 }}
                          />
                          <span>{cat.name}</span>
                          <span style={pillBadge}>
                            {selectedCountInCat}/{catItems.length} items
                          </span>
                        </label>

                        {/* Quick actions for this category */}
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <button
                            type="button"
                            onClick={() => handleSelectCategoryAllItems(cat.id)}
                            style={miniBtn}
                            title="Select category and all items"
                          >
                            All items
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSelectCategoryOnly(cat.id)}
                            style={miniBtn}
                            title="Import category empty without items"
                          >
                            Category only
                          </button>
                          {(isCatSelected || selectedCountInCat > 0) && (
                            <button
                              type="button"
                              onClick={() => handleDeselectCategory(cat.id)}
                              style={{ ...miniBtn, color: "var(--color-text-muted)" }}
                              title="Deselect category and items"
                            >
                              Reset
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Items List */}
                      {!isCollapsed && (
                        <div style={itemsContainer}>
                          {matchingItems.length === 0 ? (
                            <p style={{ margin: 0, padding: "8px 12px", fontSize: 12.5, color: "var(--color-text-muted)" }}>
                              No items in this category.
                            </p>
                          ) : (
                            matchingItems.map((it) => {
                              const isChecked = selectedItemIds.has(it.id);
                              return (
                                <label
                                  key={it.id}
                                  style={{
                                    ...itemRow,
                                    background: isChecked ? "color-mix(in srgb, var(--color-primary) 6%, transparent)" : "transparent",
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => handleToggleItem(it.id)}
                                    style={{ accentColor: "var(--color-primary)", width: 15, height: 15, flexShrink: 0 }}
                                  />

                                  {it.images?.[0]?.url ? (
                                    <img
                                      src={it.images[0].url}
                                      alt=""
                                      style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover", flexShrink: 0 }}
                                    />
                                  ) : null}

                                  <Mark type={it.foodType} />

                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                      <span style={{ fontSize: 13.5, fontWeight: 500 }}>{it.name}</span>
                                      {it.variants?.length > 1 ? (
                                        <span style={itemSubBadge}>{it.variants.length} variants</span>
                                      ) : null}
                                      {it.modifierGroupIds?.length > 0 ? (
                                        <span style={itemSubBadge}>{it.modifierGroupIds.length} add-on groups</span>
                                      ) : null}
                                    </div>
                                    {it.description ? (
                                      <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "var(--color-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {it.description}
                                      </p>
                                    ) : null}
                                  </div>

                                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)", flexShrink: 0 }}>
                                    {it.variants?.length > 1
                                      ? `from ${formatINR(Math.min(...it.variants.map((v) => v.price)))}`
                                      : formatINR(it.basePrice ?? 0)}
                                  </div>
                                </label>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer Bar */}
          <footer style={modalFooter}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: totalSelected > 0 ? "var(--color-primary)" : "var(--color-text-muted)" }}>
                {totalSelected > 0 ? (
                  <>
                    Selected: {selectedItemCount} items
                    {destMode === "preserve" && selectedCatCount > 0 ? `, ${selectedCatCount} categories` : ""}
                  </>
                ) : (
                  "Select items or categories to import"
                )}
              </span>
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button type="button" onClick={onClose} style={cancelBtn} disabled={importMutation.isPending}>
                Cancel
              </button>
              <Button
                type="submit"
                disabled={totalSelected === 0 || importMutation.isPending || (destMode === "target" && !targetCatId)}
                style={{ display: "inline-flex", gap: 6, alignItems: "center" }}
              >
                {importMutation.isPending ? (
                  "Importing…"
                ) : (
                  <>
                    <Download size={14} /> Import {selectedItemCount > 0 ? `${selectedItemCount} item${selectedItemCount > 1 ? "s" : ""}` : `${selectedCatCount} category`}
                  </>
                )}
              </Button>
            </div>
          </footer>

          {importMutation.error ? (
            <div style={{ padding: "0 20px 14px" }}>
              <Toast kind="error">{importMutation.error.message}</Toast>
            </div>
          ) : null}

          {successMsg ? (
            <div style={{ padding: "0 20px 14px" }}>
              <Toast kind="success">{successMsg}</Toast>
            </div>
          ) : null}
        </form>
      )}
    </Modal>
  );
}

/* ------------------------------------------------------------------- styles */

const modalHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  padding: "18px 20px",
  borderBottom: "1px solid var(--color-border)",
};

const headerIcon = {
  display: "grid",
  placeItems: "center",
  width: 38,
  height: 38,
  borderRadius: 10,
  background: "color-mix(in srgb, var(--color-primary) 14%, transparent)",
  color: "var(--color-primary)",
  flexShrink: 0,
};

const closeBtn = {
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

const modalFooter = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: "14px 20px",
  borderTop: "1px solid var(--color-border)",
  background: "var(--color-bg)",
};

const cancelBtn = {
  font: "inherit",
  padding: "7px 14px",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  background: "var(--color-bg)",
  color: "var(--color-text)",
  fontSize: 13,
  cursor: "pointer",
};

const subtleBtn = {
  font: "inherit",
  padding: "4px 10px",
  border: "1px solid var(--color-border)",
  borderRadius: 6,
  background: "transparent",
  color: "var(--color-text)",
  fontSize: 12,
  cursor: "pointer",
};

const miniBtn = {
  font: "inherit",
  padding: "3px 8px",
  border: "1px solid var(--color-border)",
  borderRadius: 5,
  background: "var(--color-bg)",
  color: "var(--color-text)",
  fontSize: 11,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const categoryCard = {
  border: "1px solid var(--color-border)",
  borderRadius: 9,
  overflow: "hidden",
  background: "var(--color-bg)",
};

const categoryHeader = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "9px 12px",
  background: "color-mix(in srgb, var(--color-bg-subtle, #f8f9fa) 80%, transparent)",
  borderBottom: "1px solid var(--color-border)",
};

const collapseBtn = {
  display: "grid",
  placeItems: "center",
  background: "transparent",
  border: "none",
  padding: 0,
  cursor: "pointer",
  color: "var(--color-text-muted)",
};

const pillBadge = {
  fontSize: 11,
  fontWeight: 500,
  padding: "1px 7px",
  borderRadius: 10,
  background: "var(--color-border)",
  color: "var(--color-text-muted)",
};

const itemSubBadge = {
  fontSize: 10.5,
  fontWeight: 500,
  padding: "1px 6px",
  borderRadius: 4,
  background: "color-mix(in srgb, var(--color-primary) 10%, transparent)",
  color: "var(--color-primary)",
};

const itemsContainer = {
  display: "flex",
  flexDirection: "column",
  padding: "4px 0",
};

const itemRow = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "8px 14px",
  cursor: "pointer",
  transition: "background 0.15s ease",
  borderBottom: "1px solid color-mix(in srgb, var(--color-border) 40%, transparent)",
};
