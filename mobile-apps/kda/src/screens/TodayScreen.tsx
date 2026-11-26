import { View } from "react-native";
import { useSummary } from "@/data/hooks";
import { Badge, Card, EmptyState, ErrorState, Icon, Screen, ScreenTitle, SectionTitle, Skeleton, Text, useTheme, type IconName } from "@/ui";

function Figure({ icon, label, value, hint, tone }: { icon: IconName; label: string; value: string; hint?: string; tone?: "danger" }) {
  const { c } = useTheme();
  return (
    <Card style={{ flex: 1, minWidth: 140, gap: 4 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Icon name={icon} size={16} color={c.muted} />
        <Text variant="caption" tone="muted">{label}</Text>
      </View>
      <Text variant="title" style={tone === "danger" ? { color: c.danger } : undefined}>{value}</Text>
      {hint ? <Text variant="caption" tone="muted">{hint}</Text> : null}
    </Card>
  );
}

/** The kitchen manager's page: what is on the board right now, and how today went (speed, late orders, the dishes that sold most). */
export function TodayScreen() {
  const summary = useSummary();
  const s = summary.data;
  return (
    <Screen scroll onRefresh={() => void summary.refetch()} refreshing={summary.isRefetching && !summary.isLoading}>
      <ScreenTitle icon="grid" title="Today" />
      {summary.isLoading ? (
        <View style={{ gap: 10 }}><Skeleton height={90} radius={14} /><Skeleton height={90} radius={14} /></View>
      ) : summary.error && !s ? (
        <ErrorState error={summary.error} onRetry={() => void summary.refetch()} title="Can't load today's numbers" />
      ) : s ? (
        <>
          <SectionTitle icon="flame" title="Right now" />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            <Figure icon="bell" label="New" value={String(s.now.new)} />
            <Figure icon="pot" label="Preparing" value={String(s.now.preparing)} />
            <Figure icon="check-circle" label="Ready" value={String(s.now.ready)} />
          </View>

          <SectionTitle icon="clock" title="Today so far" />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            <Figure icon="check" label="Orders made" value={String(s.today.ready)} />
            <Figure icon="clock" label="Average time" value={s.today.averageMinutes === null ? "—" : `${s.today.averageMinutes} min`} hint={`Late after ${s.settings.lateAfterMinutes} min`} />
            <Figure icon="alert" label="Late orders" value={String(s.today.lateCount)} tone={s.today.lateCount ? "danger" : undefined} />
            {s.today.slowest ? <Figure icon="history" label="Slowest" value={`${s.today.slowest.minutes} min`} hint={`Order #${s.today.slowest.orderNumber}`} /> : null}
          </View>

          <SectionTitle icon="star" title="Most made today" right={s.today.topDishes.length ? <Badge label={`${s.today.topDishes.length} dishes`} tone="info" /> : null} />
          {s.today.topDishes.length ? (
            <Card style={{ gap: 10 }} testID="top-dishes">
              {s.today.topDishes.map((d, i) => (
                <View key={d.name} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <Text tone="muted" style={{ width: 22 }}>{i + 1}</Text>
                  <Text style={{ flex: 1 }}>{d.name}</Text>
                  <Text variant="subheading">{d.quantity}×</Text>
                </View>
              ))}
            </Card>
          ) : (
            <EmptyState icon="utensils" title="Nothing made yet today" message="The dishes you finish show here, most made first." />
          )}
        </>
      ) : null}
    </Screen>
  );
}
