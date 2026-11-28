"use client";

import { ChevronLeft, ChevronRight, Moon, Smartphone, Sun, SunMoon, Tablet } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * "See it": the app's real screens in a device frame. The visitor picks the device (a tablet held sideways, a tablet held upright, a phone) and the look (light, dark,
 * or Auto = the one their browser is in, which follows the page when it changes) and flips through the screens. Everything the visitor can do is a button; the choices
 * are remembered on this browser.
 *
 * The first paint needs no script: it shows the first screen on the app's first device, in the browser's own look. Both looks of a picture are on the page (stacked, only
 * one visible) so changing the look is a smooth cross-fade and Auto follows `prefers-color-scheme` in CSS, with no flash. Screens that are not on view yet are only added to the
 * page when they are wanted (or when they are the next one), so the page doesn't download every picture up front.
 *
 * The data (heading, intro, which devices, each screen's title, caption and pictures) comes from the platform console (App Management → Screenshots).
 */

const DEVICE_ICON = { "tablet-landscape": <Tablet size={16} aria-hidden="true" style={{ rotate: "90deg" }} />, "tablet-portrait": <Tablet size={16} aria-hidden="true" />, phone: <Smartphone size={16} aria-hidden="true" /> };
const LOOKS = [
  { id: "auto", label: "Auto", icon: <SunMoon size={16} aria-hidden="true" /> },
  { id: "light", label: "Light", icon: <Sun size={16} aria-hidden="true" /> },
  { id: "dark", label: "Dark", icon: <Moon size={16} aria-hidden="true" /> },
];
const STORE_DEVICE = "rp-shots-device";
const STORE_LOOK = "rp-shots-look";
const read = (key) => { try { return window.localStorage.getItem(key); } catch { return null; } };
const write = (key, value) => { try { window.localStorage.setItem(key, value); } catch { /* private window: the choice just isn't remembered */ } };

/** The words that describe a picture to a screen reader: the app, the device, the look, and what is on the screen. */
const altOf = (info, app, device, look, shot) => `${app.code} on ${info[device].name}, ${look} mode${shot.alt ? `: ${shot.alt}` : `: ${shot.title}`}`;

/** The heading with its last two words in the app's colour ("OMA on every *screen*"). */
function Heading({ text }) {
  const words = String(text).trim().split(/\s+/);
  if (words.length < 3) return <>{text}</>;
  return <>{words.slice(0, -1).join(" ")} <em>{words.at(-1)}</em></>;
}

/** `deviceInfo` is SCREENSHOT_DEVICE_INFO from config-schema (passed in by the page, so this file does not pull the whole schema package into the browser). */
export function AppScreens({ app, screens, deviceInfo }) {
  const devices = screens?.devices ?? [];
  const [device, setDevice] = useState(screens?.defaultDevice ?? devices[0]);
  const [look, setLook] = useState("auto");
  const [dark, setDark] = useState(false); // is the browser in dark mode right now (only to say so on the Auto button)
  const [active, setActive] = useState(0);
  const [seen, setSeen] = useState(() => new Set());
  const stage = useRef(null);
  const listEl = useRef(null);
  const drag = useRef(null);

  /* the choices from the last visit, and the browser's own look (kept up to date while the page is open) */
  useEffect(() => {
    const d = read(STORE_DEVICE);
    if (d && devices.includes(d)) setDevice(d);
    const l = read(STORE_LOOK);
    if (l && LOOKS.some((x) => x.id === l)) setLook(l);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const on = () => setDark(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const list = (screens?.shots ?? []).filter((s) => s.images[device]);
  const index = Math.min(active, Math.max(list.length - 1, 0));
  const shot = list[index];

  /* pictures are added to the page when wanted: this one, and the ones either side of it */
  const wanted = [list[index], list[index + 1], list[index - 1]].filter(Boolean).map((s) => `${device}:${s.id}`);
  useEffect(() => {
    setSeen((old) => (wanted.every((k) => old.has(k)) ? old : new Set([...old, ...wanted])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted.join("|")]);

  /* on a phone the screens are a scrolling row: keep the chosen one in the middle of it (the page itself never moves) */
  useEffect(() => {
    const el = listEl.current;
    const tab = el?.children[index];
    if (!el || !tab || el.scrollWidth <= el.clientWidth + 2) return;
    el.scrollTo({ left: tab.offsetLeft - (el.clientWidth - tab.clientWidth) / 2, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [index, device]);

  const go = useCallback((next) => { if (list.length) setActive((next + list.length) % list.length); }, [list.length]);
  const pickDevice = (d) => { setDevice(d); write(STORE_DEVICE, d); setActive(0); };
  const pickLook = (l) => { setLook(l); write(STORE_LOOK, l); };

  /* the device leans a little towards the pointer (a mouse only, and not for people who asked for less motion) */
  const tilt = (e) => {
    const el = stage.current;
    if (!el || e.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--ry", `${(x * 7).toFixed(2)}deg`);
    el.style.setProperty("--rx", `${(-y * 5).toFixed(2)}deg`);
    el.style.setProperty("--gx", `${(x * 100 + 50).toFixed(1)}%`);
  };
  const level = () => { const el = stage.current; if (el) { el.style.setProperty("--ry", "0deg"); el.style.setProperty("--rx", "0deg"); el.style.setProperty("--gx", "50%"); } };

  /* a swipe on the picture flips to the next or the one before */
  const down = (e) => { drag.current = { x: e.clientX, y: e.clientY, t: e.pointerType }; };
  const up = (e) => {
    const d = drag.current; drag.current = null;
    if (!d || d.t === "mouse") return;
    const dx = e.clientX - d.x; const dy = e.clientY - d.y;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.4) go(index + (dx < 0 ? 1 : -1));
  };
  /* arrow keys move along the screens (and the focus with them); Home and End jump to the first and the last */
  const keys = (e) => {
    const to = e.key === "ArrowRight" || e.key === "ArrowDown" ? index + 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? index - 1 : e.key === "Home" ? 0 : e.key === "End" ? list.length - 1 : null;
    if (to === null) return;
    e.preventDefault();
    const next = (to + list.length) % list.length;
    go(next);
    requestAnimationFrame(() => listEl.current?.children[next]?.focus({ preventScroll: true }));
  };

  if (!screens || !devices.length || !shot) return null;
  const info = deviceInfo[device];
  const kind = device === "phone" ? "phone" : "tablet";
  const effective = look === "auto" ? (dark ? "dark" : "light") : look;
  const titleId = `shots-${app.id}-title`;

  return (
    <section className="section app-screens" id="screens" aria-labelledby={titleId} data-testid="screens">
      <div className="wrap">
        <div className="section-head">
          <span className="eyebrow">See it</span>
          <h2 id={titleId}><Heading text={screens.heading} /></h2>
          <p>{screens.intro}</p>
        </div>

        <div className="shots-ui" data-look={look} data-device={device} data-testid="shots-ui">
          <div className="shots-side">
          {/* ---- the controls: which device, which look */}
          <div className="shots-controls">
            <div className="seg" role="radiogroup" aria-label="Device" style={{ "--n": devices.length, "--i": Math.max(devices.indexOf(device), 0) }} data-testid="device-switch">
              <span className="seg-thumb" aria-hidden="true" />
              {devices.map((d) => (
                <button key={d} type="button" role="radio" aria-checked={d === device} className="seg-btn" data-testid={`device-${d}`} onClick={() => pickDevice(d)}>
                  {DEVICE_ICON[d]}
                  <span>{deviceInfo[d].label}{deviceInfo[d].sub ? <small>{deviceInfo[d].sub}</small> : null}</span>
                </button>
              ))}
            </div>
            <div className="seg seg-look" role="radiogroup" aria-label="Light or dark screens" style={{ "--n": LOOKS.length, "--i": LOOKS.findIndex((l) => l.id === look) }} data-testid="look-switch">
              <span className="seg-thumb" aria-hidden="true" />
              {LOOKS.map((l) => (
                <button key={l.id} type="button" role="radio" aria-checked={l.id === look} className="seg-btn" data-testid={`look-${l.id}`} title={l.id === "auto" ? `Follows your browser (now ${dark ? "dark" : "light"})` : undefined} onClick={() => pickLook(l.id)}>
                  {l.icon}
                  <span>{l.label}</span>
                </button>
              ))}
            </div>
            <p className="shots-hint" data-testid="look-hint" aria-live="polite">
              {look === "auto" ? `Following your browser: ${effective}. The screens change when it does.` : `Showing the ${look} screens, whatever your browser is set to.`}
            </p>
          </div>

          {/* ---- the screens to choose from */}
          <div className="shots-list" ref={listEl} role="tablist" aria-label={`Screens of ${app.code}`} aria-orientation="vertical" onKeyDown={keys}>
            {list.map((s, i) => (
              <button key={s.id} type="button" role="tab" id={`${titleId}-t${i}`} aria-selected={i === index} aria-controls={`${titleId}-panel`} tabIndex={i === index ? 0 : -1} className="shots-tab" data-testid={`shot-tab-${i}`} onClick={() => setActive(i)}>
                <span className="shots-tab-dot" aria-hidden="true" />
                <span className="shots-tab-text">
                  <b>{s.title}</b>
                  <span>{s.caption}</span>
                </span>
              </button>
            ))}
          </div>
          </div>

          {/* ---- the device */}
          <div className="shots-stage" ref={stage} onPointerMove={tilt} onPointerLeave={level} onPointerDown={down} onPointerUp={up} onPointerCancel={() => { drag.current = null; }}>
            <div key={device} className={`dev-wrap dev-wrap-${device}`} data-testid="device">
              <div className={`dev dev-${kind}`} style={{ "--ratio": `${info.width} / ${info.height}` }}>
                <span className="dev-key dev-key-a" aria-hidden="true" />
                <span className="dev-key dev-key-b" aria-hidden="true" />
                {kind === "tablet" ? <span className="dev-cam dev-cam-bezel" aria-hidden="true" /> : null}
                <div className="dev-screen" role="tabpanel" id={`${titleId}-panel`} aria-labelledby={`${titleId}-t${index}`}>
                  {list.filter((s) => seen.has(`${device}:${s.id}`) || s.id === shot.id).map((s) => {
                    const light = s.images[device].light;
                    const darkImg = s.images[device].dark;
                    const on = s.id === shot.id;
                    return (
                      <div key={s.id} className="dev-layer" data-on={on ? "true" : "false"} data-testid={on ? "layer-on" : undefined} aria-hidden={on ? undefined : "true"}>
                        {[["light", light], ["dark", darkImg]].map(([l, img]) =>
                          img ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img key={l} className="dev-img" data-look={l} data-only={light && darkImg ? undefined : "true"} src={img.src} width={img.width || info.width} height={img.height || info.height} alt={on ? altOf(deviceInfo, app, device, l, s) : ""} loading={on ? "eager" : "lazy"} decoding="async" draggable="false" />
                          ) : null,
                        )}
                      </div>
                    );
                  })}
                  {kind === "phone" ? <span className="dev-cam dev-cam-hole" aria-hidden="true" /> : null}
                  <span className="dev-glare" aria-hidden="true" />
                </div>
              </div>
              <span className="dev-floor" aria-hidden="true" />
            </div>

            <p className="shots-cap" aria-hidden="true">{shot.caption}</p>
            <div className="shots-nav">
              <button type="button" className="shots-arrow" aria-label="Previous screen" onClick={() => go(index - 1)} data-testid="shot-prev"><ChevronLeft size={18} aria-hidden="true" /></button>
              <span className="shots-count" aria-live="polite" data-testid="shot-count">{index + 1} <i>/</i> {list.length}</span>
              <button type="button" className="shots-arrow" aria-label="Next screen" onClick={() => go(index + 1)} data-testid="shot-next"><ChevronRight size={18} aria-hidden="true" /></button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
