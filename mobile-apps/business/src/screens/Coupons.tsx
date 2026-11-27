import { useState } from "react";
import { View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi, useMe } from "@/runtime";
import { can } from "@/lib/access";
import { rangeOfScope, useScope } from "@/data/scope";
import { useOptions, useOutletPick, useReport } from "@/data/queries";
import { useAction } from "@/data/useAction";
import { prettyDay, rangeLabel } from "@/lib/dates";
import { count, money, rupees, share } from "@/lib/format";
import { AppSwitch, Async, Empty, ErrorState, Glass, Grid, KpiTile, LoadingCards, OutletPick, Pill, RankedBars, Row, Screen, ScopeBar, Section, Segmented, Text } from "@/ui";

type Tab = "usage" | "manage";
const offerText = (c: { discountType: string; value: number; maxDiscount: number; minOrderValue: number }) => {
  const what = c.discountType === "percent" ? `${c.value}% off` : c.discountType === "flat" ? `${money(c.value)} off` : c.discountType === "bogo" ? "Buy one, get one" : String(c.discountType);
  return [what, c.maxDiscount ? `up to ${money(c.maxDiscount)}` : "", c.minOrderValue ? `on ${money(c.minOrderValue)}+` : ""].filter(Boolean).join(" ");
};

/** Coupons: how much each code was used, what it cost and what it brought in — and a switch to turn each outlet's coupons on or off. */
export function Coupons() {
  const options = useOptions();
  const qc = useQueryClient();
  const range = rangeOfScope(useScope());
  const [tab, setTab] = useState<Tab>("usage");
  return (
    <Screen title="Coupons" subtitle={tab === "usage" ? rangeLabel(range) : "Turn coupons on or off"} onRefresh={() => void qc.invalidateQueries({ queryKey: ["report"] }).then(() => qc.invalidateQueries({ queryKey: ["store-coupons"] }))} testID="screen-coupons">
      <Segmented testID="coupons-tab" value={tab} onChange={setTab} options={[{ value: "usage", label: "Usage" }, { value: "manage", label: "Your coupons" }]} />
      {tab === "usage" ? <Usage outlets={options.data?.outlets ?? []} /> : <Manage outlets={options.data?.outlets ?? []} />}
    </Screen>
  );
}

function Usage({ outlets }: { outlets: { id: string; name: string; title: string }[] }) {
  const q = useReport("coupons", (api, s) => api.coupons(s));
  return (
    <>
      <ScopeBar outlets={outlets} />
      <Async q={q} lines={2}>
        {(d) => !d.enabled ? <Empty icon="tag" title="Coupons aren't in your plan" message="Ask Rasoi Pulse to switch them on." /> : d.totals.uses === 0 && d.unused.length === 0 ? <Empty icon="tag" title="No coupons used in this period" /> : (
          <>
            <Grid min={150}>
              <KpiTile testID="cp-uses" icon="tag" label="Times used" value={count(d.totals.uses)} delta={d.totals.usesChange} sub={`${share(d.totals.shareOfOrders)} of orders`} />
              <KpiTile testID="cp-discount" icon="percent" label="Given away" value={rupees(d.totals.discount)} delta={d.totals.discountChange} invert />
              <KpiTile testID="cp-sales" icon="rupee" label="Sales with a coupon" value={rupees(d.totals.sales)} />
              <KpiTile testID="cp-codes" icon="receipt" label="Codes used" value={count(d.totals.codes)} />
            </Grid>
            <Section title="Does a coupon make people spend more?" hint="Average order with and without a coupon" icon="lightbulb">
              <Glass testID="cp-compare"><RankedBars rows={[{ label: "With a coupon", value: d.totals.avgOrderWithCoupon }, { label: "Without", value: d.totals.avgOrderWithoutCoupon }]} format={rupees} /></Glass>
            </Section>
            <Section title="Each code">
              <View style={{ gap: 10 }}>
                {d.coupons.map((c, i) => (
                  <Row key={c.code} index={i} testID={`coupon-${c.code}`} icon="tag" title={c.code} subtitle={`${count(c.uses)} uses · ${count(c.customers)} customers · ${rupees(c.discount)} given · ${rupees(c.sales)} sales${c.lastUsed ? ` · last ${prettyDay(c.lastUsed.slice(0, 10))}` : ""}`}
                    right={<View style={{ alignItems: "flex-end", gap: 4 }}><Text variant="subheading">{count(c.uses)}</Text>{c.change !== null ? <Pill tone={c.change >= 0 ? "ok" : "danger"}>{`${c.change > 0 ? "+" : c.change < 0 ? "−" : ""}${Math.abs(c.change)}%`}</Pill> : null}{!c.active ? <Pill tone="warn">Off</Pill> : null}</View>} />
                ))}
              </View>
            </Section>
            {d.unused.length ? (
              <Section title="Never used in this period" hint="Think about telling customers about these" icon="alert">
                <View style={{ gap: 10 }}>{d.unused.map((u, i) => <Row key={u.code} index={i} testID={`unused-${u.code}`} icon="tag" title={u.code} subtitle={`${u.description || "No description"}${u.validUntil ? ` · until ${prettyDay(u.validUntil.slice(0, 10))}` : ""}`} />)}</View>
              </Section>
            ) : null}
            {d.perOutlet.length > 1 ? <Section title="By outlet"><Glass><RankedBars rows={d.perOutlet.map((o) => ({ id: o.id, label: o.name, value: o.uses, note: rupees(o.discount) }))} format={count} /></Glass></Section> : null}
          </>
        )}
      </Async>
    </>
  );
}

function Manage({ outlets }: { outlets: { id: string; name: string; title: string }[] }) {
  const api = useApi();
  const me = useMe();
  const [outletId, setOutletId] = useOutletPick(outlets);
  const q = useQuery({ queryKey: ["store-coupons", outletId], queryFn: () => api.storeCoupons(outletId), enabled: Boolean(outletId) });
  const mayManage = can(me, "coupon:manage");
  const toggle = useAction((v: { id: string; active: boolean }) => api.setCouponActive(outletId, v.id, v.active), { done: (v) => (v.active ? "Coupon switched on." : "Coupon switched off."), invalidate: [["store-coupons"], ["report"]] });
  return (
    <>
      <OutletPick outlets={outlets} value={outletId} onChange={setOutletId} />
      {q.isLoading ? <LoadingCards n={3} /> : q.isError ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : (q.data?.coupons ?? []).length === 0 ? <Empty icon="tag" title="No coupons here yet" message="Create coupons on the web dashboard; they show here." /> : (
        <View style={{ gap: 10 }}>
          {(q.data?.coupons ?? []).map((c, i) => (
            <Row key={c.id} index={i} testID={`store-coupon-${c.id}`} icon="tag" title={c.code} subtitle={`${offerText(c)}${c.description ? `\n${c.description}` : ""}\nused ${count(c.redemptionCount)}${c.maxRedemptions ? ` of ${count(c.maxRedemptions)}` : ""} times${c.validUntil ? ` · until ${prettyDay(c.validUntil.slice(0, 10))}` : ""}`}
              right={<AppSwitch value={c.active} disabled={!mayManage || toggle.isPending} onValueChange={(active) => toggle.mutate({ id: c.id, active })} accessibilityLabel={`${c.code} is ${c.active ? "on" : "off"}`} testID={`store-coupon-switch-${c.id}`} />} />
          ))}
          {!mayManage ? <Text variant="caption" tone="muted">Only the owner and managers can switch coupons on or off.</Text> : null}
        </View>
      )}
    </>
  );
}
