"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * A thin progress bar across the very top of the page while the storefront changes page.
 *
 * Every page here is built on the server, so after a tap there is a short wait with nothing on the screen to say the tap
 * worked. The bar starts at once (a tap on a link of the store, the browser's Back / Forward, or the few places where the
 * code moves to another page itself — they call `startNavProgress()`), creeps forward while the next page is on its way,
 * and runs to the end and fades when the new address arrives. It never reaches 100% on its own: if a page never comes
 * (the link did something else), it gives up after SAFETY_MS rather than hang.
 */

const SAFETY_MS = 8000;
const START_AT = 0.08; // the first jump, so a tap is visible straight away
const CEILING = 0.92; // the creep slows down towards this and never passes it

const listeners = new Set();
/** For code that moves to another page itself (router.push): call this just before it. */
export function startNavProgress() {
  listeners.forEach((l) => l("start"));
}

/** A tap on a link that goes to a different page of this site, in this tab. */
function leavesThisPage(e) {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
  const a = e.target instanceof Element ? e.target.closest("a[href]") : null;
  if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download") || a.hasAttribute("data-no-progress")) return false;
  let url;
  try {
    url = new URL(a.href, window.location.href);
  } catch {
    return false;
  }
  if (url.origin !== window.location.origin) return false; // another site: the browser shows its own loading
  return url.pathname !== window.location.pathname || url.search !== window.location.search; // a same-page or #hash link goes nowhere
}

export function NavProgress() {
  const pathname = usePathname();
  const [state, setState] = useState({ phase: "idle", progress: 0 }); // idle | running | done
  const phase = useRef("idle");
  const progress = useRef(0);
  const creep = useRef(null);
  const safety = useRef(null);
  const fade = useRef(null);
  const first = useRef(true);

  const show = (p, ph) => {
    progress.current = p;
    phase.current = ph;
    setState({ phase: ph, progress: p });
  };
  const stopTimers = () => {
    clearInterval(creep.current);
    clearTimeout(safety.current);
    clearTimeout(fade.current);
  };

  const start = () => {
    if (phase.current === "running") return;
    stopTimers();
    show(START_AT, "running");
    creep.current = setInterval(() => show(progress.current + (CEILING - progress.current) * 0.07, "running"), 180);
    safety.current = setTimeout(finish, SAFETY_MS);
  };
  const finish = () => {
    if (phase.current !== "running") return;
    stopTimers();
    show(1, "done");
    fade.current = setTimeout(() => show(0, "idle"), 450);
  };

  // taps on links, the Back / Forward buttons, and code that changes page itself
  useEffect(() => {
    const onClick = (e) => { if (leavesThisPage(e)) start(); };
    const onPop = () => start();
    const onCall = (what) => { if (what === "start") start(); };
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPop);
    listeners.add(onCall);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPop);
      listeners.delete(onCall);
      stopTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // the new page has arrived
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <div className="nav-progress" data-testid="nav-progress" data-state={state.phase} aria-hidden="true">
      <div className="nav-progress__bar" style={{ transform: `scaleX(${state.progress})` }} />
    </div>
  );
}
