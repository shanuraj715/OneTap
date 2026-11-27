import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { rangeOfScope, useScope } from "@/data/scope";
import { useOptions } from "@/data/queries";
import { rangeLabel } from "@/lib/dates";
import { Screen, ScopeBar, Segmented } from "@/ui";
import { CashTab } from "./money/Cash";
import { ExpensesTab } from "./money/Expenses";
import { GstTab } from "./money/Gst";
import { PnlTab } from "./money/Pnl";

type Tab = "pnl" | "expenses" | "gst" | "cash";
const TABS: { value: Tab; label: string }[] = [{ value: "pnl", label: "Profit & loss" }, { value: "expenses", label: "Expenses" }, { value: "gst", label: "GST" }, { value: "cash", label: "Cash" }];

/** Money: the profit and loss, the bills paid, the GST collected and the till — all for the chosen period and outlets. */
export function Money() {
  const options = useOptions();
  const qc = useQueryClient();
  const range = rangeOfScope(useScope());
  const [tab, setTab] = useState<Tab>("pnl");
  return (
    <Screen title="Money" subtitle={rangeLabel(range)} onRefresh={() => void qc.invalidateQueries({ queryKey: ["report"] })} testID="screen-money">
      <ScopeBar outlets={options.data?.outlets ?? []} />
      <Segmented testID="money-tab" value={tab} onChange={setTab} options={TABS} />
      {tab === "pnl" ? <PnlTab /> : tab === "expenses" ? <ExpensesTab /> : tab === "gst" ? <GstTab /> : <CashTab />}
    </Screen>
  );
}
