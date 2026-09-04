import { useState } from "react";
import type { CSSProperties } from "react";
import {
  DOC_LABELS,
  JOB_STATUS_LABELS,
  PRINT_JOB_STATUSES,
  STATION_LABELS,
  TARGETS,
  type PrintJobStatus,
  type PrintJobView,
} from "@onetap/config-schema";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock,
  Loader2,
  Printer as PrinterIcon,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import type { Outlet } from "../../lib/api";
import { useCancelJob, usePrintJobs, useReprintJob, useRetryJob } from "../../lib/usePrinting";
import { Button, Card, Empty, Note, Pill, Toast } from "../../ui";

const STATUS_TONE: Record<PrintJobStatus, "ok" | "warn" | "error" | "info" | "neutral"> = {
  printed: "ok",
  printing: "info",
  queued: "warn",
  failed: "error",
  cancelled: "neutral",
};

const STATUS_ICON: Record<PrintJobStatus, typeof Clock> = {
  printed: CheckCircle2,
  printing: Loader2,
  queued: Clock,
  failed: AlertTriangle,
  cancelled: Ban,
};

export function JobQueue({ outlet, canPrint }: { outlet: Outlet; canPrint: boolean }) {
  const [filter, setFilter] = useState<PrintJobStatus | "">("");
  const jobs = usePrintJobs(outlet, true, filter || undefined);

  const retry = useRetryJob(outlet);
  const reprint = useReprintJob(outlet);
  const cancel = useCancelJob(outlet);
  const error = (retry.error ?? reprint.error ?? cancel.error) as Error | null;

  const list = jobs.data?.jobs ?? [];
  const failed = list.filter((j) => j.status === "failed").length;

  return (
    <>
      <Note icon={<PrinterIcon size={15} />}>
        Every slip this outlet has printed, and every one that failed. A job that fails is retried automatically five
        times with widening gaps — long enough for somebody to load paper. After that it waits here for
        <strong> Try again</strong>. Use <strong>Print again</strong> for a slip that printed but got lost or torn.
      </Note>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
        <FilterChip active={filter === ""} onClick={() => setFilter("")} label="All" />
        {PRINT_JOB_STATUSES.map((s) => (
          <FilterChip key={s} active={filter === s} onClick={() => setFilter(s)} label={JOB_STATUS_LABELS[s]} />
        ))}
        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--color-text-muted)", display: "inline-flex", gap: 6, alignItems: "center" }}>
          <RefreshCw size={12} className={jobs.isFetching ? "ot-spin" : undefined} />
          updates every 5s
        </span>
      </div>

      {failed > 0 && !filter ? (
        <div style={alertBar}>
          <AlertTriangle size={15} style={{ flexShrink: 0 }} />
          <span>
            <strong>{failed}</strong> job{failed === 1 ? "" : "s"} gave up after retrying. Check the printer, then press
            Try again.
          </span>
        </div>
      ) : null}

      {error ? <Toast kind="error">{error.message}</Toast> : null}

      <Card>
        {!list.length ? (
          <Empty icon={<PrinterIcon size={28} />} title="Nothing here yet">
            Jobs appear as orders are accepted, or when you press Test on a printer.
          </Empty>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {list.map((job) => (
              <JobRow
                key={job.id}
                job={job}
                canPrint={canPrint}
                onRetry={() => retry.mutate(job.id)}
                onReprint={() => reprint.mutate(job.id)}
                onCancel={() => cancel.mutate(job.id)}
                busy={
                  (retry.isPending && retry.variables === job.id) ||
                  (reprint.isPending && reprint.variables === job.id) ||
                  (cancel.isPending && cancel.variables === job.id)
                }
              />
            ))}
          </div>
        )}
      </Card>
    </>
  );
}

function JobRow({
  job,
  canPrint,
  onRetry,
  onReprint,
  onCancel,
  busy,
}: {
  job: PrintJobView;
  canPrint: boolean;
  onRetry: () => void;
  onReprint: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const Icon = STATUS_ICON[job.status];
  const waiting = job.status === "queued" || job.status === "printing";
  const retryAt = job.nextAttemptAt ? new Date(job.nextAttemptAt) : null;
  const retryPending = retryAt && retryAt.getTime() > Date.now();

  return (
    <div style={row}>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
          <Pill tone={STATUS_TONE[job.status]} icon={<Icon size={11} className={job.status === "printing" ? "ot-spin" : undefined} />}>
            {JOB_STATUS_LABELS[job.status]}
          </Pill>
          <strong style={{ fontSize: 13.5 }}>{DOC_LABELS[job.docType]}</strong>
          {job.orderNumber ? <span style={{ fontSize: 13 }}>· Order #{job.orderNumber}</span> : <Pill>Test slip</Pill>}
          {job.isReprint ? <Pill tone="info">Reprint</Pill> : null}
          {job.copies > 1 ? <Pill>{job.copies} copies</Pill> : null}
        </div>

        <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
          {job.printerName} · {STATION_LABELS[job.station]} · {TARGETS[job.target].label}
          {" · "}
          {new Date(job.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          {job.printedAt ? ` · printed ${new Date(job.printedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}
        </div>

        {job.lastError ? (
          <div style={errorLine}>
            <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{job.lastError}</span>
          </div>
        ) : null}

        {job.attemptCount > 0 ? (
          <div style={{ fontSize: 11.5, color: "var(--color-text-muted)", marginTop: 4 }}>
            {job.attemptCount} of {job.maxAttempts} attempts
            {retryPending ? ` · next try at ${retryAt!.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : ""}
          </div>
        ) : null}
      </div>

      {canPrint ? (
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          {job.status === "failed" ? (
            <Button variant="outline" onClick={onRetry} disabled={busy} style={btn}>
              <RotateCcw size={13} /> Try again
            </Button>
          ) : null}
          {job.status === "printed" ? (
            <Button variant="outline" onClick={onReprint} disabled={busy} style={btn}>
              <PrinterIcon size={13} /> Print again
            </Button>
          ) : null}
          {waiting ? (
            <Button variant="outline" onClick={onCancel} disabled={busy} style={btn}>
              <Ban size={13} /> Cancel
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ot-press"
      style={{
        ...chip,
        background: active ? "var(--color-primary)" : "var(--color-bg)",
        color: active ? "var(--color-on-primary)" : "var(--color-text)",
        borderColor: active ? "var(--color-primary)" : "var(--color-border)",
      }}
    >
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ styles */

const row: CSSProperties = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
  alignItems: "flex-start",
  padding: "12px 14px",
  border: "1px solid var(--color-border)",
  borderRadius: 10,
  background: "var(--color-bg)",
};
const btn: CSSProperties = { fontSize: 12.5, padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: 6 };
const chip: CSSProperties = {
  font: "inherit",
  fontSize: 12.5,
  fontWeight: 600,
  padding: "5px 12px",
  borderRadius: 999,
  border: "1px solid var(--color-border)",
  cursor: "pointer",
};
const errorLine: CSSProperties = {
  display: "flex",
  gap: 6,
  marginTop: 6,
  padding: "6px 9px",
  borderRadius: 7,
  background: "var(--tone-danger-wash)",
  color: "var(--tone-danger)",
  fontSize: 12,
  lineHeight: 1.4,
};
const alertBar: CSSProperties = {
  display: "flex",
  gap: 9,
  alignItems: "center",
  padding: "11px 14px",
  borderRadius: 9,
  background: "var(--tone-danger-wash)",
  color: "var(--tone-danger)",
  fontSize: 13,
  marginBottom: 14,
};
