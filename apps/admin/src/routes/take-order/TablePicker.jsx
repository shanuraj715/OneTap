import { useMemo, useState } from "react";
import { formatINR } from "@onetap/config-schema";
import { Armchair, Search } from "lucide-react";
import { input, muted } from "./styles";

/**
 * Step 1, always: which table. Grouped by zone (Ground Floor, Terrace…) the
 * way the room is laid out. A free table starts a new party; a seated one adds
 * to the party already there, whose name and running bill show on the tile.
 */
export function TablePicker({ tables, sessions, selectedId, onPick, loading }) {
  const [find, setFind] = useState("");
  const sessionByTable = useMemo(() => new Map(sessions.map((s) => [s.tableId, s])), [sessions]);

  const zones = useMemo(() => {
    const q = find.trim().toLowerCase();
    const shown = tables.filter((t) => t.isActive && (!q || t.number.toLowerCase().includes(q)));
    const byZone = new Map();
    for (const t of shown) {
      const zone = t.zone?.trim() || "Tables";
      if (!byZone.has(zone)) byZone.set(zone, []);
      byZone.get(zone).push(t);
    }
    // numeric-aware so table 10 comes after table 9
    for (const list of byZone.values()) list.sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
    return [...byZone.entries()];
  }, [tables, find]);

  const active = tables.filter((t) => t.isActive);

  if (loading) return <p style={{ ...muted, padding: 20 }}>Loading tables…</p>;
  if (active.length === 0) {
    return (
      <div style={empty}>
        <Armchair size={28} />
        <strong>No tables yet</strong>
        <span style={muted}>Add your tables under Tables first — every staff order is taken for a table.</span>
      </div>
    );
  }

  return (
    <div style={{ padding: "16px 16px 32px", maxWidth: 1100, width: "100%", boxSizing: "border-box", margin: "0 auto" }}>
      <div style={intro}>
        <div>
          <h2 style={heading}>Which table?</h2>
          <p style={{ ...muted, margin: "2px 0 0", fontSize: 13.5 }}>
            {active.filter((t) => !sessionByTable.has(t.id)).length} free · {sessionByTable.size} seated
          </p>
        </div>
        {active.length > 12 ? (
          <label style={{ position: "relative", flex: "0 1 220px" }}>
            <Search size={16} style={searchIcon} aria-hidden />
            <input
              value={find}
              onChange={(e) => setFind(e.target.value)}
              placeholder="Table no."
              inputMode="numeric"
              aria-label="Find a table by number"
              style={{ ...input, paddingLeft: 38 }}
            />
          </label>
        ) : null}
      </div>

      {zones.map(([zone, list]) => (
        <section key={zone} style={{ marginTop: 18 }}>
          <h3 style={zoneHead}>{zone}</h3>
          <div style={grid}>
            {list.map((t) => {
              const s = sessionByTable.get(t.id);
              // a seated party with nothing left to make or pay for has finished — the table just needs freeing
              const state = s
                ? s.allPaid && s.openOrders === 0
                  ? "done"
                  : "seated"
                : t.status === "needs-cleaning"
                  ? "cleaning"
                  : t.status === "reserved"
                    ? "reserved"
                    : "free";
              const tone = TONES[state];
              const selected = t.id === selectedId;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onPick(t.id)}
                  aria-pressed={selected}
                  className="ot-press"
                  style={{
                    ...tile,
                    borderColor: selected ? "var(--color-primary)" : tone.border,
                    boxShadow: selected ? "0 0 0 2px var(--color-primary)" : "none",
                    background: tone.bg,
                  }}
                >
                  <span style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", width: "100%" }}>
                    <span style={tableNo}>{t.number}</span>
                    <span style={{ ...muted, fontSize: 12 }}>{t.seats} seats</span>
                  </span>
                  <span style={{ ...statusPill, color: tone.fg }}>
                    <span style={{ width: 7, height: 7, borderRadius: 99, background: tone.fg }} />
                    {tone.label}
                  </span>
                  {s ? (
                    <span style={{ fontSize: 12.5, lineHeight: 1.35, textAlign: "left", width: "100%" }}>
                      <strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {s.customerName || "Guest"}
                      </strong>
                      <span style={muted}>
                        {s.orderCount} order{s.orderCount === 1 ? "" : "s"} · {formatINR(s.tab)}
                      </span>
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </section>
      ))}
      {zones.length === 0 ? <p style={{ ...muted, marginTop: 18 }}>No table matches “{find}”.</p> : null}
    </div>
  );
}

const TONES = {
  free: { label: "Free", fg: "var(--tone-success)", bg: "var(--color-bg)", border: "var(--color-border)" },
  seated: { label: "Seated", fg: "var(--tone-warning)", bg: "var(--tone-warning-wash)", border: "color-mix(in srgb, var(--tone-warning) 35%, transparent)" },
  done: { label: "Meal done · free it", fg: "var(--tone-success)", bg: "var(--tone-success-wash)", border: "color-mix(in srgb, var(--tone-success) 30%, transparent)" },
  cleaning: { label: "Needs cleaning", fg: "var(--color-text-muted)", bg: "var(--color-surface)", border: "var(--color-border)" },
  reserved: { label: "Reserved", fg: "var(--tone-info)", bg: "var(--tone-info-wash)", border: "color-mix(in srgb, var(--tone-info) 30%, transparent)" },
};

const intro = { display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap" };
const heading = { margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-0.01em", fontFamily: "var(--font-heading)" };
const zoneHead = { margin: "0 0 10px", fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text-muted)" };
const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(132px, 1fr))", gap: 10 };
const tile = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: 8,
  minHeight: 104,
  padding: "12px 14px",
  borderRadius: 16,
  borderWidth: 1,
  borderStyle: "solid",
  font: "inherit",
  color: "var(--color-text)",
  cursor: "pointer",
  textAlign: "left",
};
const tableNo = { fontSize: 28, fontWeight: 800, lineHeight: 1, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" };
const statusPill = { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700 };
const searchIcon = { position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)" };
const empty = { display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center", padding: "60px 24px", color: "var(--color-text)" };
