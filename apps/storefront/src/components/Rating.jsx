"use client";

import { useState } from "react";
import { FEEDBACK_TAGS } from "@rasoipulse/config-schema";
import { RATING_LABELS, RatingStars } from "@rasoipulse/ui";
import { api } from "@/lib/clientApi";

/**
 * Rating an order, for the Account page and the order page: stars for the whole order (in the store's colour), a few quick tags, a review, and —
 * under "Rate each dish" — stars and a short note for every dish that was in the order. Every part is optional except the order's stars.
 * A happy rating is offered the store's Google review page when it has one.
 */
export function RateBox({ outletId, order, onDone, onClose }) {
  const [stars, setStars] = useState(order.feedback?.rating ?? 0);
  const [tags, setTags] = useState(order.feedback?.tags ?? []);
  const [comment, setComment] = useState(order.feedback?.comment ?? "");
  // each dish of the order that can be rated (it must have an id), with what was given before
  const dishes = rateableDishes(order);
  const before = new Map((order.feedback?.items ?? []).map((i) => [i.itemId, i]));
  const [dish, setDish] = useState(() => Object.fromEntries(dishes.map((d) => [d.itemId, { rating: before.get(d.itemId)?.rating ?? 0, comment: before.get(d.itemId)?.comment ?? "", noteOpen: Boolean(before.get(d.itemId)?.comment) }])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);
  const pool = stars >= 4 ? FEEDBACK_TAGS.good : FEEDBACK_TAGS.bad;
  const rate = (id, n) => setDish((d) => ({ ...d, [id]: { ...d[id], rating: d[id].rating === n ? 0 : n } })); // touching the same star again takes it back
  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const items = dishes.filter((d) => dish[d.itemId].rating > 0).map((d) => ({ itemId: d.itemId, rating: dish[d.itemId].rating, comment: dish[d.itemId].comment.trim() }));
      const r = await api(`/api/customer/orders/${order.id}/feedback`, { outletId, rating: stars, comment: comment.trim(), tags: tags.filter((t) => pool.includes(t)), items });
      setDone(r);
      onDone(r.feedback);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  if (done) {
    return (
      <div style={box} data-testid="rate-thanks">
        <p style={{ margin: 0, fontWeight: 700 }}>Thank you for rating your order!</p>
        <RatingStars value={stars} size={20} />
        {done.google ? (
          <p style={{ margin: "6px 0 0", fontSize: 13.5 }}>
            Glad you enjoyed it. Would you tell others on Google?{" "}
            <a href={done.google} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 700, color: "var(--color-primary-text, var(--color-primary))" }} data-testid="rate-google">
              Write a Google review
            </a>
          </p>
        ) : null}
        <button type="button" style={{ ...linkBtn, padding: "8px 0 0" }} onClick={onClose}>
          Close
        </button>
      </div>
    );
  }
  return (
    <div style={box} data-testid="rate-box">
      <p style={{ margin: "0 0 8px", fontWeight: 700, fontSize: 14 }}>How was order #{order.orderNumber}?</p>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <RatingStars value={stars} onChange={setStars} size={34} label="Rate the order" testId="rate" />
        {stars ? <span style={{ fontWeight: 700, fontSize: 14, color: "var(--color-primary-text, var(--color-primary))" }} data-testid="rate-word">{RATING_LABELS[stars]}</span> : null}
      </div>
      {stars ? (
        <>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "12px 0 10px" }}>
            {pool.map((t) => {
              const on = tags.includes(t);
              return (
                <button key={t} type="button" aria-pressed={on} onClick={() => setTags((x) => (on ? x.filter((y) => y !== t) : [...x, t]))} style={{ ...tagBtn, ...(on ? tagBtnOn : {}) }}>
                  {t}
                </button>
              );
            })}
          </div>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} rows={2} placeholder={stars >= 4 ? "What did you like? (optional)" : "What went wrong? (optional)"} style={commentBox} aria-label="Comment" data-testid="rate-comment" />

          {dishes.length ? (
            <div style={{ marginTop: 14 }} data-testid="rate-dishes">
              <p style={{ margin: "0 0 6px", fontWeight: 700, fontSize: 13.5 }}>Rate each dish <span style={{ fontWeight: 500, color: "var(--color-text-muted)" }}>(optional)</span></p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {dishes.map((d) => {
                  const cur = dish[d.itemId];
                  return (
                    <div key={d.itemId} style={dishRow} data-testid={`rate-dish-${d.itemId}`}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 13.5, fontWeight: 600, minWidth: 0 }}>{d.name}{d.quantity > 1 ? <span style={{ color: "var(--color-text-muted)", fontWeight: 500 }}> ×{d.quantity}</span> : null}</span>
                        <RatingStars value={cur.rating} onChange={(n) => rate(d.itemId, n)} size={24} label={`Rate ${d.name}`} testId={`dishstar-${d.itemId}`} />
                      </div>
                      {cur.rating ? (
                        cur.noteOpen ? (
                          <input value={cur.comment} onChange={(e) => setDish((x) => ({ ...x, [d.itemId]: { ...x[d.itemId], comment: e.target.value } }))} maxLength={200} placeholder={`Say something about the ${d.name} (optional)`} style={noteBox} aria-label={`Note about ${d.name}`} data-testid={`rate-note-${d.itemId}`} />
                        ) : (
                          <button type="button" style={{ ...linkBtn, padding: "2px 0 0", fontSize: 12.5 }} onClick={() => setDish((x) => ({ ...x, [d.itemId]: { ...x[d.itemId], noteOpen: true } }))}>Add a note</button>
                        )
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {error ? <p style={{ color: "var(--tone-danger)", fontSize: 12.5, margin: "8px 0 0" }}>{error}</p> : null}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button type="button" className="ot-press" style={sendBtn} onClick={send} disabled={busy} data-testid="rate-send">
              {busy ? "Sending…" : "Send rating"}
            </button>
            <button type="button" className="ot-press" style={ghostBtn} onClick={onClose} disabled={busy}>
              Not now
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

/** The dishes of an order that can be rated: each one once, and only those with an id. */
export function rateableDishes(order) {
  const seen = new Set();
  const out = [];
  for (const i of order.items ?? []) {
    if (!i.itemId || seen.has(i.itemId)) continue;
    seen.add(i.itemId);
    out.push({ itemId: i.itemId, name: i.name, quantity: (order.items ?? []).filter((x) => x.itemId === i.itemId).reduce((n, x) => n + (x.quantity ?? 1), 0) });
  }
  return out;
}

/** What the customer gave, shown small: the order's stars and a chip for each dish they rated. */
export function GivenRating({ feedback, size = 16 }) {
  const items = feedback?.items ?? [];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }} data-testid="given-rating">
      <RatingStars value={feedback.rating} size={size} />
      {items.map((i) => (
        <span key={i.itemId} style={chip} data-testid="given-dish">{i.name} <strong>{i.rating}★</strong></span>
      ))}
    </span>
  );
}

const box = { marginTop: 10, padding: "12px 14px", borderRadius: "calc(var(--radius-card) - 2px)", background: "var(--color-surface)", border: "1px solid var(--color-border)" };
const dishRow = { padding: "8px 10px", borderRadius: 10, background: "color-mix(in srgb, var(--color-primary) 5%, transparent)", border: "1px solid color-mix(in srgb, var(--color-primary) 14%, var(--color-border))" };
const tagBtn = { font: "inherit", fontSize: 12.5, padding: "5px 10px", borderRadius: 999, border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "inherit", cursor: "pointer" };
const tagBtnOn = { background: "color-mix(in srgb, var(--color-primary) 14%, transparent)", borderColor: "var(--color-primary)", fontWeight: 700 };
const commentBox = { width: "100%", boxSizing: "border-box", font: "inherit", fontSize: 14, padding: "8px 10px", borderRadius: 10, border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "inherit", resize: "vertical" };
const noteBox = { width: "100%", boxSizing: "border-box", marginTop: 6, font: "inherit", fontSize: 13, padding: "6px 9px", borderRadius: 8, border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "inherit" };
const linkBtn = { font: "inherit", fontSize: 13.5, fontWeight: 700, background: "none", border: "none", color: "var(--color-primary-text, var(--color-primary))", cursor: "pointer" };
const sendBtn = { font: "inherit", fontWeight: 700, fontSize: 14, padding: "9px 18px", borderRadius: "var(--radius-card)", border: "none", background: "var(--color-primary)", color: "var(--color-on-primary, #fff)", cursor: "pointer" };
const ghostBtn = { font: "inherit", fontWeight: 600, fontSize: 14, padding: "9px 16px", borderRadius: "var(--radius-card)", border: "1px solid var(--color-border)", background: "none", color: "inherit", cursor: "pointer" };
const chip = { fontSize: 12, padding: "2px 8px", borderRadius: 999, background: "color-mix(in srgb, var(--color-primary) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--color-primary) 25%, transparent)" };
