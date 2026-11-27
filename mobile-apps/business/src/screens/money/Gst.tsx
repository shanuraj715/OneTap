import { View } from "react-native";
import { bucketLabel, prettyDay } from "@/lib/dates";
import { count, rupees, rupeesShort } from "@/lib/format";
import { useReport } from "@/data/queries";
import { Async, BarChart, Empty, Glass, Grid, KpiTile, Row, Section, Text, useTheme } from "@/ui";
import { thin } from "../Sales";

/** The GST collected on the bills, split into CGST and SGST, by day — what the accountant needs for the return. */
export function GstTab() {
  const { c } = useTheme();
  const q = useReport("gst", (api, s) => api.gst(s));
  return (
    <Async q={q} lines={2}>
      {(d) => d.totals.orders === 0 ? <Empty icon="percent" title="No bills in this period" message="GST shows here once there are orders." /> : (
        <>
          <Grid min={150}>
            <KpiTile testID="gst-taxable" icon="rupee" label="Sales without GST" value={rupees(d.totals.taxable)} sub={`${count(d.totals.orders)} orders`} />
            <KpiTile testID="gst-cgst" icon="percent" label="CGST" value={rupees(d.totals.cgst)} />
            <KpiTile testID="gst-sgst" icon="percent" label="SGST" value={rupees(d.totals.sgst)} />
            <KpiTile testID="gst-tax" icon="receipt" label="GST in all" value={rupees(d.totals.tax)} />
            <KpiTile testID="gst-service" icon="bag" label="Service charge" value={rupees(d.totals.service)} />
            <KpiTile testID="gst-total" icon="wallet" label="Customers paid" value={rupees(d.totals.total)} />
          </Grid>
          <Section title="GST by day">
            <Glass><BarChart testID="chart-gst" color={c.chart[2]} format={rupeesShort} data={thin(d.days.map((x) => bucketLabel(x.day, "day"))).map((label, i) => ({ label, value: d.days[i]!.tax }))} /></Glass>
          </Section>
          <Section title="Day by day">
            <View style={{ gap: 10 }}>
              {[...d.days].reverse().map((x, i) => <Row key={x.day} index={i} testID={`gst-day-${x.day}`} icon="calendar" title={prettyDay(x.day)} subtitle={`${count(x.orders)} orders · sales ${rupees(x.taxable)} · CGST ${rupees(x.cgst)} · SGST ${rupees(x.sgst)}`} right={<Text variant="subheading">{rupees(x.tax)}</Text>} />)}
            </View>
          </Section>
        </>
      )}
    </Async>
  );
}
