
const shell                = {
  borderTop: "1px solid var(--color-border)",
  background: "var(--color-surface)",
  marginTop: 64,
};
const inner                = { maxWidth: 1080, margin: "0 auto", padding: "28px 24px", fontSize: 13 };
const brand                = {
  fontFamily: "var(--font-heading)",
  fontWeight: 600,
  color: "var(--color-text)",
  marginBottom: 6,
};
const muted                = { color: "var(--color-text-muted)", lineHeight: 1.7 };
const colTitle                = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--color-text)",
  marginBottom: 8,
};

function Licences({ fssaiLicense, gstin }                                             )            {
  return (
    <>
      {fssaiLicense ? <div style={muted}>FSSAI Lic. No. {fssaiLicense}</div> : null}
      {gstin ? <div style={muted}>GSTIN {gstin}</div> : null}
    </>
  );
}

/* 1 ─ two columns: contact left, licences right */
export function FooterTwoColumn(p             ) {
  return (
    <footer style={shell}>
      <div style={{ ...inner, display: "flex", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
        <div>
          <div style={brand}>{p.name}</div>
          {p.address ? <div style={muted}>{p.address}</div> : null}
          {p.phone ? <div style={muted}>{p.phone}</div> : null}
        </div>
        <div style={{ textAlign: "right" }}>
          <Licences fssaiLicense={p.fssaiLicense} gstin={p.gstin} />
          <div style={{ ...muted, marginTop: 8 }}>Powered by TablePe</div>
        </div>
      </div>
    </footer>
  );
}

/* 2 ─ everything centred */
export function FooterCentered(p             ) {
  return (
    <footer style={shell}>
      <div style={{ ...inner, textAlign: "center" }}>
        <div style={{ ...brand, fontSize: 17, marginBottom: 10 }}>{p.name}</div>
        {p.address ? <div style={muted}>{p.address}</div> : null}
        {p.phone ? <div style={muted}>{p.phone}</div> : null}
        <div
          style={{
            margin: "16px auto 0",
            paddingTop: 14,
            borderTop: "1px solid var(--color-border)",
            maxWidth: 460,
          }}
        >
          <Licences fssaiLicense={p.fssaiLicense} gstin={p.gstin} />
          <div style={{ ...muted, marginTop: 6 }}>Powered by TablePe</div>
        </div>
      </div>
    </footer>
  );
}

/* 3 ─ three columns */
export function FooterColumns(p             ) {
  return (
    <footer style={shell}>
      <div
        style={{
          ...inner,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 28,
          paddingTop: 34,
          paddingBottom: 34,
        }}
      >
        <div>
          <div style={{ ...brand, fontSize: 16 }}>{p.name}</div>
          <div style={muted}>Momos, made fresh through the day.</div>
        </div>
        <div>
          <div style={colTitle}>Visit</div>
          {p.address ? <div style={muted}>{p.address}</div> : null}
          <div style={muted}>{p.hours ?? "12:00 pm – 10:00 pm"}</div>
        </div>
        <div>
          <div style={colTitle}>Contact</div>
          {p.phone ? <div style={muted}>{p.phone}</div> : null}
        </div>
        <div>
          <div style={colTitle}>Legal</div>
          <Licences fssaiLicense={p.fssaiLicense} gstin={p.gstin} />
          <div style={{ ...muted, marginTop: 6 }}>Powered by TablePe</div>
        </div>
      </div>
    </footer>
  );
}

/* 4 ─ single compact bar */
export function FooterMinimalBar(p             ) {
  const bits = [p.name, p.phone, p.fssaiLicense ? `FSSAI ${p.fssaiLicense}` : null, p.gstin ? `GSTIN ${p.gstin}` : null]
    .filter(Boolean)
    .join("  ·  ");
  return (
    <footer style={{ ...shell, marginTop: 48 }}>
      <div style={{ ...inner, padding: "16px 24px", display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <span style={muted}>{bits}</span>
        <span style={muted}>Powered by TablePe</span>
      </div>
    </footer>
  );
}

/* 5 ─ oversized brand name above the details */
export function FooterBrandBlock(p             ) {
  return (
    <footer style={shell}>
      <div style={inner}>
        <div style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "clamp(1.8rem, 6vw, 3rem)", letterSpacing: "-0.02em", color: "var(--color-text)", lineHeight: 1 }}>
          {p.name}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 20, flexWrap: "wrap", marginTop: 20, paddingTop: 18, borderTop: "1px solid var(--color-border)" }}>
          <div>
            {p.address ? <div style={muted}>{p.address}</div> : null}
            {p.phone ? <div style={muted}>{p.phone}</div> : null}
          </div>
          <div style={{ textAlign: "right" }}>
            <Licences fssaiLicense={p.fssaiLicense} gstin={p.gstin} />
          </div>
        </div>
      </div>
    </footer>
  );
}

/* 6 ─ inverted bar */
export function FooterInverted(p             ) {
  return (
    <footer style={{ ...shell, background: "var(--color-text)", borderTop: "none" }}>
      <div style={{ ...inner, color: "var(--color-bg)", display: "flex", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
        <div>
          <div style={{ ...brand, color: "var(--color-bg)" }}>{p.name}</div>
          {p.address ? <div style={{ ...muted, color: "var(--color-bg)", opacity: 0.7 }}>{p.address}</div> : null}
          {p.phone ? <div style={{ ...muted, color: "var(--color-bg)", opacity: 0.7 }}>{p.phone}</div> : null}
        </div>
        <div style={{ textAlign: "right", opacity: 0.7 }}>
          {p.fssaiLicense ? <div style={{ ...muted, color: "var(--color-bg)" }}>FSSAI Lic. No. {p.fssaiLicense}</div> : null}
          {p.gstin ? <div style={{ ...muted, color: "var(--color-bg)" }}>GSTIN {p.gstin}</div> : null}
          <div style={{ ...muted, color: "var(--color-bg)", marginTop: 8 }}>Powered by TablePe</div>
        </div>
      </div>
    </footer>
  );
}

/* 7 ─ hours and contact given equal weight */
export function FooterContact(p             ) {
  return (
    <footer style={shell}>
      <div style={{ ...inner, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 24, paddingTop: 32, paddingBottom: 32 }}>
        <div>
          <div style={colTitle}>Find us</div>
          {p.address ? <div style={muted}>{p.address}</div> : null}
        </div>
        <div>
          <div style={colTitle}>Open</div>
          <div style={muted}>{p.hours ?? "12:00 pm – 10:00 pm, daily"}</div>
        </div>
        <div>
          <div style={colTitle}>Call</div>
          {p.phone ? <div style={muted}>{p.phone}</div> : null}
        </div>
        <div>
          <div style={colTitle}>Licences</div>
          <Licences fssaiLicense={p.fssaiLicense} gstin={p.gstin} />
        </div>
      </div>
      <div style={{ borderTop: "1px solid var(--color-border)" }}>
        <div style={{ ...inner, padding: "12px 24px", textAlign: "center" }}>
          <span style={muted}>{p.name} · Powered by TablePe</span>
        </div>
      </div>
    </footer>
  );
}

/* 8 ─ with a newsletter sign-up */
export function FooterNewsletter(p             ) {
  return (
    <footer style={shell}>
      <div style={{ ...inner, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 26, paddingTop: 30, paddingBottom: 26 }}>
        <div>
          <div style={{ ...brand, fontSize: 16 }}>{p.name}</div>
          {p.address ? <div style={muted}>{p.address}</div> : null}
          {p.phone ? <div style={muted}>{p.phone}</div> : null}
        </div>
        <div>
          <div style={colTitle}>Offers by email</div>
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            <span style={{ flex: 1, minWidth: 0, border: "1px solid var(--color-border)", borderRadius: 8, padding: "8px 10px", color: "var(--color-text-muted)", background: "var(--color-bg)" }}>
              you@example.com
            </span>
            <span style={{ background: "var(--color-primary)", color: "var(--color-on-primary)", borderRadius: 8, padding: "8px 14px", fontWeight: 600 }}>Join</span>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <Licences fssaiLicense={p.fssaiLicense} gstin={p.gstin} />
          <div style={{ ...muted, marginTop: 8 }}>Powered by TablePe</div>
        </div>
      </div>
    </footer>
  );
}
