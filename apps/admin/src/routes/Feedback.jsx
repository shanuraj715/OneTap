import { useState } from "react";
import { formatINR } from "@onetap/config-schema";
import { MessageSquareText, Star } from "lucide-react";
import { useAuth } from "../lib/useAuth";
import { useFeedback } from "../lib/useGrowth";
import { useOutlet } from "../lib/useOutlet";
import { useStorePlan } from "../lib/useStorePlan";
import { Card, Empty, Note, PageHeader, Pill, Select } from "../ui";

const when = (iso) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/**
 * Ratings: what customers said about their completed orders — the average and how the stars split, then every rating
 * with its comment and what was ordered, newest first. Filter by stars (e.g. only the 1–3s, to follow up).
 */
export function Feedback() {
  const { outlet } = useOutlet();
  const { can } = useAuth();
  const { hasFeature } = useStorePlan();
  const allowed = can("feedback:read") && hasFeature("feedback");
  const [days, setDays] = useState(30);
  const [stars, setStars] = useState([]);
  const [withComment, setWithComment] = useState(false);
  const data = useFeedback(outlet, { days, stars, withComment }, allowed);

  const header = <PageHeader title="Ratings" icon={<Star size={23} />} subtitle="How customers rated their orders, and what they wrote." />;
  if (!allowed) return <>{header}<Card>{hasFeature("feedback") ? "Your role can't see ratings." : "Ratings & feedback aren't included in your plan."}</Card></>;

  const s = data.data?.summary;
  const rows = data.data?.ratings ?? [];
  const max = s ? Math.max(1, ...Object.values(s.byStars)) : 1;
  const toggleStar = (n) => setStars((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));
  const asking = outlet?.config?.feedback?.enabled !== false;

  return (
    <>
      {header}
      {!asking ? <Note>Customers aren&apos;t being asked to rate right now — switch on <strong>Ratings</strong> in Settings → Outlet Settings.</Note> : null}
      <Card>
        <div style={{ display: "flex", gap: 28, flexWrap: "wrap", alignItems: "center" }}>
          <div data-testid="feedback-average">
            <div style={{ fontSize: 40, fontWeight: 800, lineHeight: 1, fontFamily: "var(--font-heading)" }}>{s?.count ? s.average.toFixed(1) : "—"}</div>
            <Stars value={Math.round(s?.average ?? 0)} size={16} />
            <div style={{ fontSize: 12.5, color: "var(--color-text-muted)", marginTop: 4 }}>{s?.count ?? 0} rating{s?.count === 1 ? "" : "s"} · last {days} days</div>
          </div>
          <div style={{ flex: "1 1 260px", display: "flex", flexDirection: "column", gap: 5 }} aria-label="How the stars split">
            {[5, 4, 3, 2, 1].map((n) => (
              <button key={n} type="button" onClick={() => toggleStar(n)} style={{ ...barRow, outline: stars.includes(n) ? "2px solid var(--color-primary)" : "none" }} aria-pressed={stars.includes(n)} data-testid={`stars-${n}`}>
                <span style={{ width: 26, fontWeight: 700 }}>{n}★</span>
                <span style={{ flex: 1, height: 8, borderRadius: 99, background: "var(--color-border)", overflow: "hidden" }}>
                  <span style={{ display: "block", height: "100%", width: `${((s?.byStars?.[n] ?? 0) / max) * 100}%`, background: n >= 4 ? "var(--tone-success)" : n === 3 ? "var(--tone-warning)" : "var(--tone-danger)" }} />
                </span>
                <span style={{ width: 30, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{s?.byStars?.[n] ?? 0}</span>
              </button>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Select value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Period">
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
              <option value={365}>Last year</option>
            </Select>
            <label style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 13 }}>
              <input type="checkbox" checked={withComment} onChange={(e) => setWithComment(e.target.checked)} /> Only with a comment ({s?.withComments ?? 0})
            </label>
          </div>
        </div>
      </Card>

      <Card title={stars.length ? `Showing ${[...stars].sort().join(", ")}★` : "Every rating"}>
        {data.isLoading ? (
          <p style={{ margin: 0, color: "var(--color-text-muted)" }}>Loading…</p>
        ) : !rows.length ? (
          <Empty icon={<MessageSquareText size={28} />} title="No ratings here yet">Customers rate an order from their Account page once it is completed.</Empty>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {rows.map((f) => (
              <article key={f.id} style={ratingCard} data-testid="feedback-row" data-rating={f.rating}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <Stars value={f.rating} />
                    <strong>{f.customerName || "A customer"}</strong>
                    <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{f.customerPhone}</span>
                  </span>
                  <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                    Order #{f.orderNumber} · {formatINR(f.orderTotal)} · {when(f.createdAt)}
                  </span>
                </div>
                {f.comment ? <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.5 }}>&ldquo;{f.comment}&rdquo;</p> : null}
                {f.tags.length ? (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                    {f.tags.map((t) => <Pill key={t} tone={f.rating >= 4 ? "ok" : "warn"}>{t}</Pill>)}
                  </div>
                ) : null}
                <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 6 }}>{f.items.join(", ")}</div>
              </article>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}

export function Stars({ value, size = 13 }) {
  return (
    <span style={{ display: "inline-flex", gap: 1 }} aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={size} fill={n <= value ? "var(--tone-warning)" : "none"} color={n <= value ? "var(--tone-warning)" : "var(--color-border)"} />
      ))}
    </span>
  );
}

const barRow = { display: "flex", alignItems: "center", gap: 8, font: "inherit", fontSize: 12.5, padding: "2px 6px", border: "none", borderRadius: 6, background: "none", color: "inherit", cursor: "pointer" };
const ratingCard = { padding: "12px 14px", border: "1px solid var(--color-border)", borderRadius: 12, background: "var(--color-surface)" };
