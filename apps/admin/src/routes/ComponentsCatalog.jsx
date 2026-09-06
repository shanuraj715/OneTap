import { useState, useMemo } from "react";
import {
  Boxes,
  Calendar,
  Check,
  ChevronRight,
  Copy,
  Filter,
  Layers,
  Palette,
  Search,
  SlidersHorizontal,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react";
import {
  VARIANT_SLOTS,
  DatePicker,
  DatePickerInput,
  StatCard,
  AnalyticsChart,
} from "@onetap/ui";
import { useOutlet } from "../lib/useOutlet";

const PRESET_THEMES = [
  { name: "Default (Gazab)", color: "#FF5200" },
  { name: "Royal Blue", color: "#2563EB" },
  { name: "Emerald Green", color: "#10B981" },
  { name: "Rose Crimson", color: "#E11D48" },
  { name: "Violet", color: "#7C3AED" },
  { name: "Amber Gold", color: "#D97706" },
  { name: "Slate Dark", color: "#1E293B" },
];

const CATEGORIES = [
  { id: "all", label: "All Components", icon: Boxes },
  { id: "pickers", label: "Pickers & Inputs", icon: Calendar, slots: ["datePickerVariant", "buttonVariant", "chipVariant", "dropdownVariant"] },
  { id: "analytics", label: "Analytics & Data", icon: Layers, slots: ["statCardVariant", "analyticsChartVariant", "progressVariant", "listGroupVariant"] },
  { id: "storefront", label: "Storefront & Cards", icon: UtensilsCrossed, slots: ["itemCardVariant", "contentCardVariant", "carouselVariant", "popupCarouselVariant", "headerVariant", "footerVariant"] },
  { id: "feedback", label: "Feedback & Status", icon: Sparkles, slots: ["badgeVariant", "alertVariant", "toastVariant"] },
  { id: "overlays", label: "Overlays & Dialogs", icon: SlidersHorizontal, slots: ["modalVariant", "popoverVariant", "accordionVariant", "faqVariant"] },
];

const FALLBACK_ITEMS = [
  {
    id: "sample-1",
    name: "Veg Steamed Momos",
    price: 120,
    description: "Delicate steamed dumplings with minced cabbage, carrots & mild spices",
    isAvailable: true,
    variants: [
      { id: "v1", name: "6 pcs", price: 120 },
      { id: "v2", name: "10 pcs", price: 180 },
    ],
  },
  {
    id: "sample-2",
    name: "Kurkure Momos",
    price: 150,
    description: "Crispy coated momos fried to golden perfection with spicy schezwan dip",
    isAvailable: true,
    variants: [],
  },
  {
    id: "sample-3",
    name: "Tandoori Momos",
    price: 160,
    description: "Marinated in spiced yogurt and char-grilled with mint chutney",
    isAvailable: false,
    variants: [],
  },
];

export function ComponentsCatalog() {
  const { outlet } = useOutlet();
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [customTheme, setCustomTheme] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  // Active theme color (defaults to outlet's primary or #FF5200)
  const defaultPrimary = outlet?.config?.theme?.colors?.primary || "#FF5200";
  const activeColor = customTheme || defaultPrimary;

  // Outlet preview context
  const previewCtx = useMemo(() => {
    const name = outlet?.config?.identity?.name || outlet?.name || "Gazab Momos";
    return {
      outletName: name,
      tagline: outlet?.config?.identity?.tagline || "Authentic taste & delicious bites",
      phone: outlet?.config?.identity?.phone || "+91 98765 43210",
      address: outlet?.config?.identity?.address || "Shop 12, Main Market, Delhi",
      fssaiLicense: outlet?.config?.identity?.fssaiLicense || "10023456789012",
      gstin: outlet?.config?.identity?.gstin || "07AAAAA0000A1Z5",
      items: FALLBACK_ITEMS,
    };
  }, [outlet]);

  // Filter slots based on category and search
  const filteredSlots = useMemo(() => {
    let slots = VARIANT_SLOTS;

    if (activeCategory !== "all") {
      const cat = CATEGORIES.find((c) => c.id === activeCategory);
      if (cat?.slots) {
        slots = slots.filter((s) => cat.slots.includes(s.key));
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      slots = slots
        .map((s) => {
          const slotMatches = s.label.toLowerCase().includes(q) || s.description.toLowerCase().includes(q);
          const matchingVariants = s.variants.filter(
            (v) =>
              v.name.toLowerCase().includes(q) ||
              v.code.toLowerCase().includes(q) ||
              v.id.toLowerCase().includes(q) ||
              v.description.toLowerCase().includes(q)
          );
          if (slotMatches) return s;
          if (matchingVariants.length > 0) return { ...s, variants: matchingVariants };
          return null;
        })
        .filter(Boolean);
    }

    return slots;
  }, [activeCategory, searchQuery]);

  const totalVariantsCount = useMemo(
    () => VARIANT_SLOTS.reduce((sum, s) => sum + s.variants.length, 0),
    []
  );

  const handleCopyId = (id) => {
    navigator.clipboard?.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  return (
    <div
      style={{
        padding: "24px 28px 80px",
        maxWidth: 1280,
        margin: "0 auto",
        "--color-primary": activeColor,
        "--color-on-primary": "#ffffff",
        "--date-picker-primary": activeColor,
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "var(--color-primary)",
              color: "var(--color-on-primary)",
            }}
          >
            <Boxes size={18} />
          </span>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 700,
              margin: 0,
              color: "var(--color-text)",
              letterSpacing: "-0.01em",
            }}
          >
            UI Components & Design System
          </h1>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              padding: "3px 9px",
              borderRadius: 999,
              background: "color-mix(in srgb, var(--color-primary) 12%, transparent)",
              color: "var(--color-primary)",
              marginLeft: 4,
            }}
          >
            {totalVariantsCount} variants · {VARIANT_SLOTS.length} families
          </span>
        </div>
        <p style={{ margin: 0, fontSize: 14, color: "var(--color-text-muted)", maxWidth: 760 }}>
          Interactive catalog of every reusable component and layout variation. Switch theme colors below to test real-time adaptation.
        </p>
      </div>

      {/* Theme Color Customizer Toolbar */}
      <div
        style={{
          background: "var(--color-surface, #ffffff)",
          border: "1px solid var(--color-border, #e2e8f0)",
          borderRadius: 12,
          padding: "14px 18px",
          marginBottom: 24,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Palette size={16} style={{ color: "var(--color-primary)" }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)" }}>
            Theme color feature:
          </span>
          <span style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>
            Select a color to test dynamic recoloring:
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {PRESET_THEMES.map((theme) => {
            const isSelected = activeColor.toLowerCase() === theme.color.toLowerCase();
            return (
              <button
                key={theme.name}
                type="button"
                onClick={() => setCustomTheme(theme.color)}
                title={theme.name}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "5px 11px",
                  borderRadius: 999,
                  border: isSelected ? `2px solid ${theme.color}` : "1px solid var(--color-border, #e2e8f0)",
                  background: isSelected ? "color-mix(in srgb, currentColor 10%, transparent)" : "var(--color-bg)",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: isSelected ? 700 : 500,
                  color: isSelected ? theme.color : "var(--color-text)",
                  transition: "all 0.15s ease",
                }}
              >
                <span
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    backgroundColor: theme.color,
                    display: "inline-block",
                  }}
                />
                {theme.name.split(" ")[0]}
              </button>
            );
          })}

          {/* Custom color input */}
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 8px",
              borderRadius: 999,
              border: "1px dashed var(--color-border, #cbd5e1)",
              background: "var(--color-bg)",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 500,
              color: "var(--color-text-muted)",
            }}
          >
            <input
              type="color"
              value={activeColor.startsWith("#") ? activeColor : "#FF5200"}
              onChange={(e) => setCustomTheme(e.target.value)}
              style={{
                width: 18,
                height: 18,
                borderRadius: "50%",
                border: "none",
                cursor: "pointer",
                padding: 0,
                background: "transparent",
              }}
            />
            <span>Custom</span>
          </label>
        </div>
      </div>

      {/* Category Tabs & Search Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 20,
          borderBottom: "1px solid var(--color-border, #e2e8f0)",
          paddingBottom: 14,
        }}
      >
        {/* Category Pills */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {CATEGORIES.map((cat) => {
            const active = activeCategory === cat.id;
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "7px 14px",
                  borderRadius: 999,
                  border: "1px solid",
                  borderColor: active ? "var(--color-primary)" : "var(--color-border, #e2e8f0)",
                  background: active ? "var(--color-primary)" : "var(--color-surface, #ffffff)",
                  color: active ? "var(--color-on-primary, #ffffff)" : "var(--color-text)",
                  fontSize: 13,
                  fontWeight: active ? 700 : 500,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <Icon size={14} />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Search Bar */}
        <div
          style={{
            position: "relative",
            minWidth: 240,
            maxWidth: 320,
            width: "100%",
          }}
        >
          <Search
            size={14}
            style={{
              position: "absolute",
              left: 11,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--color-text-muted)",
              pointerEvents: "none",
            }}
          />
          <input
            type="text"
            placeholder="Search components or codes (e.g. DP01, C07)…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px 8px 32px",
              borderRadius: 8,
              border: "1px solid var(--color-border, #cbd5e1)",
              background: "var(--color-bg, #ffffff)",
              color: "var(--color-text)",
              fontSize: 13,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              style={{
                position: "absolute",
                right: 8,
                top: "50%",
                transform: "translateY(-50%)",
                border: "none",
                background: "transparent",
                color: "var(--color-text-muted)",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              ×
            </button>
          ) : null}
        </div>
      </div>

      {/* Component Sections */}
      {filteredSlots.length === 0 ? (
        <div
          style={{
            padding: "60px 20px",
            textAlign: "center",
            background: "var(--color-surface)",
            borderRadius: 14,
            border: "1px dashed var(--color-border)",
          }}
        >
          <Boxes size={32} style={{ color: "var(--color-text-muted)", margin: "0 auto 12px" }} />
          <h3 style={{ fontSize: 16, margin: "0 0 6px" }}>No matching components</h3>
          <p style={{ fontSize: 13, color: "var(--color-text-muted)", margin: 0 }}>
            Try adjusting your search query or switching categories.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
          {filteredSlots.map((slot) => {
            const activeId = outlet?.config?.layout?.[slot.key];

            return (
              <section key={slot.key} id={slot.key} style={{ scrollMarginTop: 24 }}>
                {/* Slot Header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    borderBottom: "2px solid var(--color-text)",
                    paddingBottom: 8,
                    marginBottom: 18,
                    flexWrap: "wrap",
                    gap: 12,
                  }}
                >
                  <div>
                    <h2
                      style={{
                        fontSize: 18,
                        fontWeight: 700,
                        margin: 0,
                        color: "var(--color-text)",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      {slot.label}
                      <span
                        style={{
                          fontSize: 11.5,
                          fontWeight: 600,
                          padding: "2px 7px",
                          borderRadius: 999,
                          background: "var(--color-border, #e2e8f0)",
                          color: "var(--color-text-muted)",
                        }}
                      >
                        {slot.variants.length}
                      </span>
                    </h2>
                    <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--color-text-muted)" }}>
                      {slot.description}
                    </p>
                  </div>

                  {activeId ? (
                    <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                      Active in storefront:{" "}
                      <code
                        style={{
                          fontFamily: "ui-monospace, monospace",
                          fontSize: 11.5,
                          background: "var(--color-surface)",
                          padding: "2px 6px",
                          borderRadius: 4,
                          border: "1px solid var(--color-border)",
                        }}
                      >
                        {activeId}
                      </code>
                    </span>
                  ) : null}
                </div>

                {/* Variants Grid / Stack */}
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  {slot.variants.map((meta) => {
                    const isActive = meta.id === activeId;
                    const isCopied = copiedId === meta.id;

                    return (
                      <div
                        key={meta.id}
                        style={{
                          border: `1px solid ${isActive ? "var(--color-primary)" : "var(--color-border, #e2e8f0)"}`,
                          borderRadius: 14,
                          background: "var(--color-surface, #ffffff)",
                          overflow: "hidden",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                        }}
                      >
                        {/* Meta Bar */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "9px 14px",
                            background: "var(--color-bg, #f8fafc)",
                            borderBottom: "1px solid var(--color-border, #e2e8f0)",
                            fontSize: 13,
                            flexWrap: "wrap",
                          }}
                        >
                          <span
                            style={{
                              fontFamily: "ui-monospace, monospace",
                              fontSize: 11.5,
                              fontWeight: 700,
                              padding: "2px 6px",
                              borderRadius: 4,
                              background: "var(--color-text)",
                              color: "var(--color-bg)",
                              letterSpacing: "0.04em",
                            }}
                          >
                            {meta.code}
                          </span>

                          <span style={{ fontWeight: 600, color: "var(--color-text)" }}>
                            {meta.name}
                          </span>

                          <code
                            style={{
                              fontFamily: "ui-monospace, monospace",
                              fontSize: 11.5,
                              color: "var(--color-text-muted)",
                              background: "var(--color-surface)",
                              border: "1px solid var(--color-border)",
                              padding: "2px 6px",
                              borderRadius: 4,
                            }}
                          >
                            {meta.id}
                          </code>

                          <button
                            type="button"
                            onClick={() => handleCopyId(meta.id)}
                            title="Copy component ID"
                            style={{
                              border: "none",
                              background: "transparent",
                              color: isCopied ? "var(--color-primary)" : "var(--color-text-muted)",
                              cursor: "pointer",
                              padding: 3,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              fontSize: 11.5,
                            }}
                          >
                            {isCopied ? <Check size={12} /> : <Copy size={12} />}
                            {isCopied ? "Copied" : null}
                          </button>

                          <span
                            style={{
                              fontSize: 12,
                              color: "var(--color-text-muted)",
                              marginLeft: 4,
                            }}
                          >
                            {meta.description}
                          </span>

                          {isActive ? (
                            <span
                              style={{
                                marginLeft: "auto",
                                fontSize: 10.5,
                                fontWeight: 700,
                                textTransform: "uppercase",
                                letterSpacing: "0.06em",
                                background: "var(--color-primary)",
                                color: "var(--color-on-primary)",
                                padding: "2px 7px",
                                borderRadius: 999,
                              }}
                            >
                              active
                            </span>
                          ) : null}
                        </div>

                        {/* Interactive Preview Canvas */}
                        <div
                          style={{
                            padding: slot.flush ? 0 : 20,
                            background: "var(--color-surface, #ffffff)",
                            overflowX: "auto",
                          }}
                        >
                          {slot.preview(meta, previewCtx)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
