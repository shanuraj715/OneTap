import { useState } from "react";
import { View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useApi } from "@/runtime";
import { dateTime } from "@/lib/format";
import { Button, Empty, ErrorState, Grid, LoadingCards, Pill, Row, Screen, Segmented, Text } from "@/ui";

/** Client requirement forms: a draft while the meeting goes on, published as a real store when the client says yes. */
export function Onboarding() {
  const api = useApi();
  const [status, setStatus] = useState<"all" | "draft" | "published">("all");
  const q = useQuery({ queryKey: ["onboarding"], queryFn: () => api.onboardingList() });
  const all = q.data?.forms ?? [];
  const forms = all.filter((f) => status === "all" || f.status === status);
  return (
    <Screen title="Onboarding" subtitle="Take a new client's requirements, then publish them as a store." onRefresh={() => void q.refetch()} refreshing={q.isFetching && !q.isLoading} testID="screen-onboarding"
      right={<Button size="sm" icon="plus" title="New form" onPress={() => router.push("/onboarding/new")} testID="new-form" />}>
      <Segmented testID="onboarding-filter" value={status} onChange={setStatus} options={[{ value: "all", label: "All", count: all.length }, { value: "draft", label: "Drafts", count: all.filter((f) => f.status === "draft").length }, { value: "published", label: "Published", count: all.filter((f) => f.status === "published").length }]} />
      {q.isLoading ? <LoadingCards n={3} /> : q.isError ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : !forms.length ? (
        <Empty icon="onboarding" title={all.length ? "Nothing here" : "No forms yet"} message={all.length ? "Try another filter." : "Start one when you sit down with a client."} action={!all.length ? <Button title="New form" icon="plus" onPress={() => router.push("/onboarding/new")} /> : undefined} />
      ) : (
        <Grid min={330}>{forms.map((f, i) => (
          <Row key={f.id} index={i} icon="onboarding" title={f.storeName} testID={`form-${f.storeName}`} onPress={() => router.push(`/onboarding/${f.id}`)}
            subtitle={[f.planName || "No plan yet", `${f.outlets} outlet${f.outlets === 1 ? "" : "s"}`, f.repName ? `by ${f.repName}` : "", `updated ${dateTime(f.updatedAt)}`].filter(Boolean).join(" · ")}
            right={<View style={{ alignItems: "flex-end", gap: 5 }}><Pill tone={f.status === "published" ? "ok" : "warn"}>{f.status === "published" ? "Published" : "Draft"}</Pill>{f.status === "published" ? <Text variant="caption" tone="muted">{dateTime(f.publishedAt)}</Text> : null}</View>} />
        ))}</Grid>
      )}
    </Screen>
  );
}
