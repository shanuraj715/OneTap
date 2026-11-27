import { useState } from "react";
import { View } from "react-native";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/runtime";
import { useOptions, useOutletPick } from "@/data/queries";
import { prettyDay } from "@/lib/dates";
import { count, rupees } from "@/lib/format";
import { Button, Chips, Empty, ErrorState, Glass, LoadingCards, OutletPick, RankedBars, Row, Screen, Section, Text } from "@/ui";

const DAYS = [{ value: "7", label: "7 days" }, { value: "30", label: "30 days" }, { value: "90", label: "90 days" }, { value: "365", label: "A year" }];
const STARS = [{ value: "", label: "All stars" }, ...[5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: `${n} ★` })), { value: "comments", label: "With a comment" }];
const stars = (n: number) => "★".repeat(n) + "☆".repeat(Math.max(0, 5 - n));

/** Ratings: what customers gave their orders — the average, how many of each star, and every comment, newest first. */
export function Ratings() {
  const api = useApi();
  const qc = useQueryClient();
  const options = useOptions();
  const outlets = options.data?.outlets ?? [];
  const [outletId, setOutletId] = useOutletPick(outlets);
  const [days, setDays] = useState("30");
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
    <Screen title="Ratings" subtitle="What customers say about their orders" onRefresh={() => void qc.invalidateQueries({ queryKey: ["ratings"] })} testID="screen-ratings">
      <OutletPick outlets={outlets} value={outletId} onChange={setOutletId} />
      <Chips testID="ratings-days" value={days} onChange={setDays} options={DAYS} />
      {q.isLoading ? <LoadingCards n={2} /> : q.isError ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : first ? (
        <>
          {first.summary.count === 0 && !filter ? <Empty icon="star" title="No ratings in this time" message="Customers can rate an order after it is done." /> : (
            <>
              <Glass testID="ratings-summary">
                <View style={{ flexDirection: "row", gap: 16, alignItems: "center" }}>
                  <View style={{ alignItems: "center" }}><Text variant="hero" testID="ratings-average">{first.summary.average.toFixed(1)}</Text><Text variant="caption" tone="muted">{`out of 5 · ${count(first.summary.count)} ${first.summary.count === 1 ? "rating" : "ratings"}`}</Text></View>
                  <View style={{ flex: 1 }}><RankedBars rows={([5, 4, 3, 2, 1] as const).map((n) => ({ label: `${n} ★`, value: first.summary.byStars[String(n) as "1"] }))} format={count} /></View>
                </View>
              </Glass>
              <Chips testID="ratings-filter" value={filter} onChange={setFilter} options={STARS} />
              <Section title={filter ? "Matching ratings" : "Newest first"} hint={`${count(first.summary.withComments)} with a comment`}>
                {rows.length === 0 ? <Empty icon="star" title="Nothing matches" /> : (
                  <View style={{ gap: 10 }}>
                    {rows.map((r, i) => (
                      <Row key={r.id} index={i} testID={`rating-${r.id}`} icon="star" title={`${stars(r.rating)}  ${r.customerName || "Customer"}`}
                        subtitle={`${r.comment ? `“${r.comment}”\n` : ""}Order ${r.orderNumber || ""} · ${rupees(r.orderTotal)} · ${prettyDay(r.createdAt.slice(0, 10))}${r.tags.length ? `\n${r.tags.join(" · ")}` : ""}`} />
                    ))}
                    {q.hasNextPage ? <Button variant="glass" title="Show older ratings" loading={q.isFetchingNextPage} onPress={() => void q.fetchNextPage()} testID="ratings-more" /> : null}
                  </View>
                )}
              </Section>
            </>
          )}
        </>
      ) : null}
    </Screen>
  );
}
