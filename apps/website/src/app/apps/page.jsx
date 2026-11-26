import Link from "next/link";
import { formatBytes } from "@rasoipulse/config-schema";
import { Download, ShieldCheck, Smartphone } from "lucide-react";
import { appArt, BRAND_TILE, orbitPlace } from "@/lib/app-art";
import { getApps, getSettings, siteUrl } from "@/lib/site";

// Served from cache, refreshed every 5 minutes — and the moment a version is published, withdrawn or changed in the console.
export const revalidate = 300;

export async function generateMetadata() {
  const settings = await getSettings();
  const title = `${settings.brandName} apps for Android`;
  const description = "Rasoi Pulse apps for restaurant teams: take orders at the table, run the kitchen, deliver the food. Download the latest version of each.";
  return { title, description, alternates: { canonical: "/apps" }, robots: { index: false, follow: false }, openGraph: { type: "website", url: `${siteUrl(settings)}/apps`, siteName: settings.brandName, title, description, locale: "en_IN" } };
}

const day = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "");

// Small rings that rise through the hero like steam off a pass: left position (%), size (px), delay (s), duration (s). Pure decoration.
const BUBBLES = [
  { x: 6, s: 10, d: 0, t: 17 }, { x: 14, s: 16, d: 5, t: 21 }, { x: 24, s: 8, d: 9, t: 15 }, { x: 33, s: 13, d: 2, t: 19 },
  { x: 47, s: 9, d: 7, t: 16 }, { x: 58, s: 18, d: 11, t: 23 }, { x: 68, s: 11, d: 3, t: 18 }, { x: 77, s: 8, d: 13, t: 14 },
  { x: 86, s: 15, d: 6, t: 20 }, { x: 94, s: 10, d: 10, t: 17 },
];

/** The moving background of the hero: drifting colour, a slow dotted grid, rising rings and a heartbeat line that draws itself. All aria-hidden, no script. */
function Backdrop() {
  return (
    <div className="apps-bg" aria-hidden="true">
      <span className="apps-blob apps-blob-a" />
      <span className="apps-blob apps-blob-b" />
      <span className="apps-blob apps-blob-c" />
      <span className="apps-dots" />
      <svg className="apps-beat" viewBox="0 0 1200 160" preserveAspectRatio="none" focusable="false">
        <path className="apps-beat-glow" pathLength="1" vectorEffect="non-scaling-stroke" d="M0 92 H360 L392 92 L412 42 L440 140 L470 12 L500 132 L522 92 H1200" />
        <path className="apps-beat-line" pathLength="1" vectorEffect="non-scaling-stroke" d="M0 92 H360 L392 92 L412 42 L440 140 L470 12 L500 132 L522 92 H1200" />
      </svg>
      {BUBBLES.map((b, i) => (
        <i key={i} className="apps-bubble" style={{ "--x": `${b.x}%`, "--s": `${b.s}px`, "--d": `${b.d}s`, "--t": `${b.t}s` }} />
      ))}
    </div>
  );
}

/** The hero's picture: the Rasoi Pulse tile pulsing in the middle, ripples spreading from it and every app's icon floating round it. */
function Orbit({ apps }) {
  const shown = apps.slice(0, 6);
  return (
    <div className="apps-orbit" aria-hidden="true">
      <svg className="apps-orbit-svg" viewBox="0 0 400 400" focusable="false">
        <circle className="apps-ripple apps-ripple-1" cx="200" cy="200" r="64" />
        <circle className="apps-ripple apps-ripple-2" cx="200" cy="200" r="64" />
        <circle className="apps-ripple apps-ripple-3" cx="200" cy="200" r="64" />
        <g className="apps-spin">
          <circle className="apps-ring" cx="200" cy="200" r="144" />
          <circle className="apps-spark apps-spark-1" cx="344" cy="200" r="5" />
          <circle className="apps-spark apps-spark-2" cx="128" cy="324.7" r="4" />
          <circle className="apps-spark apps-spark-3" cx="128" cy="75.3" r="3.5" />
        </g>
      </svg>
      <span className="apps-core">
        <img src={BRAND_TILE} alt="" width="120" height="120" />
      </span>
      {shown.map((a, i) => {
        const p = orbitPlace(i, shown.length);
        return (
          <span key={a.id} className="apps-orb" style={{ left: `${p.x}%`, top: `${p.y}%`, "--i": i, "--app": appArt(a.id).accent }}>
            <span className="apps-orb-float">
              <img src={appArt(a.id).icon} alt="" width="96" height="96" />
            </span>
          </span>
        );
      })}
    </div>
  );
}

export default async function AppsPage() {
  const data = await getApps();
  const apps = data?.apps ?? [];
  return (
    <main id="main" className="app-page">
      <section className="hero apps-hero">
        <Backdrop />
        <div className="wrap apps-hero-grid">
          <div className="apps-hero-copy">
            <span className="eyebrow">Rasoi Pulse apps</span>
            <h1>
              One app for{" "}
              <em>
                each job
                <svg className="apps-scribble" viewBox="0 0 200 14" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                  <path pathLength="1" vectorEffect="non-scaling-stroke" d="M3 9 C 38 2, 72 14, 110 7 S 170 3, 197 8" />
                </svg>
              </em>
            </h1>
            <p className="hero-sub">Every app is for a different person in your restaurant. Choose yours, download it, and sign in with the login your manager gave you. They all need Android 11 or newer.</p>
            <ul className="apps-chips">
              <li><Smartphone size={15} aria-hidden="true" /> Android 11+</li>
              <li><Download size={15} aria-hidden="true" /> No Play Store needed</li>
              <li><ShieldCheck size={15} aria-hidden="true" /> Checksum on every file</li>
            </ul>
          </div>
          {apps.length > 0 ? <Orbit apps={apps} /> : null}
        </div>
      </section>
      <section className="section band apps-band">
        <div className="wrap">
          {apps.length === 0 ? (
            <p className="app-none">The list of apps can&apos;t be reached right now. Please check again in a little while, or ask your manager.</p>
          ) : (
            <ul className="apps-grid">
              {apps.map((a, i) => (
                <li key={a.id} className="apps-card" style={{ "--app": appArt(a.id).accent, "--i": i }}>
                  <div className="apps-card-head">
                    <span className="apps-icon">
                      <img src={appArt(a.id).icon} alt="" width="84" height="84" />
                    </span>
                    <div className="apps-card-id">
                      <span className="apps-code mono">{a.code}</span>
                      <span className="app-pill app-pill-brand apps-tag">{a.tagline}</span>
                    </div>
                  </div>
                  <h2>{a.name}</h2>
                  <p className="apps-for">{a.audience}</p>
                  <p>{a.description}</p>
                  <p className="app-version-meta">
                    {a.latest ? (
                      <>
                        <Smartphone size={15} aria-hidden="true" /> {a.latest.version} · {formatBytes(a.latest.size)} · {day(a.latest.publishedAt)}
                      </>
                    ) : (
                      "No version published yet."
                    )}
                  </p>
                  <div className="hero-actions">
                    {a.latest ? (
                      <a className="btn btn-brand btn-sm" href={a.latest.downloadUrl} download>
                        <Download size={16} aria-hidden="true" /> Download
                      </a>
                    ) : null}
                    <Link className="btn btn-ghost btn-sm" href={a.page}>
                      Details and versions
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
