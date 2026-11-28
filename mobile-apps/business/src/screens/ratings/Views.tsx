import { useState } from "react";
import { View } from "react-native";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type { DishRating, RatingTotals } from "@/api/endpoints";
import { useApi } from "@/runtime";
import { useOutletsParam } from "@/data/queries";
import { prettyDay } from "@/lib/dates";
import { count } from "@/lib/format";
import { Async, Button, Chips, Empty, ErrorState, Glass, LoadingCards, Pill, RankedBars, Row, SearchField, Section, Sheet, Stars, Text } from "@/ui";

const stars5 = [5, 4, 3, 2, 1] as const;
const split = (t: Pick<RatingTotals, "byStars">) => stars5.map((n) => ({ label: `${n} stars`, value: t.byStars[String(n) as "1"] }));

/** All the outlets together, then each outlet: its average (in stars), how many ratings, how many gave 4–5 stars. */
export function ByOutlet({ days }: { days: number }) {
  const api = useApi();
  const outlets = useOutletsParam();
  const q = useQuery({ queryKey: ["ratings", "by-outlet", outlets, days], queryFn: () => api.ratingsByOutlet(outlets, days) });
  return (
    <Async q={q} lines={2}>
      {(d) => (
        <>
          <Glass testID="ro-total">
            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                <Text variant="hero" testID="ro-total-average">{d.total.count ? d.total.average.toFixed(1) : "–"}</Text>
                <View style={{ gap: 4 }}><Stars value={d.total.average} size={20} /><Text variant="caption" tone="muted">{`${count(d.total.count)} ${d.total.count === 1 ? "rating" : "ratings"} · ${count(d.total.withComments)} with a comment · ${count(d.total.dishRatings)} dish ratings`}</Text></View>
              </View>
              <RankedBars rows={split(d.total)} format={count} />
            </View>
          </Glass>
          <Section title="Each outlet">
            <View style={{ gap: 10 }}>
              {d.outlets.map((o, i) => (
                <Row key={o.id} index={i} testID={`ro-${o.id}`} icon="outlet" title={o.title} subtitle={o.count ? `${count(o.count)} ${o.count === 1 ? "rating" : "ratings"} · ${o.happyShare}% gave 4–5 stars · ${count(o.dishRatings)} dish ratings` : "No ratings yet"}
                  right={<View style={{ alignItems: "flex-end", gap: 4 }}><Text variant="subheading">{o.count ? o.average.toFixed(1) : "–"}</Text><Stars value={o.average} size={13} /></View>} />
              ))}
            </View>
          </Section>
        </>
      )}
    </Async>
  );
}

const CSORTS = [{ value: "recent", label: "Newest" }, { value: "lowest", label: "Lowest average" }, { value: "highest", label: "Highest average" }, { value: "most", label: "Most ratings" }];

/** Who rated: each customer's average, how often, their lowest, and what they said last. Search by name or phone; "Show more" pages on. */
export function ByCustomer({ days }: { days: number }) {
  const api = useApi();
  const outlets = useOutletsParam();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("recent");
  const q = useInfiniteQuery({
    queryKey: ["ratings", "by-customer", outlets, days, search.trim(), sort],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => api.ratingsByCustomer(outlets, days, { search: search.trim(), sort, page: pageParam }),
    getNextPageParam: (last) => (last.page < last.pages ? last.page + 1 : undefined),
  });
  const rows = q.data?.pages.flatMap((p) => p.customers) ?? [];
  const total = q.data?.pages[0]?.total ?? 0;
  return (
    <>
      <SearchField value={search} onChange={setSearch} placeholder="Find by name or phone" testID="rc-search" />
      <Chips testID="rc-sort" value={sort} onChange={setSort} options={CSORTS} />
      {q.isLoading ? <LoadingCards n={3} /> : q.isError ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : rows.length === 0 ? (
        <Empty icon="user" title={search ? "Nobody matches" : "No ratings in this time"} message={search ? "Try another name or number." : "Customers who rate an order show up here."} />
      ) : (
        <Section title={`${count(total)} ${total === 1 ? "customer" : "customers"}`}>
          <View style={{ gap: 10 }}>
            {rows.map((c, i) => (
              <Row key={c.id} index={i} testID={`rc-${c.id}`} icon="person" title={c.name} subtitle={`${c.phone}\n${count(c.count)} ${c.count === 1 ? "rating" : "ratings"} · lowest ${c.lowest}★ · last ${prettyDay(c.last.slice(0, 10))}${c.lastComment ? `\n“${c.lastComment}”` : ""}`}
                right={<View style={{ alignItems: "flex-end", gap: 4 }}><Text variant="subheading">{c.average.toFixed(1)}</Text><Stars value={c.average} size={13} /></View>} />
            ))}
            {q.hasNextPage ? <Button variant="glass" title="Show more" loading={q.isFetchingNextPage} onPress={() => void q.fetchNextPage()} testID="rc-more" /> : null}
          </View>
        </Section>
      )}
    </>
  );
}

const DSORTS = [{ value: "most", label: "Most rated" }, { value: "best", label: "Best rated" }, { value: "worst", label: "Worst rated" }];

/** Dish by dish — the same dish at several outlets is one row. Touch a dish to read what was said about it. */
export function ByDish({ days }: { days: number }) {
  const api = useApi();
  const outlets = useOutletsParam();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("most");
  const [open, setOpen] = useState<DishRating | null>(null);
  const q = useQuery({ queryKey: ["ratings", "by-dish", outlets, days, search.trim(), sort], queryFn: () => api.ratingsByDish(outlets, days, { search: search.trim(), sort }) });
  return (
    <>
      <SearchField value={search} onChange={setSearch} placeholder="Find a dish" testID="rd-search" />
      <Chips testID="rd-sort" value={sort} onChange={setSort} options={DSORTS} />
      {q.isLoading ? <LoadingCards n={3} /> : q.isError ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : (q.data?.items ?? []).length === 0 ? (
        <Empty icon="utensils" title={search ? "No dish by that name" : "No dishes rated in this time"} message={search ? "Try another name." : "When customers rate the dishes of an order, they are grouped here."} />
      ) : (
        <View style={{ gap: 10 }}>
          {q.data!.items.map((d, i) => (
            <Row key={d.key} index={i} testID={`rd-${d.key}`} icon="utensils" title={d.name} onPress={() => setOpen(d)}
              subtitle={`${count(d.count)} ${d.count === 1 ? "rating" : "ratings"}${d.withNotes ? ` · ${d.withNotes} with a note` : ""}${d.outlets.length > 1 ? `\n${d.outlets.map((o) => `${o.name} ${o.average.toFixed(1)} (${o.count})`).join(" · ")}` : ""}`}
              right={<View style={{ alignItems: "flex-end", gap: 4 }}><Text variant="subheading">{d.average.toFixed(1)}</Text><Stars value={d.average} size={13} /></View>} />
          ))}
        </View>
      )}
      {open ? <DishSheet dish={open} days={days} onClose={() => setOpen(null)} /> : null}
    </>
  );
}

function DishSheet({ dish, days, onClose }: { dish: DishRating; days: number; onClose: () => void }) {
  const api = useApi();
  const outlets = useOutletsParam();
  const q = useQuery({ queryKey: ["ratings", "dish-reviews", dish.key, outlets, days], queryFn: () => api.dishReviews(dish.key, outlets, days) });
  return (
    <Sheet visible onClose={onClose} title={dish.name} testID="dish-sheet">
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><Stars value={dish.average} size={20} /><Text variant="subheading">{dish.average.toFixed(1)}</Text><Text variant="caption" tone="muted">{`from ${count(dish.count)}`}</Text></View>
      <RankedBars rows={split(dish)} format={count} />
      {q.isLoading ? <LoadingCards n={1} /> : q.isError ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : (q.data?.reviews ?? []).length === 0 ? <Text tone="muted">No reviews yet.</Text> : (
        <View style={{ gap: 10 }}>
          {q.data!.reviews.map((r, i) => (
            <Glass key={`${r.id}-${i}`} testID={`dish-review-${i}`}>
              <View style={{ gap: 4 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}><Stars value={r.dishRating} size={14} /><Text variant="label">{r.customerName}</Text></View>
                {r.dishNote ? <Text>{`“${r.dishNote}”`}</Text> : null}
                <Text variant="caption" tone="muted">{`Order ${r.orderNumber} · ${r.outlet} · ${prettyDay(r.createdAt.slice(0, 10))}`}</Text>
                <Pill tone="neutral">{`The whole order: ${r.orderRating}★${r.orderComment ? ` — “${r.orderComment}”` : ""}`}</Pill>
              </View>
            </Glass>
          ))}
        </View>
      )}
    </Sheet>
  );
}
