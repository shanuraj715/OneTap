"use client";

import { useState } from "react";
                                                      
import { useDismiss } from "../useDismiss";
                                            

const trigger                = {
  font: "inherit",
  fontSize: "0.86rem",
  fontWeight: 500,
  padding: "8px 14px",
  borderRadius: 8,
  border: "1px solid var(--color-border)",
  background: "var(--color-bg)",
  color: "var(--color-text)",
  cursor: "pointer",
};
const bubbleBase                = {
  position: "absolute",
  zIndex: 20,
  minWidth: 210,
  fontSize: "0.83rem",
  lineHeight: 1.5,
  padding: "11px 13px",
};

function Shell({
  label,
  children,
  bubble,
  arrow,
  placement = "bottom",
}                                                                                                     ) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const pos                =
    placement === "top"
      ? { bottom: "calc(100% + 9px)", left: 0 }
      : placement === "right"
        ? { left: "calc(100% + 9px)", top: 0 }
        : { top: "calc(100% + 9px)", left: 0 };
  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button type="button" className="ot-press" style={trigger} aria-expanded={open} onClick={() => setOpen(!open)}>
        {label}
      </button>
      {open ? (
        <div role="dialog" className="ot-anim-pop" style={{ ...bubbleBase, ...pos, ...bubble }}>
          {arrow}
          {children}
        </div>
      ) : null}
    </div>
  );
}

const card                = {
  background: "var(--color-bg)",
  border: "1px solid var(--color-border)",
  borderRadius: 10,
  boxShadow: "0 10px 28px rgba(0,0,0,0.16)",
  color: "var(--color-text)",
};

/** 01 card below the trigger */
export const PopoverCard = (p              ) => <Shell {...p} bubble={card} />;

/** 02 dark tooltip */
export const PopoverTooltip = (p              ) => (
  <Shell {...p} bubble={{ background: "var(--color-text)", color: "var(--color-bg)", borderRadius: 8, minWidth: 180, boxShadow: "0 6px 18px rgba(0,0,0,0.24)" }} />
);

/** 03 with a pointer arrow */
export const PopoverArrow = (p              ) => (
  <Shell
    {...p}
    bubble={card}
    arrow={
      <span aria-hidden style={{ position: "absolute", top: -6, left: 18, width: 10, height: 10, background: "var(--color-bg)", borderLeft: "1px solid var(--color-border)", borderTop: "1px solid var(--color-border)", transform: "rotate(45deg)" }} />
    }
  />
);

/** 04 opens above the trigger */
export const PopoverTop = (p              ) => <Shell {...p} placement="top" bubble={card} />;

/** 05 opens to the side */
export const PopoverSide = (p              ) => <Shell {...p} placement="right" bubble={card} />;

/** 06 tinted in the brand colour */
export const PopoverBrand = (p              ) => (
  <Shell {...p} bubble={{ background: "var(--color-primary)", color: "var(--color-on-primary)", borderRadius: 10, boxShadow: "0 10px 28px rgba(0,0,0,0.2)" }} />
);

/** 07 wide, flat, square */
export const PopoverFlat = (p              ) => (
  <Shell {...p} bubble={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 0, minWidth: 280, boxShadow: "none" }} />
);
