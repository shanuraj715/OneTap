import { useState } from "react";
import type { CSSProperties } from "react";
import { TARGETS, type PrintTarget } from "@onetap/config-schema";
import { FileText, ListChecks, MonitorSmartphone, Printer as PrinterIcon } from "lucide-react";
import { useAuth } from "../lib/useAuth";
import { useOutlet } from "../lib/useOutlet";
import { usePrintRunner } from "../lib/usePrintRunner";
import { usePrinters, usePrintJobs, useTemplates } from "../lib/usePrinting";
import { Button, Card, Checkbox, InfoHint, Note, PageHeader, Pill, Tabs, Toast } from "../ui";
import { JobQueue } from "./printing/JobQueue";
import { PrinterList } from "./printing/PrinterList";
import { TemplateEditor } from "./printing/TemplateEditor";

type Tab = "printers" | "templates" | "queue";

export function Printing() {
  const { outlet } = useOutlet();
  const { can } = useAuth();
  const canRead = can("printer:read");
  const canManage = can("printer:manage");
  const canPrint = can("print:job");

  const [tab, setTab] = useState<Tab>("printers");

  const printers = usePrinters(outlet, canRead);
  const templates = useTemplates(outlet, canRead);
  const jobs = usePrintJobs(outlet, canRead);
  const runner = usePrintRunner(outlet, canPrint);

  if (!canRead) {
    return (
      <>
        <PageHeader title="Printing" />
        <Card>Your role can&apos;t view printers.</Card>
      </>
    );
  }

  const openJobs = (jobs.data?.jobs ?? []).filter((j) => j.status === "queued" || j.status === "failed").length;

  return (
    <>
      <PageHeader
        title="Printing"
        icon={<PrinterIcon size={23} />}
        subtitle="Receipts, kitchen tickets, and where each one comes out."
      />

      <StationPanel runner={runner} canPrint={canPrint} />

      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "printers", label: "Printers", icon: <PrinterIcon size={14} />, count: printers.data?.printers.length },
          { id: "templates", label: "Templates", icon: <FileText size={14} /> },
          { id: "queue", label: "Queue", icon: <ListChecks size={14} />, count: openJobs },
        ]}
      />

      {!outlet ? (
        <Card>No outlet selected.</Card>
      ) : tab === "printers" ? (
        <PrinterList
          outlet={outlet}
          printers={printers.data?.printers ?? []}
          templates={templates.data?.templates ?? []}
          canManage={canManage}
        />
      ) : tab === "templates" ? (
        <TemplateEditor outlet={outlet} templates={templates.data?.templates ?? []} canManage={canManage} />
      ) : (
        <JobQueue outlet={outlet} canPrint={canPrint} />
      )}
    </>
  );
}

/* --------------------------------------------------------- print station */

/**
 * This browser as a print station.
 *
 * Jobs for a printer on the shop's own network, or one that goes through the OS
 * print dialog, cannot be pushed from the server — it has no route to them. A
 * browser sitting at the outlet does have that route, so this is where you say
 * "this computer is the one at the counter". Off by default, and remembered per
 * device, so the owner checking sales from home never starts firing tickets at
 * the shop.
 */
function StationPanel({
  runner,
  canPrint,
}: {
  runner: ReturnType<typeof usePrintRunner>;
  canPrint: boolean;
}) {
  const { settings, setEnabled, setTargets, busy, lastRun, lastError, runNow } = runner;

  if (!canPrint) return null;

  const toggle = (t: PrintTarget) =>
    setTargets(settings.targets.includes(t) ? settings.targets.filter((x) => x !== t) : [...settings.targets, t]);

  return (
    <Card
      title="This computer"
      icon={<MonitorSmartphone size={15} />}
      action={
        settings.enabled ? (
          <Pill tone={lastError ? "error" : "ok"}>{busy ? "Checking…" : lastError ? "Problem" : "Listening"}</Pill>
        ) : (
          <Pill>Off</Pill>
        )
      }
    >
      <Note icon={<MonitorSmartphone size={15} />}>
        Turn this on for the computer that sits <strong>at the outlet</strong>, next to the printers. It picks up jobs
        for printers on the local network and for the ordinary print dialog. Printers using a cloud service or the
        OneTap agent do not need this — the server sends to those directly.
      </Note>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
        <Checkbox
          checked={settings.enabled}
          onChange={setEnabled}
          label="Use this computer as a print station"
          info="While this is on and the page is open, this browser checks every few seconds for slips it can print. Close the tab and it stops — which is why the till computer should keep the admin open during service."
        />
        {settings.enabled ? (
          <Button variant="outline" onClick={runNow} disabled={busy} style={{ fontSize: 12.5, padding: "6px 12px" }}>
            {busy ? "Checking…" : "Check now"}
          </Button>
        ) : null}
      </div>

      {settings.enabled ? (
        <>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 12 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, display: "inline-flex", gap: 6, alignItems: "center" }}>
              Handle jobs for
              <InfoHint
                title="What this computer prints"
                text="Which kinds of printer this browser is responsible for. Leave both on unless you have a reason — for example turning off the print dialog on a screen nobody is watching, so those jobs wait for the till computer instead."
              />
            </span>
            {(["browser", "epos-lan"] as PrintTarget[]).map((t) => (
              <Checkbox key={t} checked={settings.targets.includes(t)} onChange={() => toggle(t)} label={TARGETS[t].label} />
            ))}
          </div>

          <div style={{ fontSize: 11.5, color: "var(--color-text-muted)", marginTop: 10 }}>
            Station id <code style={code}>{settings.clientId}</code>
            {lastRun ? ` · last checked ${lastRun.toLocaleTimeString()}` : ""}
          </div>
        </>
      ) : null}

      {lastError ? <Toast kind="error">{lastError}</Toast> : null}
    </Card>
  );
}

const code: CSSProperties = {
  fontFamily: "monospace",
  fontSize: 11,
  padding: "1px 5px",
  borderRadius: 4,
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
};
