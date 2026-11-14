import Link from "next/link";
import { Check, Clock, Mail, MapPin, MessageCircle, Minus, Phone } from "lucide-react";
import { FEATURES, renderMarkdown, slugifyHeading } from "@onetap/config-schema";
import { getPricing } from "@/lib/site";
import { ContactForm } from "./ContactForm";
import { Icon } from "./Icon";
import { KitchenTicket, ProductVisual } from "./Mockups";
import { ProductTabs as ProductTabsClient } from "./ProductTabs";

/**
 * One component per section type (SECTION_SCHEMAS in config-schema). All
 * server-rendered: the HTML a search engine reads is the finished page.
 *
 * `h1` is true for the page's first section when the page has no hero — every
 * page gets exactly one <h1>.
 */

/** A button/link: site paths go through next/link, anchors and full URLs stay plain. */
function Btn({ link, variant = "brand", className = "" }) {
  if (!link?.label || !link?.href) return null;
  const cls = `btn btn-${variant} ${className}`.trim();
  if (link.href.startsWith("/") && !link.href.startsWith("//")) {
    return (
      <Link className={cls} href={link.href}>
        {link.label}
      </Link>
    );
  }
  const external = /^https?:\/\//i.test(link.href);
  return (
    <a className={cls} href={link.href} {...(external ? { rel: "noopener", target: "_blank" } : {})}>
      {link.label}
    </a>
  );
}

/** "Orders … *straight to your kitchen.*" — words between asterisks take the brand colour. */
function Emphasis({ text }) {
  const parts = String(text).split(/\*([^*]+)\*/g);
  return parts.map((p, i) => (i % 2 ? <em key={i}>{p}</em> : p));
}

function Head({ eyebrow, heading, intro, h1, fallbackTitle, center }) {
  const H = h1 ? "h1" : "h2";
  const title = heading || (h1 ? fallbackTitle : "");
  if (!eyebrow && !title && !intro) return null;
  return (
    <div className={`section-head${center ? " center" : ""}`}>
      {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
      {title ? (
        <H>
          <Emphasis text={title} />
        </H>
      ) : null}
      {intro ? <p>{intro}</p> : null}
    </div>
  );
}

const Wrap = ({ s, band, children, className = "" }) => (
  <section id={s.anchor || undefined} className={`section${band ? " band" : ""} ${className}`.trim()}>
    <div className="wrap">{children}</div>
  </section>
);

/* ------------------------------------------------------------------ hero */

function Hero({ s }) {
  return (
    <section id={s.anchor || undefined} className="hero">
      <div className="wrap hero-grid">
        <div>
          {s.eyebrow ? <div className="eyebrow">{s.eyebrow}</div> : null}
          <h1>
            <Emphasis text={s.heading} />
          </h1>
          {s.subheading ? <p className="hero-sub">{s.subheading}</p> : null}
          <div className="hero-actions">
            <Btn link={s.primary} />
            <Btn link={s.secondary} variant="ghost" />
          </div>
          {s.note ? (
            <p className="hero-note">
              {s.note.split("·").map((part, i) => (
                <span key={i}>
                  <Check size={15} aria-hidden="true" />
                  {part.trim()}
                </span>
              ))}
            </p>
          ) : null}
          {s.stats.length ? (
            <ul className="stats">
              {s.stats.map((st, i) => (
                <li className="stat" key={i}>
                  <b>{st.value}</b>
                  <span>{st.label}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="hero-media">
          {s.image.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.image.url} alt={s.image.alt || ""} width="1200" height="900" fetchPriority="high" />
          ) : (
            <KitchenTicket />
          )}
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- product */

function ProductTabsSection({ s, h1, page }) {
  const items = s.items.filter((t) => t.label);
  if (!items.length) return null;
  const tabs = items.map((t) => ({ anchor: slugifyHeading(t.label) || "tab", label: t.label, icon: <Icon name={t.icon} size={17} /> }));
  return (
    <Wrap s={s} className="product">
      <Head {...s} h1={h1} fallbackTitle={page.title} center />
      <ProductTabsClient tabs={tabs}>
        {items.map((t, i) => (
          <div className="ptab-grid" key={i}>
            <div className="ptab-copy">
              <h3>{t.heading || t.label}</h3>
              {t.text ? <p>{t.text}</p> : null}
              {t.points.length ? (
                <ul className="ticks">
                  {t.points.filter(Boolean).map((pt, j) => (
                    <li key={j}>
                      <Check size={16} aria-hidden="true" />
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <Btn link={t.button} variant="ghost" />
            </div>
            <div className="ptab-visual">
              {t.image.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.image.url} alt={t.image.alt || ""} loading="lazy" decoding="async" width="1200" height="900" />
              ) : (
                <ProductVisual kind={t.visual} />
              )}
            </div>
          </div>
        ))}
      </ProductTabsClient>
    </Wrap>
  );
}

function Stats({ s, h1, page }) {
  const items = s.items.filter((i) => i.value);
  if (!items.length) return null;
  const H = h1 ? "h1" : "h2";
  return (
    <section id={s.anchor || undefined} className="section">
      <div className="wrap">
        <div className="statband">
          {s.heading || s.eyebrow ? (
            <div className="statband-head">
              {s.eyebrow ? <div className="eyebrow">{s.eyebrow}</div> : null}
              {s.heading ? <H>{s.heading || page.title}</H> : null}
            </div>
          ) : null}
          <ul className="statband-row">
            {items.map((i, n) => (
              <li key={n}>
                <b>{i.value}</b>
                <span>{i.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- content */

function Features({ s, h1, page }) {
  return (
    <Wrap s={s}>
      <Head {...s} h1={h1} fallbackTitle={page.title} />
      <div className="features">
        {s.items.map((f, i) => (
          <div className="feature" key={i}>
            <div className="feature-icon">
              <Icon name={f.icon} />
            </div>
            <h3>{f.title}</h3>
            <p>{f.text}</p>
          </div>
        ))}
      </div>
    </Wrap>
  );
}

function Audience({ s, h1, page }) {
  return (
    <Wrap s={s} band>
      <Head {...s} h1={h1} fallbackTitle={page.title} />
      <div className="cards">
        {s.items.map((a, i) => (
          <article className={`card tone-${i % 4}`} key={i}>
            {a.image.url ? null : (
              <span className="card-icon">
                <Icon name={a.icon} size={22} />
              </span>
            )}
            {a.image.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.image.url} alt={a.image.alt || ""} loading="lazy" decoding="async" width="640" height="400" />
            ) : null}
            <h3>{a.title}</h3>
            <p>{a.text}</p>
          </article>
        ))}
      </div>
    </Wrap>
  );
}

function UseCases({ s, h1, page }) {
  return (
    <Wrap s={s}>
      <Head {...s} h1={h1} fallbackTitle={page.title} />
      <div className="moments">
        {s.items.map((m, i) => (
          <div className="moment" key={i}>
            <span className="moment-icon">
              <Icon name={m.icon} size={19} />
            </span>
            <div>
              <h3>{m.when}</h3>
              <p>{m.text}</p>
            </div>
          </div>
        ))}
      </div>
    </Wrap>
  );
}

function Logos({ s, h1, page }) {
  if (!s.items.length) return null;
  return (
    <section id={s.anchor || undefined} className="section">
      <div className="wrap">
        <div className="logos-band">
          {h1 ? <h1 style={{ fontSize: 20 }}>{s.heading || page.title}</h1> : <p>{s.heading || s.eyebrow}</p>}
          <div className="logos-row center">
            {s.items.map((l, i) => {
              const body = l.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={l.logo} alt={l.name} loading="lazy" decoding="async" width="140" height="36" />
              ) : (
                l.name
              );
              return l.href ? (
                <a key={i} className="logo-item" href={l.href} rel="noopener" target="_blank">
                  {body}
                </a>
              ) : (
                <span key={i} className="logo-item">
                  {body}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function Testimonials({ s, h1, page }) {
  const items = s.items.filter((q) => q.quote);
  if (!items.length) return null;
  return (
    <Wrap s={s} band>
      <Head {...s} h1={h1} fallbackTitle={page.title} />
      <div className="quotes">
        {items.map((q, i) => (
          <figure className="quote" key={i}>
            <blockquote>“{q.quote}”</blockquote>
            <figcaption>
              {q.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={q.photo} alt="" loading="lazy" width="42" height="42" />
              ) : null}
              <div>
                <b>{q.name}</b>
                <span>{[q.role, q.business].filter(Boolean).join(", ")}</span>
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
    </Wrap>
  );
}

async function Pricing({ s, h1, page }) {
  const plans = await getPricing();
  return (
    <Wrap s={s}>
      <Head {...s} h1={h1} fallbackTitle={page.title} center />
      {plans.length ? (
        <div className="plans">
          {plans.map((p) => (
            <article key={p.id} className={`plan${p.highlight ? " pop" : ""}`}>
              {p.highlight ? <span className="plan-badge">Most popular</span> : null}
              <h3>{p.name}</h3>
              {p.price ? (
                <div className="plan-price">
                  <b>{p.price}</b>
                  {p.period ? <span>{p.period}</span> : null}
                </div>
              ) : (
                <div className="plan-price">
                  <b className="on-request">{p.custom ? "Custom pricing" : "Price on request"}</b>
                </div>
              )}
              {p.pitch || p.description ? <p className="plan-pitch">{p.pitch || p.description}</p> : null}
              <ul>
                {p.lines.map((l, i) => (
                  <li key={i}>
                    <Check size={16} aria-hidden="true" />
                    <span>{l}</span>
                  </li>
                ))}
              </ul>
              <Link className={`btn ${p.highlight ? "btn-brand" : "btn-ghost"}`} href={`/contact?plan=${encodeURIComponent(p.name)}`}>
                Talk to us about {p.name}
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-plans">
          <p>Every restaurant is different — tell us about yours and we'll recommend a plan.</p>
          <Link className="btn btn-brand" href="/contact">
            Talk to us
          </Link>
        </div>
      )}
      {plans.length && s.included.filter(Boolean).length ? (
        <div className="included">
          <h3>Every plan includes</h3>
          <ul>
            {s.included.filter(Boolean).map((x, i) => (
              <li key={i}>
                <Check size={16} aria-hidden="true" />
                {x}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {plans.length > 1 && s.compare ? <CompareTable plans={plans} /> : null}
      {s.note ? <p className="pricing-note">{s.note}</p> : null}
    </Wrap>
  );
}

/** Plans side by side, feature by feature — straight from what each plan unlocks. */
function CompareTable({ plans }) {
  const yes = <Check size={18} className="yes" aria-label="Included" />;
  const no = <Minus size={18} className="no" aria-label="Not included" />;
  // a custom plan has nothing fixed — the restaurant chooses each one
  const pick = <span className="pick">Your pick</span>;
  return (
    <div className="compare">
      <h3>Compare plans</h3>
      <div className="compare-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">
                <span className="sr-only">Feature</span>
              </th>
              {plans.map((p) => (
                <th scope="col" key={p.id} className={p.highlight ? "pop" : undefined}>
                  {p.name}
                  <small>{p.price ? `${p.price}${p.period}` : p.custom ? "Custom pricing" : "Price on request"}</small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Outlets</th>
              {plans.map((p) => (
                <td key={p.id}>{p.compare.outlets}</td>
              ))}
            </tr>
            <tr>
              <th scope="row">Staff logins</th>
              {plans.map((p) => (
                <td key={p.id}>{p.compare.staff}</td>
              ))}
            </tr>
            {FEATURES.map((f) => (
              <tr key={f.key}>
                <th scope="row">
                  {f.label}
                  <small>{f.description}</small>
                </th>
                {plans.map((p) => (
                  <td key={p.id}>{p.compare.custom ? pick : p.compare.features.includes(f.key) ? yes : no}</td>
                ))}
              </tr>
            ))}
            <tr>
              <th scope="row">Storefront styles</th>
              {plans.map((p) => (
                <td key={p.id}>{p.compare.custom ? pick : p.compare.styles ? `${p.compare.styles} + classic` : "Classic"}</td>
              ))}
            </tr>
            <tr>
              <th scope="row">Setup by our team</th>
              {plans.map((p) => (
                <td key={p.id}>{yes}</td>
              ))}
            </tr>
            <tr>
              <th scope="row">Commission on orders</th>
              {plans.map((p) => (
                <td key={p.id}>None</td>
              ))}
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td />
              {plans.map((p) => (
                <td key={p.id}>
                  <Link className={`btn btn-sm ${p.highlight ? "btn-brand" : "btn-ghost"}`} href={`/contact?plan=${encodeURIComponent(p.name)}`}>
                    Talk to us
                  </Link>
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function Faq({ s, h1, page }) {
  return (
    <Wrap s={s}>
      <Head {...s} h1={h1} fallbackTitle={page.title} />
      <div className="faq">
        {s.items.map((f, i) => (
          <details key={i}>
            <summary>
              {f.q}
              <i aria-hidden="true" />
            </summary>
            <div>{f.a}</div>
          </details>
        ))}
      </div>
    </Wrap>
  );
}

function Cta({ s, h1, page }) {
  const H = h1 ? "h1" : "h2";
  return (
    <section id={s.anchor || undefined} className="section">
      <div className="wrap">
        <div className="cta">
          <div>
            <H>{s.heading || page.title}</H>
            {s.text ? <p>{s.text}</p> : null}
          </div>
          <Btn link={s.button} variant="light" />
        </div>
      </div>
    </section>
  );
}

function TextSection({ s, h1, page }) {
  const html = renderMarkdown(s.body);
  return (
    <Wrap s={s}>
      <div className="prose">
        {h1 ? <h1 className="page-title">{s.heading || page.title}</h1> : s.heading ? <h2>{s.heading}</h2> : null}
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </Wrap>
  );
}

function ImageText({ s, h1, page }) {
  const H = h1 ? "h1" : "h2";
  return (
    <Wrap s={s}>
      <div className={`split${s.imageSide === "left" ? " left" : ""}`}>
        <div>
          {s.eyebrow ? <div className="eyebrow">{s.eyebrow}</div> : null}
          <H>
            <Emphasis text={s.heading || page.title} />
          </H>
          {s.body ? <div className="prose" dangerouslySetInnerHTML={{ __html: renderMarkdown(s.body) }} /> : null}
          {s.button?.label ? (
            <div style={{ marginTop: 24 }}>
              <Btn link={s.button} />
            </div>
          ) : null}
        </div>
        <div className="split-media">
          {s.image.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.image.url} alt={s.image.alt || ""} loading="lazy" decoding="async" width="1200" height="900" />
          ) : (
            <KitchenTicket />
          )}
        </div>
      </div>
    </Wrap>
  );
}

async function Contact({ s, h1, page, settings }) {
  const plans = await getPricing();
  const c = settings.contact;
  const wa = c.whatsapp.replace(/\D/g, "");
  return (
    <Wrap s={s}>
      <Head {...s} h1={h1} fallbackTitle={page.title} />
      <div className="contact-grid">
        <ContactForm plans={plans.map((p) => p.name)} />
        {s.showDetails && (c.phone || c.email || c.whatsapp || c.address) ? (
          <aside className="details" aria-label="Other ways to reach us">
            {c.phone ? (
              <a href={`tel:${c.phone.replace(/\s/g, "")}`}>
                <i>
                  <Phone size={18} aria-hidden="true" />
                </i>
                <span>
                  <small>Call us</small>
                  <b>{c.phone}</b>
                </span>
              </a>
            ) : null}
            {wa ? (
              <a href={`https://wa.me/${wa.length === 10 ? `91${wa}` : wa}`} rel="noopener" target="_blank">
                <i>
                  <MessageCircle size={18} aria-hidden="true" />
                </i>
                <span>
                  <small>WhatsApp</small>
                  <b>{c.whatsapp}</b>
                </span>
              </a>
            ) : null}
            {c.email ? (
              <a href={`mailto:${c.email}`}>
                <i>
                  <Mail size={18} aria-hidden="true" />
                </i>
                <span>
                  <small>Email</small>
                  <b>{c.email}</b>
                </span>
              </a>
            ) : null}
            {c.address ? (
              <div>
                <i>
                  <MapPin size={18} aria-hidden="true" />
                </i>
                <span>
                  <small>Office</small>
                  <b>{c.address}</b>
                </span>
              </div>
            ) : null}
            {c.hours ? (
              <div>
                <i>
                  <Clock size={18} aria-hidden="true" />
                </i>
                <span>
                  <small>Hours</small>
                  <b>{c.hours}</b>
                </span>
              </div>
            ) : null}
          </aside>
        ) : null}
      </div>
    </Wrap>
  );
}

const RENDERERS = {
  hero: Hero,
  productTabs: ProductTabsSection,
  stats: Stats,
  features: Features,
  audience: Audience,
  useCases: UseCases,
  logos: Logos,
  testimonials: Testimonials,
  pricing: Pricing,
  faq: Faq,
  cta: Cta,
  text: TextSection,
  imageText: ImageText,
  contact: Contact,
};

export function Sections({ page, settings }) {
  const hasHero = page.sections.some((s) => s.type === "hero");
  return page.sections.map((s, i) => {
    const R = RENDERERS[s.type];
    if (!R) return null;
    return <R key={s.id} s={s} page={page} settings={settings} h1={!hasHero && i === 0} />;
  });
}
