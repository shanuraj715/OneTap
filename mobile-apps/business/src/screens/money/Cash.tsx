import { View } from "react-native";
import { count, rupees, rupeesShort } from "@/lib/format";
import { useReport } from "@/data/queries";
import { Async, Donut, Empty, Glass, Grid, KpiTile, Row, Section, Text } from "@/ui";

const NAMES: Record<string, string> = { cod: "Cash", razorpay: "Online", upi: "UPI", card: "Card", wallet: "Wallet", coins: "Coins" };
const nameOf = (id: string, label: string) => NAMES[id] ?? label;

/** The till for the chosen days: how much came in by each way of paying, what is still to be collected, and what was cancelled. */
export function CashTab() {
  const q = useReport("cash", (api, s) => api.cash(s));
  return (
    <Async q={q} lines={2}>
      {(d) => (
        <>
          <Grid min={160}>
            <KpiTile testID="cash-collected" icon="wallet" label="Collected" value={rupees(d.collected)} />
            <KpiTile testID="cash-pending" icon="clock" label="Still to collect" value={rupees(d.pending.amount)} sub={`${count(d.pending.orders)} ${d.pending.orders === 1 ? "order" : "orders"}`} />
            <KpiTile testID="cash-cancelled" icon="circleX" label="Cancelled" value={rupees(d.cancelled.amount)} sub={`${count(d.cancelled.orders)} ${d.cancelled.orders === 1 ? "order" : "orders"}`} />
          </Grid>
          {d.rows.length === 0 ? <Empty icon="wallet" title="No payments in this period" /> : (
            <>
              <Section title="How customers paid"><Glass><Donut testID="chart-cash" format={rupeesShort} centerBottom="collected" items={d.rows.map((r) => ({ label: nameOf(r.id, r.label), value: r.amount }))} /></Glass></Section>
              <Section title="By way of paying">
                <View style={{ gap: 10 }}>
                  {d.rows.map((r, i) => <Row key={r.id} index={i} testID={`cash-row-${r.id}`} icon="rupee" title={nameOf(r.id, r.label)} subtitle={`${count(r.orders)} orders${r.discount ? ` · ${rupees(r.discount)} off` : ""}`} right={<Text variant="subheading">{rupees(r.amount)}</Text>} />)}
                </View>
              </Section>
            </>
          )}
        </>
      )}
    </Async>
  );
}
