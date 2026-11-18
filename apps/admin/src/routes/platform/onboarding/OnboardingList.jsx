import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Calculator, ClipboardList, Plus, Trash2 } from "lucide-react";
import * as api from "../../../lib/api";
import { useOnboardingList, usePlatformMutation } from "../../../lib/usePlatform";
import { Button, Card, PageHeader, Pill, Toast } from "../../../ui";
import { muted, row } from "../shared";

const ago = (d) => {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(d).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
};
const FILTERS = [["", "All"], ["draft", "Drafts"], ["published", "Published"]];

/** Every requirement form: the ones still being filled in, and the ones that became stores. */
export function OnboardingList() {
  const q = useOnboardingList();
  const navigate = useNavigate();
  const [status, setStatus] = useState("");
  const remove = usePlatformMutation(api.deleteOnboarding);
  const all = q.data?.forms ?? [];
  const list = all.filter((f) => !status || f.status === status);

  return (
    <>
      <PageHeader
        title="Onboarding"
        icon={<ClipboardList size={23} />}
        subtitle="Take a new client's requirements in one form, print it or save it as a PDF, then publish it as their store."
        action={
          <span style={{ display: "inline-flex", gap: 8, flexWrap: "wrap" }}>
            <Button variant="outline" onClick={() => navigate("/platform/onboarding/pricing")} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><Calculator size={14} /> Price list</Button>
            <Button onClick={() => navigate("/platform/onboarding/new")} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><Plus size={14} /> New requirement form</Button>
          </span>
        }
      />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        {FILTERS.map(([id, name]) => (
          <button key={id || "all"} type="button" aria-pressed={status === id} onClick={() => setStatus(id)} style={{ font: "inherit", fontSize: 13, padding: "6px 14px", borderRadius: 999, cursor: "pointer", border: "1px solid var(--color-border)", background: status === id ? "var(--color-primary)" : "var(--color-bg)", color: status === id ? "var(--color-on-primary)" : "var(--color-text)" }}>
            {name} <span style={{ opacity: 0.75 }}>{id ? all.filter((f) => f.status === id).length : all.length}</span>
          </button>
        ))}
      </div>
      <Card>
        {q.isLoading ? (
          <p style={muted}>Loading…</p>
        ) : list.length === 0 ? (
          <p style={muted} data-empty>{all.length ? "Nothing in this view." : "No forms yet — press “New requirement form” when a client wants to start."}</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {list.map((f) => (
              <div key={f.id} style={{ position: "relative" }} data-onboarding-row={f.id}>
                <Link to={`/platform/onboarding/${f.id}`} className="ot-press" style={{ ...row, paddingRight: f.status === "draft" ? 56 : 14, textDecoration: "none", color: "inherit" }}>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{f.storeName}</div>
                    <div style={muted}>{f.repName ? `with ${f.repName}` : "no representative yet"}</div>
                  </div>
                  <div style={{ minWidth: 110 }}><div style={{ fontSize: 12, ...muted }}>Plan</div><div style={{ fontWeight: 600, fontSize: 13 }}>{f.planName || "—"}</div></div>
                  <div style={{ minWidth: 70 }}><div style={{ fontSize: 12, ...muted }}>Outlets</div><div style={{ fontWeight: 600, fontSize: 13 }}>{f.outlets}</div></div>
                  <div style={{ minWidth: 110 }}><Pill tone={f.status === "published" ? "ok" : "neutral"}>{f.status === "published" ? "Published" : "Draft"}</Pill></div>
                  <div style={{ minWidth: 100, ...muted }}>{ago(f.updatedAt)}</div>
                </Link>
                {f.status === "draft" ? (
                  <button
                    type="button"
                    aria-label={`Delete the draft for ${f.storeName}`}
                    onClick={() => window.confirm(`Delete the draft for ${f.storeName}? This can't be undone.`) && remove.mutate(f.id)}
                    style={{ position: "absolute", right: 12, top: 12, border: 0, background: "transparent", cursor: "pointer", color: "var(--color-text-muted)", padding: 6 }}
                  >
                    <Trash2 size={15} />
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        )}
        {remove.error ? <Toast kind="error">{remove.error.message}</Toast> : null}
      </Card>
    </>
  );
}
