import { memo } from "react";
import { View } from "react-native";
import type { Session, Table } from "@/api/schemas";
import { STATUS_ICON, STATUS_LABEL, STATUS_TONE, summarizeTable } from "@/features/tables";
import { Badge, Card, Icon, Text, useTheme } from "@/ui";

/** One table on the board: its number and seats, its state, and — when people are seated — who, for how long, and what is owed. */
/** (memoised: the board refreshes every few seconds, and only the cards whose table or party changed are redrawn) */
export const TableCard = memo(function TableCard({ table, session, now, selected, onPress }: { table: Table; session?: Session; now: number; selected?: boolean; onPress: (tableId: string) => void }) {
  const { c } = useTheme();
  const s = summarizeTable(table, session, now);
  const tone = STATUS_TONE[table.status];
  const stripe = { ok: c.success, info: c.info, warn: c.warning, danger: c.danger, neutral: c.border }[tone];
  return (
    <Card testID={`table-${table.number}`} label={s.spoken} onPress={() => onPress(table.id)} selected={selected} style={{ padding: 0, overflow: "hidden", minHeight: 124 }}>
      <View style={{ height: 5, backgroundColor: stripe }} />
      <View style={{ padding: 12, gap: 6, flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
          <Text variant="heading" numberOfLines={1} style={{ flexShrink: 1 }}>{table.number}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Icon name="chair" size={15} color={c.muted} />
            <Text variant="caption" tone="muted">{table.seats}</Text>
          </View>
        </View>
        <Badge label={STATUS_LABEL[table.status]} tone={tone} icon={STATUS_ICON[table.status]} />
        {s.who ? (
          <View style={{ gap: 3, marginTop: 2 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <Icon name="user" size={14} color={c.muted} />
              <Text variant="label" numberOfLines={1} style={{ flexShrink: 1 }}>{s.who}</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <Icon name="clock" size={13} color={c.muted} />
              <Text variant="caption" tone="muted">{s.since}</Text>
            </View>
            {s.money ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <Icon name={s.moneyTone === "ok" ? "check-circle" : "wallet"} size={14} color={s.moneyTone === "ok" ? c.success : c.warning} />
                <Text variant="label" tone={s.moneyTone === "ok" ? "success" : "warning"}>{s.money}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </Card>
  );
});
