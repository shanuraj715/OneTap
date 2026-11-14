import Link from "next/link";
import { Check, Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { renderMarkdown } from "@onetap/config-schema";
import { getPricing } from "@/lib/site";
import { ContactForm } from "./ContactForm";
import { Icon } from "./Icon";

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

/** The hero's picture when there's no photo: an order arriving on the pass, drawn in HTML. */
function KitchenTicket() {
  return (
    <div className="pass" aria-hidden="true">
      <span className="chip-float chip-a">
        <span className="dot">
          <Icon name="qr-code" size={13} />
        </span>
        Scanned at Table 5
      </span>
      <div className="ticket">
        <div className="ticket-head">
          <span>KOT #0042</span>
          <span>12:41</span>
        </div>
        <div className="ticket-table">Table 5</div>
        <div className="ticket-meta">Ground floor · 4 guests · Rahul</div>
        <hr />
        <div className="ticket-line">
          <span>2×</span>
          <span>
            Steamed Veg Momos
            <small>Full · Mayo dip · extra cheese</small>
            <small className="ticket-note">“less spicy”</small>
          </span>
        </div>
        <div className="ticket-line" style={{ marginTop: 8 }}>
          <span>1×</span>
          <span>Masala Coke</span>
        </div>
        <hr />
        <div className="ticket-head" style={{ fontWeight: 600 }}>
          <span>3 items</span>
          <span>₹400</span>
        </div>
        <span className="stamp">Sent to kitchen</span>
      </div>
      <span className="chip-float chip-b">
        <span className="dot">
          <Icon name="coins" size={13} />
        </span>
        +40 coins for Rahul
      </span>
    </div>
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
          <article className="card" key={i}>
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
              ) : null}
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
      {s.note ? <p className="pricing-note">{s.note}</p> : null}
    </Wrap>
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
