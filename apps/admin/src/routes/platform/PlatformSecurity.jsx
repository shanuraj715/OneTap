import { ShieldAlert, ShieldCheck } from "lucide-react";
import * as api from "../../lib/api";
import { usePlatformMutation, useSecurityBlocks } from "../../lib/usePlatform";
import { Button, Card, Empty, Note, PageHeader, Pill, Table, Td, Th } from "../../ui";

const secs = (s) => (s >= 3600 ? `${Math.round(s / 360) / 10} hours` : s >= 90 ? `${Math.round(s / 60)} minutes` : `${s} seconds`);
const left = (iso) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 1000));
const when = (iso) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", second: "2-digit" }) : "—");

/** Network addresses blocked from signing in after too many wrong passwords or codes — and a way to lift a block. */
export function PlatformSecurity() {
  const q = useSecurityBlocks();
  const unblock = usePlatformMutation((id) => api.unblockAddress(id));
  const clearAll = usePlatformMutation(() => api.unblockAllAddresses());
  const blocks = q.data?.blocks ?? [];
  const s = q.data?.settings;
  const blockedNow = blocks.filter((b) => b.blocked).length;

  return (
    <>
      <PageHeader title="Security" icon={<ShieldCheck size={23} />} subtitle="Sign-in protection: who is blocked, and why." />
      <Card
        title="Blocked and watched networks"
        icon={<ShieldAlert size={16} />}
        subtitle={blockedNow ? `${blockedNow} blocked right now.` : "Nobody is blocked right now."}
        action={blocks.length ? <Button variant="outline" onClick={() => clearAll.mutate()} disabled={clearAll.isPending}>Unblock everyone</Button> : undefined}
      >
        {!q.isLoading && !blocks.length ? <Empty title="Nothing to show">Addresses appear here after failed sign-ins.</Empty> : null}
        {blocks.length ? (
          <Table minWidth={720}>
            <thead>
              <tr><Th>Network address / account</Th><Th>For</Th><Th>Status</Th><Th>Failed in window</Th><Th>Times blocked</Th><Th>Last attempt</Th><Th> </Th></tr>
            </thead>
            <tbody>
              {blocks.map((b) => (
                <tr key={b.id} data-ip={b.ip}>
                  <Td>{b.ip}</Td>
                  <Td>{b.scope === "staff" ? "Dashboards" : b.scope === "staff-account" ? "One account (any address)" : "Customer codes"}</Td>
                  <Td>{b.blocked ? <Pill tone="error">Blocked · {secs(left(b.blockedUntil))} left</Pill> : <Pill tone="neutral">Watching</Pill>}</Td>
                  <Td>{b.failures}</Td>
                  <Td>{b.strikes}</Td>
                  <Td>{when(b.lastAttemptAt)}</Td>
                  <Td><Button variant="outline" onClick={() => unblock.mutate(b.id)} disabled={unblock.isPending} aria-label={`Unblock ${b.ip}`}>Unblock</Button></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : null}
      </Card>
      {s ? (
        <Card title="How it works" subtitle={q.data.enabled ? "Switched on." : "Switched OFF on this server (LOGIN_GUARD=off)."}>
          <Note>
            After <strong>{s.maxFailures} wrong passwords or codes</strong> within {secs(s.windowSeconds)}, that network is blocked for{" "}
            <strong>{secs(s.steps[0])}</strong>. Each further block lasts longer — {s.steps.map(secs).join(" → ")} — and stays at the last step.
            The climb is forgotten after {secs(s.forgetSeconds)} without another block. Whatever the outcome, no network can send more than{" "}
            {s.floodPerMinute} sign-in requests a minute. A blocked network sees a notice instead of the sign-in form, and nothing — not even the right password — signs in from it until the block ends.
            These numbers are set with the LOGIN_* settings of the server.
          </Note>
        </Card>
      ) : null}
    </>
  );
}
