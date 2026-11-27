import shotsByApp from "@/lib/app-shots.json";

/**
 * "See it": real screenshots of an app on a tablet, in an Android tablet frame, one big picture at a time with a row of tabs to switch between them.
 * The tabs are plain radio buttons + labels switched by CSS, so it works with no script at all (and with the keyboard: arrow keys move
 * between the tabs). The pictures are taken from the real apps by mobile-apps/screenshots/capture.mjs, which also writes the list this reads
 * (src/lib/app-shots.json) and the images (public/app-screens/). An app with no pictures yet shows nothing.
 */
export function AppScreens({ app }) {
  const shots = shotsByApp[app.id] ?? [];
  if (!shots.length) return null;
  const name = `shots-${app.id}`;
  return (
    <section className="section app-screens" id="screens" aria-labelledby={`${name}-title`}>
      <div className="wrap">
        <div className="section-head">
          <span className="eyebrow">See it</span>
          <h2 id={`${name}-title`}>
            {app.code} on a <em>tablet</em>
          </h2>
          <p>Real screens from the app, on an Android tablet. On a phone the same screens fit one panel at a time.</p>
        </div>
        <div className="shots" data-count={shots.length}>
          {shots.map((s, i) => (
            <input key={s.name} type="radio" className="shots-radio" name={name} id={`${name}-${i}`} defaultChecked={i === 0} aria-label={s.title} />
          ))}
          <div className="shots-tabs">
            {shots.map((s, i) => (
              <label key={s.name} htmlFor={`${name}-${i}`} className="shots-tab">
                {s.title}
              </label>
            ))}
          </div>
          <div className="shots-stage">
            {shots.map((s, i) => (
              <figure key={s.name} className="shots-panel">
                {/* an Android tablet, held sideways: the frame is drawn in CSS around the picture (the picture itself is the bare screen) */}
                <div className="tablet">
                  <span className="tablet-btn tablet-btn-vol" aria-hidden="true" />
                  <span className="tablet-btn tablet-btn-power" aria-hidden="true" />
                  <span className="tablet-cam" aria-hidden="true" />
                  <div className="tablet-screen">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/app-screens/${s.file}`} alt={s.alt} width={s.width} height={s.height} loading={i === 0 ? "eager" : "lazy"} decoding="async" />
                  </div>
                </div>
                <figcaption>
                  <b>{s.title}</b>
                  <span>{s.caption}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
