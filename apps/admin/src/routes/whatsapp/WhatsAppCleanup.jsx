import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DatePickerInput, formatDate } from "@rasoipulse/ui";
import { Eraser } from "lucide-react";
import * as api from "../../lib/api";
import { useOutlet } from "../../lib/useOutlet";
import { useWaAccounts, useWaAction } from "../../lib/useWhatsApp";
import { Button, Card, Select, TextInput, Toast } from "../../ui";
import { WaConfirm } from "./WaConfirm";
import { WaHeader } from "./WaNav";

/**
 * Clear out old WhatsApp history (owner only): messages older than N days or a date (the chats stay), or whole chats
 * nobody has written in since then. Messages still waiting to go out are never touched. Only the dashboard's copy —
 * the phones keep their own.
 */
export function WhatsAppCleanup() {
  const { outlet } = useOutlet();
  const accounts = useWaAccounts().data?.accounts ?? [];
  const [mode, setMode] = useState("days"); // days | date
  const [days, setDays] = useState("90");
  const [date, setDate] = useState(() => formatDate(new Date(Date.now() - 90 * 86400_000)));
  const [scope, setScope] = useState("messages");
  const [accountId, setAccountId] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState(null);

  const before = useMemo(() => {
    if (mode === "days") {
      const n = Math.floor(Number(days));
      if (!Number.isFinite(n) || n < 1) return null;
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return new Date(d.getTime() - (n - 1) * 86400_000);
    }
    const [y, m, d] = String(date).split("-").map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d); // the start of that day
  }, [mode, days, date]);
  const valid = before && before <= new Date();
  const body = useMemo(() => (valid ? { before: before.toISOString(), scope, ...(accountId ? { accountId } : {}) } : null), [valid, before, scope, accountId]);

  const preview = useQuery({ queryKey: ["wa-cleanup", outlet?._id, body], queryFn: () => api.waCleanupPreview(outlet, body), enabled: Boolean(outlet && body), retry: false });
  const run = useWaAction((o, b) => api.waCleanup(o, b));
  const p = preview.data;
  const nothing = p && (scope === "chats" ? p.chats === 0 : p.messages === 0);
  const when = before ? before.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "";

  return (
    <>
      <WaHeader subtitle="Remove old WhatsApp history from the dashboard." />
      <Card title="Clean up old history" subtitle="Only the dashboard's copy is removed — the phones keep theirs. Messages still waiting to go out are never removed.">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <fieldset style={fieldset}>
            <legend style={legend}>Older than</legend>
            <label style={radio}>
              <input type="radio" name="wa-when" checked={mode === "days"} onChange={() => setMode("days")} />
              <TextInput
                type="number"
                min={1}
                max={3650}
                value={days}
                onChange={(e) => {
                  setDays(e.target.value);
                  setMode("days");
                }}
                aria-label="Number of days"
                style={{ width: 90 }}
              />
              days
            </label>
            <label style={radio}>
              <input type="radio" name="wa-when" checked={mode === "date"} onChange={() => setMode("date")} />
              before
              <span onClick={() => setMode("date")}>
                <DatePickerInput
                  value={date}
                  onChange={(v) => {
                    setDate(typeof v === "string" ? v : formatDate(v));
                    setMode("date");
                  }}
                  placeholder="Pick a date"
                />
              </span>
            </label>
          </fieldset>

          <fieldset style={fieldset}>
            <legend style={legend}>Remove</legend>
            <label style={radio}>
              <input type="radio" name="wa-scope" checked={scope === "messages"} onChange={() => setScope("messages")} />
              <span>
                <strong>Old messages</strong> — the chats stay in the list
              </span>
            </label>
            <label style={radio}>
              <input type="radio" name="wa-scope" checked={scope === "chats"} onChange={() => setScope("chats")} />
              <span>
                <strong>Whole chats</strong> with no message since then
              </span>
            </label>
          </fieldset>

          {accounts.length > 1 ? (
            <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600, maxWidth: 320 }}>
              Only the chats of
              <Select value={accountId} onChange={(e) => setAccountId(e.target.value)} aria-label="Only the chats of">
                <option value="">All numbers</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
                <option value="none">Chats with no number</option>
              </Select>
            </label>
          ) : null}

          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <Button onClick={() => setConfirming(true)} disabled={!valid || !p || nothing || preview.isFetching} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Eraser size={14} /> Remove…
            </Button>
            <span style={{ fontSize: 13.5, color: "var(--color-text-muted)" }} aria-live="polite">
              {!valid
                ? "Pick a date in the past, or a number of days."
                : p
                  ? scope === "chats"
                    ? `${p.chats} ${p.chats === 1 ? "chat" : "chats"} (${p.messages} messages) with nothing since ${when}.`
                    : `${p.messages} ${p.messages === 1 ? "message" : "messages"} from before ${when}, in ${p.chats} ${p.chats === 1 ? "chat" : "chats"}.`
                  : "Counting…"}
            </span>
          </div>
          {result ? (
            <Toast kind="ok">
              Removed {scope === "chats" ? `${result.chats} chats and ` : ""}
              {result.messages} messages.
            </Toast>
          ) : null}
          {preview.error ? <Toast kind="error">{preview.error.message}</Toast> : null}
        </div>
      </Card>

      {confirming && p ? (
        <WaConfirm
          title={scope === "chats" ? `Remove ${p.chats} chats?` : `Remove ${p.messages} messages?`}
          onCancel={() => setConfirming(false)}
          busy={run.isPending}
          actions={[
            {
              label: "Remove",
              tone: "danger",
              onClick: () =>
                run.mutate(body, {
                  onSuccess: (r) => {
                    setResult(r);
                    setConfirming(false);
                  },
                }),
            },
          ]}
        >
          {scope === "chats"
            ? `Every chat with no message since ${when} is removed from the dashboard, with its ${p.messages} messages and any photos or files in them.`
            : `Every message from before ${when} is removed from the dashboard, with any photos or files in them. The chats stay.`}{" "}
          This can&apos;t be undone.
          {run.error ? <Toast kind="error">{run.error.message}</Toast> : null}
        </WaConfirm>
      ) : null}
    </>
  );
}

const fieldset = { border: 0, padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 };
const legend = { fontSize: 13, fontWeight: 650, marginBottom: 8, padding: 0 };
const radio = { display: "flex", alignItems: "center", gap: 10, fontSize: 14, flexWrap: "wrap" };
