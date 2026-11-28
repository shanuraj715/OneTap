import { Download, ShieldCheck, Smartphone } from "lucide-react";
import { AppCard } from "@/components/AppCard";
import { AppsBackdrop } from "@/components/AppsBackdrop";
import { AppsCardsBackdrop } from "@/components/AppsCardsBackdrop";
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
          <span key={a.id} className="apps-orb" style={{ left: `${p.x}%`, top: `${p.y}%`, "--i": i, "--app": appArt(a.id, a).accent }}>
            <span className="apps-orb-float">
              <img src={appArt(a.id, a).icon} alt="" width="96" height="96" />
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
        <AppsBackdrop />
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
        <AppsCardsBackdrop apps={apps} />
        <div className="wrap">
          {apps.length === 0 ? (
            <p className="app-none">The list of apps can&apos;t be reached right now. Please check again in a little while, or ask your manager.</p>
          ) : (
            <ul className="apps-grid" data-count={apps.length}>
              {apps.map((a, i) => (
                <AppCard key={a.id} app={a} index={i} />
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
