"use client";

/**
 * A grid of cards whose edges light up under the pointer. It only records where the pointer is inside the card it is over (as --mx / --my on that
 * card); the glow itself is drawn by CSS. Mark each card with data-spot. Touch screens and anyone without script simply see the cards without the
 * glow — nothing depends on it.
 */
export function Spotlight({ className, children }) {
  const onMove = (e) => {
    const card = e.target instanceof Element ? e.target.closest("[data-spot]") : null;
    if (!card) return;
    const r = card.getBoundingClientRect();
    card.style.setProperty("--mx", `${Math.round(e.clientX - r.left)}px`);
    card.style.setProperty("--my", `${Math.round(e.clientY - r.top)}px`);
  };
  return (
    <div className={className} onPointerMove={onMove}>
      {children}
    </div>
  );
}
