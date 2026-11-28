import { useState } from "react";
import { View } from "react-native";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/runtime";
import { useOptions, useOutletPick } from "@/data/queries";
import { prettyDay } from "@/lib/dates";
import { count, rupees } from "@/lib/format";
import { Button, Chips, Empty, ErrorState, Glass, LoadingCards, OutletPick, RankedBars, Row, Screen, ScopeBar, Section, Segmented, Stars, Text } from "@/ui";
import { ByCustomer, ByDish, ByOutlet } from "./ratings/Views";

const DAYS = [{ value: "7", label: "7 days" }, { value: "30", label: "30 days" }, { value: "90", label: "90 days" }, { value: "365", label: "A year" }];
const STARS = [{ value: "", label: "All stars" }, ...[5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: `${n} stars` })), { value: "comments", label: "With a comment" }];
type Tab = "reviews" | "customers" | "outlets" | "dishes";
const TABS: { value: Tab; label: string }[] = [{ value: "reviews", label: "Reviews" }, { value: "customers", label: "By customer" }, { value: "outlets", label: "By outlet" }, { value: "dishes", label: "By dish" }];

/** Ratings: what customers gave their orders and their dishes — every review, by customer, by outlet and by dish. The stars are in the app's colour. */
export function Ratings() {
  const qc = useQueryClient();
  const options = useOptions();
  const outlets = options.data?.outlets ?? [];
  const [tab, setTab] = useState<Tab>("reviews");
  const [days, setDays] = useState("30");
  return (
    <Screen title="Ratings" subtitle="What customers say about their orders and dishes" onRefresh={() => void qc.invalidateQueries({ queryKey: ["ratings"] })} testID="screen-ratings">
      <Segmented testID="ratings-tab" value={tab} onChange={setTab} options={TABS} />
      <Chips testID="ratings-days" value={days} onChange={setDays} options={DAYS} />
      {tab === "reviews" ? <Reviews days={days} /> : (
        <>
          <ScopeBar outlets={outlets} showPeriod={false} />
          {tab === "customers" ? <ByCustomer days={Number(days)} /> : tab === "outlets" ? <ByOutlet days={Number(days)} /> : <ByDish days={Number(days)} />}
        </>
      )}
    </Screen>
  );
}

/** Every review of ONE outlet, newest first, with the dishes that were rated. */
function Reviews({ days }: { days: string }) {
  const api = useApi();
  const options = useOptions();
  const outlets = options.data?.outlets ?? [];
  const [outletId, setOutletId] = useOutletPick(outlets);
  const [filter, setFilter] = useState("");
  const q = useInfiniteQuery({
    queryKey: ["ratings", outletId, days, filter],
    enabled: Boolean(outletId),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => api.ratings(outletId, { days: Number(days), stars: /^[1-5]$/.test(filter) ? [Number(filter)] : undefined, withComment: filter === "comments", before: pageParam }),
    getNextPageParam: (last) => last.nextBefore,
  });
  const first = q.data?.pages[0];
  const rows = q.data?.pages.flatMap((p) => p.ratings) ?? [];
  return (
    <>
      <OutletPick outlets={outlets} value={outletId} onChange={setOutletId} />
      {q.isLoading ? <LoadingCards n={2} /> : q.isError ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : first ? (
        <>
          {first.summary.count === 0 && !filter ? <Empty icon="star" title="No ratings in this time" message="Customers can rate an order after it is done." /> : (
            <>
              <Glass testID="ratings-summary">
                <View style={{ flexDirection: "row", gap: 16, alignItems: "center" }}>
                  <View style={{ alignItems: "center", gap: 4 }}>
                    <Text variant="hero" testID="ratings-average">{first.summary.average.toFixed(1)}</Text>
                    <Stars value={first.summary.average} size={16} />
                    <Text variant="caption" tone="muted">{`${count(first.summary.count)} ${first.summary.count === 1 ? "rating" : "ratings"}`}</Text>
                  </View>
                  <View style={{ flex: 1 }}><RankedBars rows={([5, 4, 3, 2, 1] as const).map((n) => ({ label: `${n} stars`, value: first.summary.byStars[String(n) as "1"] }))} format={count} /></View>
                </View>
              </Glass>
              <Chips testID="ratings-filter" value={filter} onChange={setFilter} options={STARS} />
              <Section title={filter ? "Matching ratings" : "Newest first"} hint={`${count(first.summary.withComments)} with a comment`}>
                {rows.length === 0 ? <Empty icon="star" title="Nothing matches" /> : (
                  <View style={{ gap: 10 }}>
                    {rows.map((r, i) => (
                      <Row key={r.id} index={i} testID={`rating-${r.id}`} icon="person" title={r.customerName || "Customer"}
                        right={<Stars value={r.rating} size={15} />}
                        subtitle={`${r.comment ? `“${r.comment}”\n` : ""}Order ${r.orderNumber || ""} · ${rupees(r.orderTotal)} · ${prettyDay(r.createdAt.slice(0, 10))}${r.tags.length ? `\n${r.tags.join(" · ")}` : ""}${(r.itemRatings ?? []).map((d) => `\n${d.name} ${d.rating}★${d.comment ? ` “${d.comment}”` : ""}`).join("")}`} />
                    ))}
                    {q.hasNextPage ? <Button variant="glass" title="Show older ratings" loading={q.isFetchingNextPage} onPress={() => void q.fetchNextPage()} testID="ratings-more" /> : null}
                  </View>
                )}
              </Section>
            </>
          )}
        </>
      ) : null}
    </>
  );
}
