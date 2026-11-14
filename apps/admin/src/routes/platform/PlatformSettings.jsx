import { useEffect, useState } from "react";
import { Settings as SettingsIcon } from "lucide-react";
import * as api from "../../lib/api";
import { usePlatformMutation, usePlatformSettings } from "../../lib/usePlatform";
import { Button, Card, Field, PageHeader, TextInput, Toast } from "../../ui";
import { muted } from "./shared";

/** Platform-wide settings. */
export function PlatformSettings() {
  const q = usePlatformSettings();
  const [graceDays, setGraceDays] = useState("");
  const save = usePlatformMutation(() => api.updatePlatformSettings({ graceDays: Number(graceDays) }));

  useEffect(() => {
    if (q.data) setGraceDays(String(q.data.settings.graceDays));
  }, [q.data]);

  const valid = /^\d+$/.test(graceDays) && Number(graceDays) <= 365;

  return (
    <>
      <PageHeader title="Platform settings" icon={<SettingsIcon size={23} />} />
      <Card
        title="Grace period"
        subtitle="When a store goes over its plan's limits (for example after moving to a smaller plan), everything keeps working for this many days. After that the store is flagged “Over limit” and you choose what to block — nothing is ever blocked or deleted automatically."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
          style={{ display: "flex", gap: 12, alignItems: "flex-end" }}
        >
          <Field label="Days" hint="0–365">
            <TextInput type="number" min={0} max={365} value={graceDays} onChange={(e) => setGraceDays(e.target.value)} style={{ width: 110 }} />
          </Field>
          <div style={{ marginBottom: 14 }}>
            <Button type="submit" disabled={!valid || save.isPending}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
        <p style={muted}>Applies to every store, including ones already in a grace period.</p>
        {save.error ? <Toast kind="error">{save.error.message}</Toast> : null}
        {save.isSuccess && !save.isPending ? <Toast kind="ok">Saved.</Toast> : null}
      </Card>
    </>
  );
}
