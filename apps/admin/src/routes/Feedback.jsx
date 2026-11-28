import { useState } from "react";
import { formatINR } from "@rasoipulse/config-schema";
import { RatingBadge, RatingStars } from "@rasoipulse/ui";
import { ChevronDown, MessageSquareText, Search, Star, Store, User, UtensilsCrossed } from "lucide-react";
import { useAuth } from "../lib/useAuth";
import { useFeedback, useFeedbackForItem, useFeedbackView } from "../lib/useGrowth";
import { useOutlets } from "../lib/useOutlet";
import { useStorePlan } from "../lib/useStorePlan";
import { Button, Card, Empty, Note, PageHeader, Pill, Select, Tabs } from "../ui";

const when = (iso) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const day = (iso) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/** The store's own colour for its stars (the theme's primary), or the page's accent when the store has none set. */
const storeColor = (outlet) => outlet?.config?.theme?.light?.colorPrimary || undefined;

/**
 * Ratings: what customers said about their completed orders. Four ways to look at them — every review (newest first, with the dishes they rated),
 * by customer, by outlet and by dish (the same dish at several outlets is one row). The stars are in the store's own colour.
 */
export function Feedback() {
  const { outlet, outlets } = useOutlets();
  const { can } = useAuth();
  const { hasFeature } = useStorePlan();
  const allowed = can("feedback:read") && hasFeature("feedback");
  const [view, setView] = useState("reviews");
  const [days, setDays] = useState(30);
  const [picked, setPicked] = useState([]); // outlet ids for the by-… views (none = all)

  const header = <PageHeader title="Ratings" icon={<Star size={23} />} subtitle="How customers rated their orders and their dishes, and what they wrote." />;
  if (!allowed) return <>{header}<Card>{hasFeature("feedback") ? "Your role can't see ratings." : "Ratings & feedback aren't included in your plan."}</Card></>;

  const asking = outlet?.config?.feedback?.enabled !== false;
  const color = storeColor(outlet);
  const many = outlets.length > 1;
  const toggleOutlet = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <>
      {header}
      {!asking ? <Note>Customers aren&apos;t being asked to rate right now — switch on <strong>Ratings</strong> in Settings → Outlet Settings.</Note> : null}
      <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", marginBottom: 14 }}>
        <Tabs
          value={view}
          onChange={setView}
          tabs={[
            { id: "reviews", label: "Reviews", icon: <MessageSquareText size={14} /> },
            { id: "customers", label: "By customer", icon: <User size={14} /> },
            { id: "outlets", label: "By outlet", icon: <Store size={14} /> },
            { id: "dishes", label: "By dish", icon: <UtensilsCrossed size={14} /> },
          ]}
        />
        <Select value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Period" data-testid="ratings-days">
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
          <option value={365}>Last year</option>
        </Select>
      </div>
      {many && view !== "reviews" ? (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14, alignItems: "center" }} data-testid="ratings-outlets">
          <span style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>Outlets:</span>
          <button type="button" style={chip(!picked.length)} onClick={() => setPicked([])} aria-pressed={!picked.length}>All</button>
          {outlets.map((o) => <button key={o._id} type="button" style={chip(picked.includes(o._id))} onClick={() => toggleOutlet(o._id)} aria-pressed={picked.includes(o._id)} data-testid={`ratings-outlet-${o._id}`}>{o.config?.identity?.name || o.name}</button>)}
        </div>
      ) : null}

      {view === "reviews" ? <Reviews outlet={outlet} days={days} color={color} /> : null}
      {view === "customers" ? <ByCustomer outlet={outlet} days={days} picked={picked} color={color} /> : null}
      {view === "outlets" ? <ByOutlet outlet={outlet} days={days} picked={picked} color={color} /> : null}
      {view === "dishes" ? <ByDish outlet={outlet} days={days} picked={picked} color={color} /> : null}
    </>
  );
}

/* ------------------------------------------------------------------------------------------------ every review */

function Reviews({ outlet, days, color }) {
  const [stars, setStars] = useState([]);
  const [withComment, setWithComment] = useState(false);
  const data = useFeedback(outlet, { days, stars, withComment }, true);
  const s = data.data?.summary;
  const rows = data.data?.ratings ?? [];
  const max = s ? Math.max(1, ...Object.values(s.byStars)) : 1;
  const toggleStar = (n) => setStars((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));
  return (
    <>
      <Card>
        <div style={{ display: "flex", gap: 28, flexWrap: "wrap", alignItems: "center" }}>
          <div data-testid="feedback-average">
            <div style={{ fontSize: 40, fontWeight: 800, lineHeight: 1, fontFamily: "var(--font-heading)" }}>{s?.count ? s.average.toFixed(1) : "—"}</div>
            <div style={{ margin: "6px 0 2px" }}><Stars value={s?.average ?? 0} size={20} color={color} /></div>
            <div style={{ fontSize: 12.5, color: "var(--color-text-muted)", marginTop: 4 }}>{s?.count ?? 0} rating{s?.count === 1 ? "" : "s"} · last {days} days</div>
          </div>
          <Distribution byStars={s?.byStars} max={max} pressed={stars} onPick={toggleStar} />
          <label style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 13 }}>
            <input type="checkbox" checked={withComment} onChange={(e) => setWithComment(e.target.checked)} /> Only with a comment ({s?.withComments ?? 0})
          </label>
        </div>
      </Card>

      <Card title={stars.length ? `Showing ${[...stars].sort().join(", ")}★` : "Every rating"} subtitle={`At ${outlet?.config?.identity?.name || outlet?.name || "this outlet"}. The other tabs look across outlets.`}>
        {data.isLoading ? (
          <p style={{ margin: 0, color: "var(--color-text-muted)" }}>Loading…</p>
        ) : !rows.length ? (
          <Empty icon={<MessageSquareText size={28} />} title="No ratings here yet">Customers rate an order from their Account page or the order page once it is completed.</Empty>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {rows.map((f) => (
              <article key={f.id} style={ratingCard} data-testid="feedback-row" data-rating={f.rating}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <Stars value={f.rating} color={color} />
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
                {f.itemRatings?.length ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 10 }} data-testid="feedback-dishes">
                    {f.itemRatings.map((i) => (
                      <div key={i.itemId} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 13 }}>
                        <Stars value={i.rating} size={14} color={color} />
                        <strong style={{ fontWeight: 600 }}>{i.name}</strong>
                        {i.comment ? <span style={{ color: "var(--color-text-muted)" }}>&ldquo;{i.comment}&rdquo;</span> : null}
                      </div>
                    ))}
                  </div>
                ) : null}
                <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 8 }}>{f.items.join(", ")}</div>
              </article>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}

/* ------------------------------------------------------------------------------------------------ by customer */

const CUSTOMER_SORTS = [["recent", "Newest first"], ["lowest", "Lowest average first"], ["highest", "Highest average first"], ["most", "Most ratings first"]];

function ByCustomer({ outlet, days, picked, color }) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("recent");
  const [page, setPage] = useState(1);
  const filters = { days, outlets: picked, search: search.trim(), sort, page, limit: 20 };
  const q = useFeedbackView("customer", outlet, filters);
  const d = q.data;
  return (
    <Card title="Ratings by customer" subtitle="Who rated, how often, their average and what they said last.">
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <label style={searchBox}><Search size={14} aria-hidden="true" /><input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Find by name or phone" aria-label="Find a customer" style={searchInput} data-testid="ratings-customer-search" /></label>
        <Select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }} aria-label="Order" data-testid="ratings-customer-sort">
          {CUSTOMER_SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
      </div>
      {q.isLoading ? <p style={muted}>Loading…</p> : !d?.customers.length ? (
        <Empty icon={<User size={28} />} title={search ? "Nobody matches" : "No ratings in this time"}>{search ? "Try another name or number." : "Customers who rate an order show up here."}</Empty>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {d.customers.map((c) => (
              <article key={c.id} style={ratingCard} data-testid="customer-row" data-name={c.name}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <strong>{c.name}</strong>
                    <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{c.phone}</span>
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <Stars value={c.average} size={16} color={color} />
                    <strong style={{ fontVariantNumeric: "tabular-nums" }} data-testid="customer-average">{c.average.toFixed(1)}</strong>
                  </span>
                </div>
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12.5, color: "var(--color-text-muted)", marginTop: 6 }}>
                  <span data-testid="customer-count">{c.count} rating{c.count === 1 ? "" : "s"}</span>
                  <span>lowest {c.lowest}★</span>
                  {c.dishRatings ? <span>{c.dishRatings} dish{c.dishRatings === 1 ? "" : "es"} rated</span> : null}
                  <span>last {day(c.last)} (order #{c.lastOrder})</span>
                  {c.outlets.length ? <span>{c.outlets.join(", ")}</span> : null}
                </div>
                {c.lastComment ? <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.5 }}>&ldquo;{c.lastComment}&rdquo;</p> : null}
              </article>
            ))}
          </div>
          {d.pages > 1 ? (
            <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "center", marginTop: 14 }}>
              <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
              <span style={{ fontSize: 13, color: "var(--color-text-muted)" }} data-testid="customer-page">Page {d.page} of {d.pages} · {d.total} customers</span>
              <Button variant="secondary" disabled={page >= d.pages} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          ) : <p style={{ ...muted, marginTop: 12 }}>{d.total} customer{d.total === 1 ? "" : "s"}</p>}
        </>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------------------------------------ by outlet */

function ByOutlet({ outlet, days, picked, color }) {
  const q = useFeedbackView("outlet", outlet, { days, outlets: picked });
  const d = q.data;
  if (q.isLoading) return <Card><p style={{ margin: 0, ...muted }}>Loading…</p></Card>;
  if (!d) return <Card><Empty icon={<Store size={28} />} title="Couldn't load the ratings">Try again in a moment.</Empty></Card>;
  const all = d.total;
  const best = [...d.outlets].filter((o) => o.count).sort((a, b) => b.average - a.average)[0];
  return (
    <>
      <Card title="All outlets together" subtitle={`Last ${days} days`}>
        <div style={{ display: "flex", gap: 28, flexWrap: "wrap", alignItems: "center" }} data-testid="outlets-total">
          <div>
            <div style={{ fontSize: 40, fontWeight: 800, lineHeight: 1, fontFamily: "var(--font-heading)" }}>{all.count ? all.average.toFixed(1) : "—"}</div>
            <div style={{ margin: "6px 0 2px" }}><Stars value={all.average} size={20} color={color} /></div>
            <div style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>{all.count} rating{all.count === 1 ? "" : "s"} · {all.withComments} with a comment · {all.dishRatings} dish ratings</div>
          </div>
          <Distribution byStars={all.byStars} max={Math.max(1, ...Object.values(all.byStars))} />
        </div>
        {best && d.outlets.length > 1 ? <p style={{ margin: "14px 0 0", fontSize: 13.5 }}>Best rated: <strong>{best.title}</strong> ({best.average.toFixed(1)} from {best.count} rating{best.count === 1 ? "" : "s"}).</p> : null}
      </Card>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14, marginTop: 14 }}>
        {d.outlets.map((o) => (
          <Card key={o.id} title={o.title}>
            <div data-testid="outlet-card" data-outlet={o.id} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ fontSize: 32, fontWeight: 800, lineHeight: 1, fontFamily: "var(--font-heading)" }} data-testid="outlet-average">{o.count ? o.average.toFixed(1) : "—"}</div>
                <div><Stars value={o.average} size={18} color={color} /><div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 2 }} data-testid="outlet-count">{o.count} rating{o.count === 1 ? "" : "s"}</div></div>
              </div>
              <Distribution byStars={o.byStars} max={Math.max(1, ...Object.values(o.byStars))} />
              <div style={{ fontSize: 12.5, color: "var(--color-text-muted)", display: "flex", gap: 12, flexWrap: "wrap" }}>
                <span>{o.count ? `${o.happyShare}% gave 4–5★` : "No ratings yet"}</span>
                <span>{o.withComments} with a comment</span>
                <span>{o.dishRatings} dish ratings</span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------------------------------------ by dish */

const ITEM_SORTS = [["most", "Most rated first"], ["best", "Best rated first"], ["worst", "Worst rated first"]];

function ByDish({ outlet, days, picked, color }) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("most");
  const [open, setOpen] = useState(null);
  const q = useFeedbackView("item", outlet, { days, outlets: picked, search: search.trim(), sort });
  const d = q.data;
  return (
    <Card title="Ratings by dish" subtitle="The same dish at several outlets is one row, with each outlet's own average.">
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <label style={searchBox}><Search size={14} aria-hidden="true" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find a dish" aria-label="Find a dish" style={searchInput} data-testid="ratings-dish-search" /></label>
        <Select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Order" data-testid="ratings-dish-sort">
          {ITEM_SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
      </div>
      {q.isLoading ? <p style={muted}>Loading…</p> : !d?.items.length ? (
        <Empty icon={<UtensilsCrossed size={28} />} title={search ? "No dish by that name" : "No dishes rated in this time"}>{search ? "Try another name." : "When customers rate the dishes of an order, they are grouped here."}</Empty>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {d.items.map((i) => (
            <article key={i.key} style={ratingCard} data-testid="dish-row" data-key={i.key}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <strong>{i.name}</strong>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <Stars value={i.average} size={16} color={color} />
                  <strong style={{ fontVariantNumeric: "tabular-nums" }} data-testid="dish-average">{i.average.toFixed(1)}</strong>
                  <span style={{ fontSize: 12.5, color: "var(--color-text-muted)" }} data-testid="dish-count">{i.count} rating{i.count === 1 ? "" : "s"}</span>
                </span>
              </div>
              <Distribution byStars={i.byStars} max={Math.max(1, ...Object.values(i.byStars))} compact />
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12.5, color: "var(--color-text-muted)", marginTop: 8, alignItems: "center" }}>
                {i.outlets.length > 1 ? i.outlets.map((o) => <span key={o.id} data-testid="dish-outlet">{o.name}: <strong style={{ color: "var(--color-text)" }}>{o.average.toFixed(1)}</strong> ({o.count})</span>) : i.outlets[0] ? <span>{i.outlets[0].name}</span> : null}
                {i.withNotes ? <span>{i.withNotes} with a note</span> : null}
                <button type="button" style={linkBtn} onClick={() => setOpen(open === i.key ? null : i.key)} aria-expanded={open === i.key} data-testid="dish-reviews-toggle">
                  {open === i.key ? "Hide reviews" : "Read reviews"} <ChevronDown size={13} style={{ verticalAlign: -2, transform: open === i.key ? "rotate(180deg)" : "none" }} />
                </button>
              </div>
              {open === i.key ? <DishReviews outlet={outlet} itemKey={i.key} days={days} picked={picked} color={color} /> : null}
            </article>
          ))}
        </div>
      )}
    </Card>
  );
}

function DishReviews({ outlet, itemKey, days, picked, color }) {
  const q = useFeedbackForItem(outlet, itemKey, { days, outlets: picked });
  const rows = q.data?.reviews ?? [];
  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px dashed var(--color-border)", display: "flex", flexDirection: "column", gap: 8 }} data-testid="dish-reviews">
      {q.isLoading ? <span style={muted}>Loading…</span> : !rows.length ? <span style={muted}>No reviews yet.</span> : rows.map((r, n) => (
        <div key={`${r.id}-${n}`} style={{ fontSize: 13 }} data-testid="dish-review">
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Stars value={r.dishRating} size={14} color={color} />
            <strong style={{ fontWeight: 600 }}>{r.customerName}</strong>
            <span style={{ color: "var(--color-text-muted)", fontSize: 12 }}>order #{r.orderNumber} · {r.outlet} · {when(r.createdAt)}</span>
          </div>
          {r.dishNote ? <div style={{ margin: "3px 0 0" }}>&ldquo;{r.dishNote}&rdquo;</div> : null}
          <div style={{ color: "var(--color-text-muted)", fontSize: 12, marginTop: 2 }}>The whole order: {r.orderRating}★{r.orderComment ? ` — “${r.orderComment}”` : ""}</div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------ pieces */

/** How the stars split: five bars (touch one to filter, when `onPick` is given). */
function Distribution({ byStars, max, pressed = [], onPick, compact = false }) {
  return (
    <div style={{ flex: compact ? "none" : "1 1 260px", display: "flex", flexDirection: "column", gap: compact ? 3 : 5, marginTop: compact ? 8 : 0 }} aria-label="How the stars split">
      {[5, 4, 3, 2, 1].map((n) => {
        const row = (
          <>
            <span style={{ width: 26, fontWeight: 700 }}>{n}★</span>
            <span style={{ flex: 1, height: compact ? 6 : 8, borderRadius: 99, background: "var(--color-border)", overflow: "hidden" }}>
              <span style={{ display: "block", height: "100%", width: `${((byStars?.[n] ?? 0) / max) * 100}%`, background: n >= 4 ? "var(--tone-success)" : n === 3 ? "var(--tone-warning)" : "var(--tone-danger)" }} />
            </span>
            <span style={{ width: 30, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{byStars?.[n] ?? 0}</span>
          </>
        );
        return onPick ? (
          <button key={n} type="button" onClick={() => onPick(n)} style={{ ...barRow, outline: pressed.includes(n) ? "2px solid var(--color-primary)" : "none" }} aria-pressed={pressed.includes(n)} aria-label={`${n} stars: ${byStars?.[n] ?? 0}`}>{row}</button>
        ) : (
          <div key={n} style={{ ...barRow, cursor: "default" }}>{row}</div>
        );
      })}
    </div>
  );
}

/** The store's stars (kept under this name: the dashboard's rating widget and the pages above all use it). */
export function Stars({ value, size = 13, color }) {
  return <RatingStars value={value} size={size} color={color} />;
}

export { RatingBadge };

const chip = (on) => ({ font: "inherit", fontSize: 12.5, padding: "4px 11px", borderRadius: 999, cursor: "pointer", border: `1px solid ${on ? "var(--color-primary)" : "var(--color-border)"}`, background: on ? "var(--color-primary)" : "transparent", color: on ? "var(--color-on-primary)" : "var(--color-text)", fontWeight: on ? 700 : 500 });
const searchBox = { display: "inline-flex", alignItems: "center", gap: 8, padding: "0 12px", height: 38, borderRadius: 10, border: "1px solid var(--color-border)", background: "var(--color-surface)", flex: "1 1 220px", maxWidth: 360 };
const searchInput = { border: "none", outline: "none", background: "transparent", font: "inherit", fontSize: 14, color: "inherit", width: "100%" };
const muted = { color: "var(--color-text-muted)", fontSize: 13 };
const linkBtn = { font: "inherit", fontSize: 12.5, fontWeight: 700, background: "none", border: "none", padding: 0, color: "var(--color-primary-text, var(--color-primary))", cursor: "pointer" };
const barRow = { display: "flex", alignItems: "center", gap: 8, font: "inherit", fontSize: 12.5, padding: "2px 6px", border: "none", borderRadius: 6, background: "none", color: "inherit", cursor: "pointer" };
const ratingCard = { padding: "12px 14px", border: "1px solid var(--color-border)", borderRadius: 12, background: "var(--color-surface)" };
