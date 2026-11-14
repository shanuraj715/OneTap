"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";

/**
 * The enquiry form. Posts to this site's own /api/site/leads (passed through
 * to the API on the server), so nothing about the API's address or CORS ever
 * reaches the browser. A "Talk to us about Pro" link pre-selects the plan
 * through ?plan= (and ?billing=yearly says which way they'd pay).
 *
 * Keeping bots out (the rules live in the API's site/guard.js):
 *  - the hidden "website" field is a honeypot — people never see it, bots fill it in;
 *  - as the form opens it fetches a one-time challenge and solves a small
 *    proof-of-work in the background while the visitor types, so a script that
 *    just POSTs the form has nothing to send;
 *  - when Cloudflare Turnstile is set up on the API, its box appears too.
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MIN_FILL_MS = 3200; // the API turns away anything faster than 3s from the form opening
const STALE_MS = 50 * 60 * 1000; // challenges last an hour; get a new one well before

function zeroBits(bytes) {
  let bits = 0;
  for (const b of bytes) {
    if (b === 0) bits += 8;
    else return bits + Math.clz32(b) - 24;
  }
  return bits;
}

/** Find the number that makes SHA-256(token:number) start with `bits` zero bits. A second or two of work. */
async function solve(token, bits) {
  const enc = new TextEncoder();
  const BATCH = 256;
  for (let start = 0; ; start += BATCH) {
    const hashes = await Promise.all(
      Array.from({ length: BATCH }, (_, i) => crypto.subtle.digest("SHA-256", enc.encode(`${token}:${start + i}`))),
    );
    for (let i = 0; i < BATCH; i++) if (zeroBits(new Uint8Array(hashes[i])) >= bits) return String(start + i);
  }
}

let turnstileScript;
/** Cloudflare's widget script, loaded once and only when the API asks for it. */
function loadTurnstile() {
  turnstileScript ??= new Promise((resolve, reject) => {
    const el = document.createElement("script");
    el.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    el.async = true;
    el.onload = () => resolve(window.turnstile);
    el.onerror = () => {
      turnstileScript = undefined;
      reject(new Error("turnstile"));
    };
    document.head.appendChild(el);
  });
  return turnstileScript;
}

const EMPTY = { name: "", phone: "", email: "", businessName: "", city: "", outlets: "", plan: "", message: "", website: "" };

export function ContactForm({ plans = [] }) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [state, setState] = useState("idle"); // idle | sending | done | error
  const [message, setMessage] = useState("");
  const [billing, setBilling] = useState("");
  const [siteKey, setSiteKey] = useState("");
  const guard = useRef({ promise: null, token: "", nonce: "", at: 0 });
  const box = useRef(null);
  const widget = useRef(null);
  const turnstileToken = useRef("");

  // Fetch a challenge and solve it, in the background. Resolves with what the API needs to see.
  const prepare = useCallback(() => {
    const g = guard.current;
    g.promise = (async () => {
      const res = await fetch("/api/site/challenge", { cache: "no-store" });
      const c = await res.json();
      if (!res.ok) throw new Error(c.error ?? "challenge");
      g.token = c.token;
      g.at = Date.now();
      g.nonce = await solve(c.token, c.bits);
      if (c.turnstileSiteKey) setSiteKey(c.turnstileSiteKey);
      return g;
    })();
    g.promise.catch(() => {});
    return g.promise;
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const plan = params.get("plan");
    if (plan) setForm((f) => ({ ...f, plan: plan.slice(0, 60) }));
    if (params.get("billing") === "yearly") setBilling("yearly");
    prepare();
  }, [prepare]);

  // Cloudflare's "are you a person" box, when the API has it switched on
  useEffect(() => {
    if (!siteKey || !box.current) return undefined;
    let cancelled = false;
    loadTurnstile()
      .then((turnstile) => {
        if (cancelled || !box.current || widget.current !== null) return;
        widget.current = turnstile.render(box.current, {
          sitekey: siteKey,
          callback: (t) => (turnstileToken.current = t),
          "expired-callback": () => (turnstileToken.current = ""),
          "error-callback": () => (turnstileToken.current = ""),
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [siteKey]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const validate = () => {
    const e = {};
    if (form.name.trim().length < 2) e.name = "Tell us your name.";
    if (form.phone.replace(/\D/g, "").length < 10) e.phone = "Enter a phone number we can call.";
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = "That email doesn't look right.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    if (siteKey && !turnstileToken.current) {
      setMessage("Please tick the box to show you're a person, then send again.");
      setState("error");
      return;
    }
    setState("sending");
    const params = new URLSearchParams(window.location.search);
    // the page they were on before this one (see Trail), else where the browser says they came from
    let sourcePage = window.location.pathname;
    let utm = { source: params.get("utm_source") ?? "", medium: params.get("utm_medium") ?? "", campaign: params.get("utm_campaign") ?? "" };
    try {
      const prev = sessionStorage.getItem("tp.prev");
      const ref = document.referrer ? new URL(document.referrer) : null;
      if (prev) sourcePage = prev;
      else if (ref && ref.origin === window.location.origin) sourcePage = ref.pathname;
      else if (ref) sourcePage = ref.href.slice(0, 200);
      if (!utm.source) utm = JSON.parse(sessionStorage.getItem("tp.utm") ?? "null") ?? utm;
    } catch {
      /* no usable trail */
    }
    try {
      // make sure there's a solved, fresh challenge — normally it finished while they were typing
      let g = guard.current;
      if (!g.promise || (g.at && Date.now() - g.at > STALE_MS)) await prepare();
      try {
        g = await guard.current.promise;
      } catch {
        g = await prepare();
      }
      const wait = MIN_FILL_MS - (Date.now() - g.at);
      if (wait > 0) await sleep(wait);

      const res = await fetch("/api/site/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          plan: billing === "yearly" && form.plan ? `${form.plan} (yearly)`.slice(0, 60) : form.plan,
          sourcePage,
          utm,
          challenge: { token: g.token, nonce: g.nonce },
          turnstile: turnstileToken.current,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Something went wrong — please try again, or call us.");
      setState("done");
    } catch (err) {
      // a challenge and a Turnstile answer each work once — get fresh ones for the next try
      prepare();
      turnstileToken.current = "";
      if (widget.current !== null) window.turnstile?.reset(widget.current);
      setMessage(err.message);
      setState("error");
    }
  };

  if (state === "done") {
    return (
      <div className="form-done" role="status">
        <span className="tick">
          <Check size={28} aria-hidden="true" />
        </span>
        <h2 style={{ fontSize: 26 }}>Thanks, {form.name.trim().split(" ")[0]}!</h2>
        <p style={{ color: "var(--muted)", maxWidth: 420 }}>
          We've got your details and will call you on {form.phone.trim()} to set up a demo with your own menu.
        </p>
      </div>
    );
  }

  return (
    <form className="form" onSubmit={submit} noValidate>
      <Field id="name" label="Your name" error={errors.name}>
        <input id="name" name="name" autoComplete="name" value={form.name} onChange={set("name")} required aria-invalid={Boolean(errors.name)} />
      </Field>
      <Field id="phone" label="Phone" error={errors.phone}>
        <input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={set("phone")} required aria-invalid={Boolean(errors.phone)} />
      </Field>
      <Field id="email" label="Email" optional error={errors.email}>
        <input id="email" name="email" type="email" autoComplete="email" value={form.email} onChange={set("email")} aria-invalid={Boolean(errors.email)} />
      </Field>
      <Field id="businessName" label="Restaurant name" optional>
        <input id="businessName" name="businessName" autoComplete="organization" value={form.businessName} onChange={set("businessName")} />
      </Field>
      <Field id="city" label="City" optional>
        <input id="city" name="city" autoComplete="address-level2" value={form.city} onChange={set("city")} />
      </Field>
      <Field id="outlets" label="How many outlets?" optional>
        <select id="outlets" name="outlets" value={form.outlets} onChange={set("outlets")}>
          <option value="">Choose…</option>
          <option value="1">1</option>
          <option value="2-3">2–3</option>
          <option value="4-10">4–10</option>
          <option value="10+">More than 10</option>
        </select>
      </Field>
      {plans.length ? (
        <Field id="plan" label="Plan you're interested in" optional full>
          <select id="plan" name="plan" value={form.plan} onChange={set("plan")}>
            <option value="">Not sure yet</option>
            {plans.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
            {form.plan && !plans.includes(form.plan) ? <option value={form.plan}>{form.plan}</option> : null}
          </select>
        </Field>
      ) : null}
      <Field id="message" label="Anything we should know?" optional full>
        <textarea id="message" name="message" value={form.message} onChange={set("message")} placeholder="Your menu size, how you take orders today, when you'd like to start…" />
      </Field>
      <div className="hp" aria-hidden="true">
        <label htmlFor="website">Leave this empty</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set("website")} />
      </div>
      {siteKey ? <div ref={box} className="field full" /> : null}
      <div className="form-foot full">
        <small>We'll only use your details to reply to you. There's nothing to pay online.</small>
        <button className="btn btn-brand" type="submit" disabled={state === "sending"}>
          {state === "sending" ? "Sending…" : "Send — we'll call you"}
        </button>
      </div>
      {state === "error" ? (
        <p className="form-error full" role="alert">
          {message}
        </p>
      ) : null}
    </form>
  );
}

function Field({ id, label, optional, error, full, children }) {
  return (
    <div className={`field${full ? " full" : ""}`}>
      <label htmlFor={id}>
        {label} {optional ? <span>(optional)</span> : null}
      </label>
      {children}
      {error ? (
        <span className="err" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
