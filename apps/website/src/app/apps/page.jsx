import Link from "next/link";
import { formatBytes } from "@rasoipulse/config-schema";
import { Download, Smartphone } from "lucide-react";
import { getApps, getSettings, siteUrl } from "@/lib/site";

// Served from cache, refreshed every 5 minutes — and the moment a version is published, withdrawn or changed in the console.
export const revalidate = 300;

export async function generateMetadata() {
  const settings = await getSettings();
  const title = `${settings.brandName} apps for Android`;
  const description = "Rasoi Pulse apps for restaurant teams: take orders at the table, run the kitchen display. Download the latest version of each.";
  return { title, description, alternates: { canonical: "/apps" }, robots: { index: false, follow: false }, openGraph: { type: "website", url: `${siteUrl(settings)}/apps`, siteName: settings.brandName, title, description, locale: "en_IN" } };
}

const day = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "");

export default async function AppsPage() {
  const data = await getApps();
  const apps = data?.apps ?? [];
  return (
    <main id="main" className="app-page">
      <section className="hero">
        <div className="wrap">
          <span className="eyebrow">Rasoi Pulse apps</span>
          <h1>
            One app for <em>each job</em>
          </h1>
          <p className="hero-sub">Every app is for a different person in your restaurant. Choose yours, download it, and sign in with the account your manager gave you. They all need Android 11 or newer.</p>
        </div>
      </section>
      <section className="section band">
        <div className="wrap">
          {apps.length === 0 ? (
            <p className="app-none">The list of apps can&apos;t be reached right now. Please check again in a little while, or ask your manager.</p>
          ) : (
            <ul className="apps-grid">
              {apps.map((a) => (
                <li key={a.id} className="apps-card">
                  <div className="apps-card-head">
                    <span className="apps-code mono">{a.code}</span>
                    <span className="app-pill app-pill-brand">{a.tagline}</span>
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
