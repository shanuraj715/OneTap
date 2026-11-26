import { useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useActiveSessions, useAreaPrefs, useTables } from "@/data/hooks";
import { buildTableRows, countByStatus, filterTables, groupTablesByZone, sessionForTable, STATUS_ICON, STATUS_LABEL, zonesOf, type TableRow, type TableStatus, type ZoneSummary } from "@/features/tables";
import { columnsForWidth, useLayout } from "@/lib/layout";
import { useNow } from "@/lib/useNow";
import { useSession } from "@/runtime";
import { Banner, Chip, EmptyState, ErrorState, Icon, IconTile, Screen, ScreenTitle, TableCardSkeleton, Text, TextField, useTheme } from "@/ui";
import { TableCard } from "./TableCard";

export interface TablesScreenProps {
  onOpenTable: (tableId: string) => void;
  /** the table shown in the side panel on a wide screen */
  selectedId?: string | null;
}

/** Search box appears only when the floor is big enough to need it. */
const SEARCH_FROM_TABLES = 12;

/** The floor at a glance: every table, who is at it, and what they owe. Refreshes by itself while the app is open. */
export function TablesScreen({ onOpenTable, selectedId }: TablesScreenProps) {
  const { c } = useTheme();
  const layout = useLayout();
  const tablesQ = useTables();
  const sessionsQ = useActiveSessions();
  const outletName = useSession((s) => s.outlets.find((o) => o.id === s.outletId)?.name ?? "");
  const now = useNow(30_000);

  const [zone, setZone] = useState<string | null>(null);
  const [status, setStatus] = useState<TableStatus | null>(null);
  const [query, setQuery] = useState("");
  const [pulling, setPulling] = useState(false);
  // the width this screen really has (a wide tablet shows a side panel and a navigation bar next to it)
  const [room, setRoom] = useState(0);

  const tables = useMemo(() => tablesQ.data ?? [], [tablesQ.data]);
  const sessions = useMemo(() => sessionsQ.data ?? [], [sessionsQ.data]);
  const zones = useMemo(() => zonesOf(tables), [tables]);
  const counts = useMemo(() => countByStatus(tables), [tables]);
  const shown = useMemo(() => filterTables(tables, { zone, status, query }), [tables, zone, status, query]);

  const cols = room > 0 ? columnsForWidth(room) : layout.tableColumns;
  // tables under their area: a heading per area, then its tables in rows
  const groups = useMemo(() => groupTablesByZone(shown), [shown]);
  // Areas start CLOSED. Which ones this person keeps open is remembered (per person and outlet) and comes back when the app is opened again.
  // A search or filter shows what it found, open — without changing what is remembered.
  const saved = useAreaPrefs();
  const searching = query.trim() !== "" || status !== null || zone !== null;
  const open = useMemo(() => new Set(groups.filter((g) => searching || saved.open.includes(g.label)).map((g) => g.label)), [groups, saved.open, searching]);
  const rows = useMemo(() => buildTableRows(groups, cols, open), [groups, cols, open]);
  const allAreas = useMemo(() => groupTablesByZone(tables.filter((t) => t.isActive)).map((g) => g.label), [tables]);
  const toggleArea = (label: string) => saved.setOpen(label, !saved.open.includes(label), allAreas);

  async function refresh() {
    setPulling(true);
    try { await Promise.all([tablesQ.refetch(), sessionsQ.refetch()]); } finally { setPulling(false); }
  }

  const loading = tablesQ.isLoading || !saved.ready; // (waits for the saved choices: areas never flash open and then shut)
  const failed = tablesQ.isError && !tablesQ.data;
  const stale = (tablesQ.isError || sessionsQ.isError) && !!tablesQ.data;
  const statuses: TableStatus[] = ["free", "seated", "bill-requested", ...(counts.reserved > 0 ? (["reserved"] as const) : [])];

  return (
    <Screen padded={false}>
      <View style={{ flex: 1 }} onLayout={(e) => setRoom(Math.round(e.nativeEvent.layout.width))}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 10 }}>
        <ScreenTitle
          icon="grid"
          title="Tables"
          right={<View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}><Icon name="store" size={15} color={c.muted} /><Text tone="muted" numberOfLines={1} style={{ flexShrink: 1 }}>{outletName}{tablesQ.data ? ` · ${counts.free} free of ${counts.all}` : ""}</Text></View>}
        />
        {stale ? <Banner tone="warn" message="Can't refresh right now. Showing the board as it was a moment ago." testID="board-stale" /> : null}
        {tables.length >= SEARCH_FROM_TABLES ? <TextField label="Find a table" value={query} onChangeText={setQuery} leftIcon="search" autoCapitalize="characters" testID="table-search" /> : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} accessibilityLabel="Filter by state">
          <Chip label="All" icon="grid" count={counts.all} selected={status === null} onPress={() => setStatus(null)} testID="filter-all" />
          {statuses.map((s) => <Chip key={s} label={STATUS_LABEL[s]} icon={STATUS_ICON[s]} count={counts[s]} selected={status === s} onPress={() => setStatus(status === s ? null : s)} testID={`filter-${s}`} />)}
        </ScrollView>
        {zones.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} accessibilityLabel="Filter by area">
            <Chip label="Every area" icon="layers" selected={zone === null} onPress={() => setZone(null)} />
            {zones.map((z) => <Chip key={z} label={z} icon="pin" selected={zone === z} onPress={() => setZone(zone === z ? null : z)} testID={`zone-${z}`} />)}
          </ScrollView>
        ) : null}
      </View>

      {loading ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, padding: 16 }} accessibilityLabel="Loading tables">
          {Array.from({ length: Math.max(cols, 3) * 2 }, (_, i) => <TableCardSkeleton key={i} />)}
        </View>
      ) : failed ? (
        <ErrorState error={tablesQ.error} onRetry={() => void refresh()} title="Can't load the tables" />
      ) : (
        <FlatList<TableRow>
          key={`cols-${cols}`}
          data={rows}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={pulling} onRefresh={() => void refresh()} colors={[c.primary]} />}
          ListEmptyComponent={
            tables.length === 0
              ? <EmptyState icon="table" title="No tables yet" message="Ask the manager to add tables in the dashboard." />
              : <EmptyState icon="filter" title="No table matches" message="Try another state or area." action={{ title: "Clear filters", onPress: () => { setStatus(null); setZone(null); setQuery(""); } }} />
          }
          renderItem={({ item: row }) =>
            row.kind === "header" ? (
              <AreaHeader row={row} onToggle={() => toggleArea(row.label)} />
            ) : (
              <View style={{ flexDirection: "row", gap: 12 }}>
                {row.tables.map((t) => (
                  <View key={t.id} style={{ flex: 1 }}>
                    <TableCard table={t} session={sessionForTable(sessions, t.id)} now={now} selected={t.id === selectedId} onPress={onOpenTable} />
                  </View>
                ))}
                {Array.from({ length: cols - row.tables.length }, (_, i) => <View key={`pad-${i}`} style={{ flex: 1 }} />)}
              </View>
            )
          }
        />
      )}
      </View>
    </Screen>
  );
}

/** An area's heading: it opens and closes, and says how many tables are free / seated / waiting for the bill — even while closed. */
function AreaHeader({ row, onToggle }: { row: Extract<TableRow, { kind: "header" }>; onToggle: () => void }) {
  const { c } = useTheme();
  const sm: ZoneSummary = row.summary;
  const spoken = `${row.label}, ${row.count} ${row.count === 1 ? "table" : "tables"}: ${sm.free} free, ${sm.seated} seated${sm.billAsked ? `, ${sm.billAsked} asking for the bill` : ""}`;
  const part = (n: number, icon: "check-circle" | "chair" | "receipt" | "calendar", color: string) => (n > 0 ? <View key={icon} style={{ flexDirection: "row", alignItems: "center", gap: 3 }}><Icon name={icon} size={14} color={color} /><Text variant="label" style={{ color }}>{n}</Text></View> : null);
  return (
    <Pressable
      testID={`zone-header-${row.label}`}
      accessibilityRole="button"
      accessibilityLabel={spoken}
      accessibilityState={{ expanded: row.expanded }}
      onPress={onToggle}
      android_ripple={{ color: "rgba(0,0,0,0.08)" }}
      style={{ minHeight: 48, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, borderRadius: 12, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}
    >
      <Icon name={row.expanded ? "chevron-down" : "chevron-right"} size={20} color={c.primaryText} />
      <IconTile icon="pin" size={28} />
      <Text variant="subheading" style={{ flex: 1 }} numberOfLines={1}>{row.label}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        {part(sm.free, "check-circle", c.success)}
        {part(sm.seated, "chair", c.info)}
        {part(sm.billAsked, "receipt", c.warning)}
        {part(sm.reserved, "calendar", c.muted)}
      </View>
    </Pressable>
  );
}
