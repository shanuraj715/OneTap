"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";

/**
 * The enquiry form. Posts to this site's own /api/site/leads (passed through
 * to the API on the server), so nothing about the API's address or CORS ever
 * reaches the browser. A "Talk to us about Pro" link pre-selects the plan
 * through ?plan=. The hidden "website" field is a honeypot — people never see
 * it, bots fill it in.
 */
const EMPTY = { name: "", phone: "", email: "", businessName: "", city: "", outlets: "", plan: "", message: "", website: "" };

export function ContactForm({ plans = [] }) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [state, setState] = useState("idle"); // idle | sending | done | error
  const [message, setMessage] = useState("");

  useEffect(() => {
    const plan = new URLSearchParams(window.location.search).get("plan");
    if (plan) setForm((f) => ({ ...f, plan: plan.slice(0, 60) }));
  }, []);

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
      const res = await fetch("/api/site/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          sourcePage,
          utm,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Something went wrong — please try again, or call us.");
      setState("done");
    } catch (err) {
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
