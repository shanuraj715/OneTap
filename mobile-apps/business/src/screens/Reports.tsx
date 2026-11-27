import { useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ExportRequest, ReportFormat } from "@/api/endpoints";
import { useApi } from "@/runtime";
import { useOptions } from "@/data/queries";
import { rangeOfScope, useScope, type ScopeState } from "@/data/scope";
import { usePnlPlan, type PnlMode, type PnlLineInput } from "@/data/pnlPlan";
import { madeReport, useReportHistory } from "@/data/reportHistory";
import { messageOf } from "@/data/useAction";
import { deleteSaved, saveBytes, shareSaved } from "@/lib/files";
import { prettyDay, rangeLabel } from "@/lib/dates";
import { bytes as sizeText } from "@/lib/format";
import { toasts } from "@/ui/toast-store";
import { Button, Chips, Empty, Glass, Icon, Row, Screen, ScopeBar, Section, Text, useTheme } from "@/ui";

const DEFAULT_SECTIONS = ["summary", "daily", "items", "channels", "payments", "gst"];
const MIME: Record<ReportFormat["id"], string> = { xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", pdf: "application/pdf", csv: "text/csv", json: "application/json" };
const ICON = { xlsx: "sheet", pdf: "file", csv: "sheet", json: "copy" } as const;

/** The request the server wants for the choices on this screen (exported so a test can check it without drawing the screen). */
export function buildExportRequest(i: {
  format: ReportFormat["id"]; scope: Pick<ScopeState, "period" | "custom" | "outlets">; sections: string[]; csvSection: string;
  foodCostPct: number; mode: PnlMode; lines: Pick<PnlLineInput, "label" | "monthly">[];
}): ExportRequest {
  const { from, to } = rangeOfScope(i.scope);
  const chosen = i.format === "csv" ? [i.csvSection] : i.sections;
  const wantsPnl = chosen.includes("pnl");
  return {
    format: i.format, from, to, outletIds: i.scope.outlets, sections: i.format === "csv" ? [] : i.sections, section: i.csvSection,
    pnl: wantsPnl ? { foodCostPct: i.foodCostPct, mode: i.mode, expenses: i.mode === "monthly" ? i.lines.map((l) => ({ label: l.label, monthly: l.monthly })) : [] } : null,
  };
}

/** Reports: choose the period, the outlets, the file (Excel, PDF, CSV, JSON) and what goes in it — then download it and share it. */
export function Reports() {
  const { c } = useTheme();
  const api = useApi();
  const qc = useQueryClient();
  const options = useOptions();
  const o = options.data;
  const scope = useScope();
  const plan = usePnlPlan();
  const history = useReportHistory();
  const [format, setFormat] = useState<ReportFormat["id"]>("xlsx");
  const [picked, setPicked] = useState<string[] | null>(null);
  const [csvSection, setCsvSection] = useState("daily");

  useEffect(() => { void useReportHistory.getState().hydrate(); }, []); // the list of recent reports is read from the phone once, when the screen opens

  const sections = useMemo(() => (o?.sections ?? []).filter((s) => !s.finance || o?.canFinance), [o]);
  const chosen = picked ?? DEFAULT_SECTIONS.filter((id) => sections.some((s) => s.id === id));
  const csvOptions = sections.filter((s) => s.csv);
  const csvSectionOk = csvOptions.some((s) => s.id === csvSection) ? csvSection : csvOptions[0]?.id ?? "daily";
  const formatInfo = (o?.formats ?? []).find((f) => f.id === format);
  const nothing = format === "csv" ? !csvOptions.length : chosen.length === 0;
  const range = rangeOfScope(scope);

  const toggle = (id: string) => setPicked(chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id]);

  const make = useMutation({
    mutationFn: async () => {
      const body = buildExportRequest({ format, scope, sections: chosen, csvSection: csvSectionOk, foodCostPct: plan.foodCostPct ?? o?.defaults.foodCostPct ?? 35, mode: plan.mode, lines: plan.lines });
      const file = await api.exportReport(body);
      const saved = await saveBytes(file.bytes, file.fileName);
      const mime = file.type && file.type !== "application/octet-stream" ? file.type.split(";")[0]! : MIME[format];
      const gone = history.add(madeReport({ name: saved.name, uri: saved.uri, mime, format, period: rangeLabel(range), size: saved.size }));
      gone.forEach((g) => deleteSaved(g.uri));
      const shared = await shareSaved(saved.uri, mime, saved.name).catch(() => false);
      return { shared };
    },
    onSuccess: ({ shared }) => { toasts.ok(shared ? "Report ready." : "Report saved in the app. This phone can't open a share sheet — find it under “Recent reports”."); },
    onError: (e) => toasts.error(messageOf(e)),
  });

  const again = useMutation({
    mutationFn: async (r: { uri: string; mime: string; name: string }) => { if (!(await shareSaved(r.uri, r.mime, r.name))) throw new Error("This phone can't open a share sheet."); },
    onError: (e) => toasts.error(messageOf(e)),
  });

  return (
    <Screen title="Reports" subtitle="Excel, PDF and more — to keep or send" onRefresh={() => void qc.invalidateQueries({ queryKey: ["options"] })} testID="screen-reports">
      <ScopeBar outlets={o?.outlets ?? []} />

      <Section title="Which file?" icon="file">
        <Chips testID="report-format" value={format} onChange={setFormat} options={(o?.formats ?? []).map((f) => ({ value: f.id, label: f.label }))} />
        {formatInfo ? <Text variant="caption" tone="muted" testID="report-format-help">{formatInfo.help}</Text> : null}
      </Section>

      {format === "csv" ? (
        <Section title="Which table?" hint="A CSV holds one table">
          <Chips testID="report-csv" value={csvSectionOk} onChange={setCsvSection} options={csvOptions.map((s) => ({ value: s.id, label: s.label }))} />
        </Section>
      ) : (
        <Section title="What goes in it?" hint={`${chosen.length} of ${sections.length} chosen`}
          action={<View style={{ flexDirection: "row", gap: 8 }}><Button size="sm" variant="glass" title="All" onPress={() => setPicked(sections.map((s) => s.id))} testID="report-all" /><Button size="sm" variant="glass" title="None" onPress={() => setPicked([])} testID="report-none" /></View>}>
          <Glass padding={6}>
            {sections.map((s) => {
              const on = chosen.includes(s.id);
              return (
                <Pressable key={s.id} onPress={() => toggle(s.id)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={s.label} testID={`report-section-${s.id}`}
                  style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, paddingHorizontal: 10 }}>
                  <View style={{ width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, borderColor: on ? c.primary : c.fieldBorder, backgroundColor: on ? c.primary : "transparent", alignItems: "center", justifyContent: "center" }}>{on ? <Icon name="check" size={14} color={c.onPrimary} /> : null}</View>
                  <Text style={{ flex: 1 }}>{s.label}</Text>
                </Pressable>
              );
            })}
          </Glass>
          {o && !o.canFinance ? <Text variant="caption" tone="muted">Profit & loss, expenses and the other money sections are left out: {"your role doesn't include them."}</Text> : null}
        </Section>
      )}

      <Button title={make.isPending ? "Preparing…" : `Download ${formatInfo?.label ?? "report"}`} icon={ICON[format]} loading={make.isPending} disabled={nothing || !o} onPress={() => make.mutate()} testID="report-make" />
      <Text variant="caption" tone="muted" style={{ textAlign: "center" }}>{rangeLabel(range)} · {scope.outlets.length ? `${scope.outlets.length} ${scope.outlets.length === 1 ? "outlet" : "outlets"}` : "all outlets"}</Text>

      <Section title="Recent reports" hint="Kept on this phone so you can send them again" icon="clock">
        {history.items.length ? (
          <View style={{ gap: 10 }}>
            {history.items.map((r, i) => (
              <Row key={r.id} index={i} testID={`report-${r.id}`} icon={ICON[r.format as ReportFormat["id"]] ?? "file"} title={r.name} subtitle={`${r.period} · ${prettyDay(r.at.slice(0, 10))} · ${sizeText(r.size)}`}
                right={<View style={{ flexDirection: "row", gap: 6 }}><Button size="sm" variant="glass" icon="share" title="Send" onPress={() => again.mutate(r)} testID={`report-share-${r.id}`} /><Button size="sm" variant="glass" icon="trash" title="" accessibilityLabel={`Remove ${r.name}`} onPress={() => { const g = history.remove(r.id); if (g) deleteSaved(g.uri); }} testID={`report-remove-${r.id}`} /></View>} />
            ))}
          </View>
        ) : <Empty icon="file" title="No reports yet" message="A report you download shows here, so you can send it again." />}
      </Section>
    </Screen>
  );
}
