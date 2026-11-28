import Link from "next/link";
import { formatBytes } from "@rasoipulse/config-schema";
import { Download, Smartphone } from "lucide-react";
import { appArt } from "@/lib/app-art";

const day = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "");

/** One app's card on the /apps page: its icon floating over a glow in the app's own colour, its name, who it is for, its latest version and the download. */
export function AppCard({ app: a, index = 0 }) {
  const art = appArt(a.id, a);
  return (
    <li className="apps-card" style={{ "--app": art.accent, "--i": index }}>
      <div className="apps-card-head">
        <span className="apps-icon">
          <img src={art.icon} alt="" width="84" height="84" />
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
  );
}
