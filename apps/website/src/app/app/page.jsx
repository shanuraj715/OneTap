import { formatBytes } from "@rasoipulse/config-schema";
import { Download, ShieldCheck, Smartphone } from "lucide-react";
import { getAppReleases, getSettings, siteUrl } from "@/lib/site";

// Served from cache, refreshed every 5 minutes — and the moment a version is published, withdrawn or changed in the console.
export const revalidate = 300;

export async function generateMetadata() {
  const settings = await getSettings();
  const base = siteUrl(settings);
  const title = `${settings.brandName} OMA, the staff app`;
  const description = "Download the Rasoi Pulse OMA Android app: take orders at the table from a phone or tablet. Release notes and every version.";
  return {
    title,
    description,
    alternates: { canonical: "/app" },
    // a page for the people who work in a restaurant, not for search results
    robots: { index: false, follow: false },
    openGraph: { type: "website", url: `${base}/app`, siteName: settings.brandName, title, description, locale: "en_IN" },
  };
}

const day = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "");
const lines = (text) => String(text ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

const STEPS = [
  ["Download the file", "Tap the red button. Your phone saves a file called rasoi-pulse-oma… .apk in Downloads."],
  ["Open it and allow the install", "Android asks if this browser may install apps. Allow it for this one time, then tap Install."],
  ["Sign in", "Open Rasoi Pulse OMA and sign in with the account your manager gave you."],
];

export default async function AppPage() {
  const data = await getAppReleases();
  const releases = data?.releases ?? [];
  const latest = data?.latest ?? releases[0] ?? null;
  const older = releases.filter((r) => r.id !== latest?.id);

  return (
    <main id="main" className="app-page">
      <section className="hero">
        <div className="wrap hero-grid">
          <div>
            <span className="eyebrow">For restaurant staff</span>
            <h1>
              Rasoi Pulse <em>OMA</em>
            </h1>
            <p className="hero-sub">
              The order management app for the floor. Take orders at the table from an Android phone or tablet, send them to the kitchen, and keep every table in view.
            </p>
            {latest ? (
              <>
                <div className="hero-actions">
                  <a className="btn btn-brand" href={latest.downloadUrl} download>
                    <Download size={18} aria-hidden="true" /> Download {latest.version}
                  </a>
                  <a className="btn btn-ghost" href="#install">
                    How to install
                  </a>
                </div>
                <ul className="app-facts">
                  <li>
                    <Smartphone size={16} aria-hidden="true" /> Android 11 or newer · phones and tablets
                  </li>
                  <li>
                    <Download size={16} aria-hidden="true" /> {formatBytes(latest.size)} · released {day(latest.publishedAt)}
                  </li>
                </ul>
              </>
            ) : (
              <p className="app-none">
                {data ? "No version has been published yet." : "The download list can't be reached right now."} Please check again in a little while, or ask your manager.
              </p>
            )}
          </div>

          {latest ? (
            <div className="hero-media" aria-label={`Latest version ${latest.version}`}>
              <div className="ticket">
                <div className="ticket-head">
                  <span>OMA · ANDROID</span>
                  <span>{day(latest.publishedAt)}</span>
                </div>
                <div className="ticket-table app-ticket-version">{latest.version}</div>
                <div className="ticket-meta">
                  latest · {formatBytes(latest.size)}
                </div>
                <hr />
                {lines(latest.notes).length ? (
                  lines(latest.notes)
                    .slice(0, 6)
                    .map((l, i) => (
                      <div key={i} className="ticket-line">
                        <span aria-hidden="true">▸</span>
                        <span>{l}</span>
                      </div>
                    ))
                ) : (
                  <div className="ticket-meta">No release notes for this version.</div>
                )}
                <hr />
                <div className="ticket-meta">SHA-256 {latest.sha256.slice(0, 16)}…</div>
                {latest.force ? <div className="stamp">Required</div> : null}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section className="section band" id="install">
        <div className="wrap">
          <div className="section-head">
            <span className="eyebrow">Install</span>
            <h2>Three steps, about a minute</h2>
            <p>The app isn’t on the Play Store, so it installs from this page. The steps are the same for the first install and for every update.</p>
          </div>
          <ol className="app-steps">
            {STEPS.map(([title, text]) => (
              <li key={title}>
                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section">
        <div className="wrap app-updates">
          <div className="section-head">
            <span className="eyebrow">Updates</span>
            <h2>When a new version is out</h2>
            <p>
              The app checks when it opens. A normal update shows a pop-up with <strong>Update</strong> and <strong>Later</strong>. If a version is marked <strong>Required</strong>, the app stays on an update screen until you install it, because the old version no longer works with the system.
            </p>
          </div>
        </div>
      </section>

      {releases.length ? (
        <section className="section band">
          <div className="wrap">
            <div className="section-head">
              <span className="eyebrow">Versions</span>
              <h2>Every version</h2>
              <p>Need an earlier file, or want to check that your download is genuine? The SHA-256 fingerprint of each file is under it.</p>
            </div>
            <ul className="app-versions">
              {[latest, ...older].map((r, i) => (
                <li key={r.id} className="app-version">
                  <div className="app-version-head">
                    <span className="mono app-version-name">{r.version}</span>
                    {i === 0 ? <span className="app-pill app-pill-brand">Latest</span> : null}
                    {r.force ? <span className="app-pill app-pill-warn">Required</span> : null}
                    <span className="app-version-meta">
                      {day(r.publishedAt)} · {formatBytes(r.size)}
                    </span>
                    <a className="btn btn-ghost btn-sm" href={r.downloadUrl} download>
                      <Download size={15} aria-hidden="true" /> Download
                    </a>
                  </div>
                  {lines(r.notes).length ? (
                    <ul className="app-notes">
                      {lines(r.notes).map((l, j) => (
                        <li key={j}>{l}</li>
                      ))}
                    </ul>
                  ) : null}
                  <details className="app-verify">
                    <summary>
                      <ShieldCheck size={15} aria-hidden="true" /> Check the file
                    </summary>
                    <p className="mono">{r.sha256}</p>
                  </details>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}
    </main>
  );
}
