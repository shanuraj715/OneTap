                                           

                            
                
                    
                    
                   
 

export function Hero({ title, subtitle, ctaLabel, ctaHref }           ) {
  return (
    <section style={wrap}>
      <h1 style={h1}>{title}</h1>
      {subtitle ? <p style={sub}>{subtitle}</p> : null}
      {ctaLabel && ctaHref ? (
        <a href={ctaHref} style={cta}>
          {ctaLabel}
        </a>
      ) : null}
    </section>
  );
}

const wrap                = {
  maxWidth: 1080,
  margin: "0 auto",
  padding: "72px 24px 56px",
  textAlign: "center",
};
const h1                = {
  fontFamily: "var(--font-heading)",
  fontSize: "clamp(2rem, 6vw, 3.25rem)",
  fontWeight: 700,
  letterSpacing: "-0.02em",
  margin: 0,
  color: "var(--color-text)",
};
const sub                = {
  fontSize: 18,
  color: "var(--color-text-muted)",
  maxWidth: "46ch",
  margin: "14px auto 0",
  lineHeight: 1.5,
};
const cta                = {
  display: "inline-block",
  marginTop: 26,
  padding: "12px 24px",
  borderRadius: "var(--radius-card)",
  background: "var(--color-primary)",
  color: "var(--color-on-primary)",
  fontWeight: 600,
  textDecoration: "none",
};
