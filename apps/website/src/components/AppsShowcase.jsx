import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { appArt } from "@/lib/app-art";
import { getApps } from "@/lib/site";

/** What each app does in an order's journey (an app without a line here shows its own tagline). */
const STEPS = {
  oma: { verb: "Take the order", line: "Waiters, at the table" },
  kda: { verb: "Cook it", line: "Kitchen and bar screens" },
  rda: { verb: "Deliver it", line: "Riders, out the door" },
};

const LOOP = 9; // seconds: the ticket's whole trip (keep in step with `apps-ticket` in globals.css)

/**
 * The homepage's short note about the apps: one line of words and a small animated picture of an order travelling from the waiter's app to the
 * kitchen's to the rider's (a little ticket slides along a dashed line, passing behind each app, and the app lights up as it arrives). No cards
 * and no downloads here — the /apps page has those. Drawn from the same list of apps as that page; when the list can't be reached the section is
 * simply left out. Pure CSS animation; with "reduce motion" the picture stands still.
 */
export async function AppsShowcase() {
  const data = await getApps();
  const apps = data?.apps ?? [];
  if (!apps.length) return null;
  const n = apps.length;
  return (
    <section className="section band apps-show" id="apps" aria-labelledby="apps-show-title">
      <div className="wrap apps-show-inner">
        <div className="apps-show-copy">
          <span className="eyebrow">Apps for your team</span>
          <h2 id="apps-show-title">
            We have <em>apps</em> too
          </h2>
          <p>Along with the ordering page, your waiters, kitchen and riders get their own simple Android apps. They all work on the same orders, live.</p>
          <p className="apps-show-more">
            <Link className="btn btn-ghost" href="/apps">
              See the apps <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </p>
        </div>

        <div className="apps-flow" style={{ "--n": n }} role="img" aria-label={`One order, from app to app: ${apps.map((a) => (STEPS[a.id]?.verb ?? a.tagline).toLowerCase()).join(", then ")}.`}>
          <div className="apps-flow-track" aria-hidden="true">
            <svg className="apps-flow-line" viewBox="0 0 1000 8" preserveAspectRatio="none" focusable="false">
              <line x1="0" y1="4" x2="1000" y2="4" vectorEffect="non-scaling-stroke" />
            </svg>
            {/* the order ticket: it slides out from behind the first app and goes in behind the last */}
            <svg className="apps-flow-ticket" viewBox="0 0 44 54" focusable="false">
              <path d="M4 2h36a2 2 0 0 1 2 2v44l-4-3-4 3-4-3-4 3-4-3-4 3-4-3-4 3V4a2 2 0 0 1 2-2Z" fill="var(--ticket)" stroke="var(--brand)" strokeWidth="2.5" />
              <path d="M10 13h24M10 20h16" stroke="var(--muted)" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M9 33h7l3-7 4 13 3-9 2 3h7" fill="none" stroke="var(--brand)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <ol className="apps-flow-nodes" aria-hidden="true">
            {apps.map((a, i) => {
              const step = STEPS[a.id];
              // the ticket is at this app's middle (4% + 72% of the way along the loop, spread evenly), so its ring starts just before that moment
              const arrives = (0.04 + 0.72 * (n > 1 ? i / (n - 1) : 0)) * LOOP;
              return (
                <li key={a.id} className="apps-flow-node" style={{ "--app": appArt(a.id).accent, "--i": i, "--d": `${(arrives - 0.3).toFixed(2)}s` }}>
                  <span className="apps-flow-icon">
                    <img src={appArt(a.id).icon} alt="" width="88" height="88" />
                  </span>
                  <b>{step?.verb ?? a.tagline}</b>
                  <small>{step?.line ?? a.audience}</small>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
