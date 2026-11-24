import { useState } from "react";
import { CheckCircle2, History, XCircle } from "lucide-react";
import { useLoginLogs } from "../../lib/usePlatform";
import { Button, Card, Empty, Pill, Table, Tabs, Td, Th } from "../../ui";
import { StatTile } from "./viz/charts";
import { ago, count, dateTime } from "./viz/format";
import { muted } from "./shared";

/** Why a sign-in failed, in words. */
const REASONS = {
  wrong_password: "Wrong password",
  unknown_account: "No account with that email",
  inactive: "Account switched off",
  paused: "Access paused by Rasoi Pulse",
};

const FILTERS = [
  { id: "all", label: "Everyone" },
  { id: "failed", label: "Failed" },
  { id: "platform", label: "Platform console" },
  { id: "stores", label: "Store dashboards" },
];

/**
 * Who signed in to the dashboards — the platform console and every store's — and
 * who tried and failed. Kept for six months. Always read live, never from a cache.
 */
export function LoginActivity() {
  const [filter, setFilter] = useState("all");
  const q = useLoginLogs(filter);
  const pages = q.data?.pages ?? [];
  const logs = pages.flatMap((p) => p.logs);
  const summary = pages[0]?.summary;

  return (
    <Card
      title="Sign-in activity"
      icon={<History size={16} />}
      subtitle="Every sign-in to the platform console and to the stores' dashboards — and every failed attempt. Kept for six months."
    >
      <div className="dash-tiles" style={{ marginBottom: 14 }}>
        <StatTile label="Signed in, last 24 hours" value={count(summary?.signedIn24h)} />
        <StatTile label="Failed attempts, last 24 hours" value={count(summary?.failed24h)} note={summary ? `${count(summary.failed7d)} in the last 7 days` : undefined} />
        <StatTile label="People who signed in, 7 days" value={count(summary?.people7d)} />
        <StatTile
          label="Last platform console sign-in"
          value={summary?.lastPlatformSignIn ? ago(summary.lastPlatformSignIn.at) : "—"}
          note={summary?.lastPlatformSignIn ? `${summary.lastPlatformSignIn.email} · ${summary.lastPlatformSignIn.device ?? ""}` : undefined}
        />
      </div>

      <Tabs value={filter} onChange={setFilter} tabs={FILTERS} />

      {q.isError ? (
        <p style={{ ...muted, marginTop: 12 }}>{q.error.message}</p>
      ) : !q.data ? (
        <p style={{ ...muted, marginTop: 12 }}>Loading…</p>
      ) : logs.length === 0 ? (
        <Empty icon={<History size={26} />} title="Nothing here yet">
          {filter === "all" ? "Sign-ins will be listed as they happen." : "No sign-ins match this filter."}
        </Empty>
      ) : (
        <div style={{ marginTop: 12 }}>
          <Table minWidth={720}>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Who</Th>
                <Th>Result</Th>
                <Th>From</Th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <Td nowrap>
                    <span title={dateTime(log.at)}>{ago(log.at)}</span>
                  </Td>
                  <Td>
                    <div style={{ fontWeight: 600 }}>{log.name ?? log.email}</div>
                    <div style={muted}>
                      {log.name ? `${log.email} · ` : ""}
                      {log.scope === "platform" ? "Platform console" : log.store ? `${log.store}${log.role ? ` · ${log.role}` : ""}` : log.scope === "store" ? "Store dashboard" : "Unknown account"}
                    </div>
                  </Td>
                  <Td nowrap>
                    {log.success ? (
                      <Pill tone="ok" icon={<CheckCircle2 size={13} />}>
                        Signed in
                      </Pill>
                    ) : (
                      <Pill tone="error" icon={<XCircle size={13} />}>
                        {REASONS[log.reason] ?? "Failed"}
                      </Pill>
                    )}
                  </Td>
                  <Td>
                    <div>{log.device ?? "Unknown device"}</div>
                    <div style={{ ...muted, fontFamily: "ui-monospace, monospace" }}>{log.ip ?? "—"}</div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          {q.hasNextPage ? (
            <div style={{ marginTop: 12, textAlign: "center" }}>
              <Button variant="outline" disabled={q.isFetchingNextPage} onClick={() => q.fetchNextPage()}>
                {q.isFetchingNextPage ? "Loading…" : "Show older"}
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </Card>
  );
}
