"use client";

import { useEffect, useRef, useState } from "react";
import { CUSTOMER_AGE_MAX, CUSTOMER_AGE_MIN, CUSTOMER_GENDER_LABELS, CUSTOMER_GENDERS } from "@onetap/config-schema";
import { Calendar, Check, Loader2, LogIn, Mail, Phone, ShieldCheck, User } from "lucide-react";
import { api, apiPatch } from "@/lib/clientApi";

const DRAFT_KEY = "onetap.customerDraft";
const RESEND_COOLDOWN_SEC = 30;

/** Remembers what a returning visitor typed last time, on this device only — never sent anywhere until they submit. */
function loadDraft() {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "{}");
  } catch {
    return {};
  }
}
function saveDraft(d) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch {
    /* not fatal */
  }
}

/**
 * Stands between "click the cart" and "see your order" for anyone not signed
 * in, and reappears (in a shorter form) for a session that predates gender
 * and age.
 *
 * A two-step form either way, tracked against the four-stage journey above:
 *  1. Name and mobile number — enough to send and check a code. A brand-new
 *     account is created right after the code checks out, holding just the
 *     name; gender and age are deliberately NOT collected here, so this step
 *     stays exactly two fields.
 *  2. Whatever the account still lacks — gender and age for a fresh signup,
 *     or just whichever field an old session (from before this feature)
 *     predates. Both cases render identically, through `activeCustomer`:
 *     either the `customer` prop (an existing session) or `verifiedCustomer`
 *     (the account this component itself just created in step 1). A
 *     returning customer whose profile is already complete never sees step 2
 *     at all — `verify` sends them straight through.
 *
 * The verified phone (or email, for a legacy email-only account) is shown
 * read-only in step 2 — changing it would mean re-proving ownership of a
 * different number, which is a sign-out, not a field edit. Step 1's fields
 * are pre-filled from what this device typed last time (`loadDraft`), never
 * from anything sent to the server.
 */
export function CustomerGate({ customer, outletId, onSuccess }) {
  const [destination, setDestination] = useState("");
  const [name, setName] = useState(customer?.name ?? "");
  const [gender, setGender] = useState(customer?.gender ?? "");
  const [age, setAge] = useState(customer?.age ? String(customer.age) : "");
  const [email, setEmail] = useState(customer?.email ?? "");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  // What step 1 itself just created — null until `verify` succeeds. Once
  // set, it is treated exactly like the `customer` prop for the rest of this
  // component's life, so step 2 renders the same way regardless of which
  // door the visitor came in through.
  const [verifiedCustomer, setVerifiedCustomer] = useState(null);

  const activeCustomer = customer ?? verifiedCustomer;
  const isCompletion = Boolean(activeCustomer);

  // A returning visitor on the same device/browser doesn't retype step 1 —
  // this is a convenience only, never a substitute for the OTP.
  useEffect(() => {
    if (customer) return;
    const draft = loadDraft();
    if (draft.destination) setDestination(draft.destination);
    if (draft.name) setName(draft.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // One ticker for the resend cooldown, for the life of the component.
  useEffect(() => {
    const t = setInterval(() => setResendCooldown((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);

  const needsName = !activeCustomer?.name;
  const needsGender = !activeCustomer?.gender;
  const needsAge = !activeCustomer?.age;
  // Email is always optional, and step 2 never re-asks for it once set.
  const needsEmail = !activeCustomer?.email;

  const detailsValid = name.trim().length > 0 && destination.replace(/\D/g, "").length === 10;
  const ageValid = !needsAge || (age && Number(age) >= CUSTOMER_AGE_MIN && Number(age) <= CUSTOMER_AGE_MAX);
  const profileValid = (!needsName || name.trim().length > 0) && (!needsGender || gender) && ageValid;

  // The verified identity shown (read-only) in step 2 — a legacy account
  // created by email rather than phone still has something to show.
  const verifiedIdentity = activeCustomer?.phone ?? activeCustomer?.email ?? null;
  const verifiedIsPhone = Boolean(activeCustomer?.phone);

  const run = async (fn) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const requestCode = () =>
    run(async () => {
      if (!detailsValid) throw new Error("Enter your name and a 10-digit mobile number");
      const r = await api("/api/customer/otp/request", { outletId, destination });
      setSent(true);
      setCode("");
      setDevCode(r.devCode ?? null);
      setResendCooldown(RESEND_COOLDOWN_SEC);
      saveDraft({ destination, name: name.trim() });
    });

  const verify = () =>
    run(async () => {
      const r = await api("/api/customer/otp/verify", { outletId, destination, code, name: name.trim() });
      // A returning customer whose profile is already complete skips step 2
      // entirely — only a fresh signup, or an old session missing a field,
      // ever sees it.
      if (r.customer.profileComplete) onSuccess();
      else setVerifiedCustomer(r.customer);
    });

  const completeProfile = () =>
    run(async () => {
      if (!profileValid) throw new Error("Fill in the missing details first");
      await apiPatch("/api/customer/profile", {
        name: needsName ? name.trim() : undefined,
        gender: needsGender ? gender : undefined,
        age: needsAge ? Number(age) : undefined,
        email: needsEmail && email.trim() ? email.trim() : undefined,
      });
      onSuccess();
    });

  const useDifferentNumber = () => {
    setSent(false);
    setCode("");
    setDevCode(null);
    setResendCooldown(0);
    setError(null);
  };

  const step = isCompletion ? "profile" : sent ? "otp" : "details";
  const submit = isCompletion ? completeProfile : sent ? verify : requestCode;
  const submitDisabled =
    busy || (isCompletion ? !profileValid : sent ? code.length !== 6 : !detailsValid);

  return (
    <div style={shell}>
      <div style={card} className="ot-anim-pop">
        <div style={iconBadge}>{isCompletion ? <User size={22} /> : <LogIn size={22} />}</div>

        <h1 style={title}>{isCompletion ? "Just a couple more details" : sent ? "Enter the code" : "Sign in to order"}</h1>
        <p style={subtitle}>
          {isCompletion
            ? "We use this to personalise your account and your coin rewards."
            : sent
              ? `We sent a 6-digit code to ${destination}.`
              : "Your name and number — then you can apply coupons and redeem coins on every order."}
        </p>

        <div key={step} className="ot-swap">
          {isCompletion ? (
            <>
              {verifiedIdentity ? (
                <Field label={verifiedIsPhone ? "Mobile number" : "Email"}>
                  <div style={verifiedChip}>
                    {verifiedIsPhone ? <Phone size={16} style={verifiedChipIcon} /> : <Mail size={16} style={verifiedChipIcon} />}
                    <span style={{ flex: 1 }}>{verifiedIdentity}</span>
                    <span style={verifiedBadge}>
                      <Check size={11} /> Verified
                    </span>
                  </div>
                </Field>
              ) : null}

              {needsName ? (
                <Field label="Your name">
                  <IconInput icon={User} value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" autoFocus aria-label="Your name" />
                </Field>
              ) : null}

              {needsGender ? (
                <Field label="Gender">
                  <div style={segmented} role="group" aria-label="Gender">
                    {CUSTOMER_GENDERS.map((g) => (
                      <button
                        key={g}
                        type="button"
                        className="ot-press"
                        onClick={() => setGender(g)}
                        style={{ ...segmentBtn, ...(gender === g ? segmentBtnActive : {}) }}
                      >
                        {gender === g ? <Check size={13} style={{ marginRight: 5, verticalAlign: -2 }} /> : null}
                        {CUSTOMER_GENDER_LABELS[g]}
                      </button>
                    ))}
                  </div>
                </Field>
              ) : null}

              {needsAge ? (
                <Field label="Age">
                  <IconInput
                    icon={Calendar}
                    type="number"
                    inputMode="numeric"
                    min={CUSTOMER_AGE_MIN}
                    max={CUSTOMER_AGE_MAX}
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="e.g. 27"
                    aria-label="Age"
                  />
                </Field>
              ) : null}

              {needsEmail ? (
                <Field label="Email" hint="Optional — for order receipts">
                  <IconInput
                    icon={Mail}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    aria-label="Email"
                  />
                </Field>
              ) : null}
            </>
          ) : !sent ? (
            <>
              <Field label="Your name">
                <IconInput icon={User} value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" autoFocus aria-label="Your name" />
              </Field>
              <Field label="Mobile number">
                <div style={inputWrap}>
                  <span style={prefixChip}>+91</span>
                  <input
                    style={{ ...input, paddingLeft: 58 }}
                    type="tel"
                    inputMode="numeric"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    placeholder="9810000000"
                    maxLength={10}
                    aria-label="Mobile number"
                  />
                </div>
              </Field>
            </>
          ) : (
            <Field label="6-digit code">
              <OtpInput value={code} onChange={setCode} error={Boolean(error)} />
              {devCode ? (
                <p style={{ ...devHint, cursor: "pointer" }} onClick={() => setCode(devCode)} title="Click to fill code">
                  No SMS provider configured yet — dev code: <strong>{devCode}</strong>
                </p>
              ) : null}
            </Field>
          )}
        </div>

        {error ? <p style={errorBox}>{error}</p> : null}

        <button type="button" className="ot-press" style={primaryBtn} disabled={submitDisabled} onClick={submit}>
          {busy ? (
            <Loader2 size={16} className="ot-spin" style={{ verticalAlign: -3, marginRight: 7 }} />
          ) : null}
          {busy ? "Please wait…" : isCompletion ? "Save and continue" : sent ? "Verify code" : "Send code"}
        </button>

        {step === "otp" ? (
          <div style={linkRow}>
            <button type="button" style={linkBtn} onClick={useDifferentNumber}>
              Use a different number
            </button>
            <button
              type="button"
              style={{ ...linkBtn, ...(resendCooldown > 0 ? linkBtnDisabled : {}) }}
              disabled={resendCooldown > 0 || busy}
              onClick={requestCode}
            >
              {resendCooldown > 0 ? `Resend code (${resendCooldown}s)` : "Resend code"}
            </button>
          </div>
        ) : null}

        <p style={trustNote}>
          <ShieldCheck size={13} style={{ verticalAlign: -2, marginRight: 4 }} />
          Used only to verify your order and your coin wallet.
        </p>
      </div>
    </div>
  );
}

/**
 * A `<div>`, not a `<label>` — `Field` also wraps the gender picker's three
 * separate buttons, and a native `<label>` is only valid around exactly one
 * form control. Wrapping several confuses assistive tech and, in practice,
 * pulled sibling button text into each button's own accessible name.
 */
function Field({ label, hint, children }) {
  return (
    <div style={fieldWrap}>
      <span style={fieldLabel}>
        {label}
        {hint ? <span style={fieldHint}> · {hint}</span> : null}
      </span>
      {children}
    </div>
  );
}

/** A text input with a small leading icon — used for every field except the phone number, which gets a "+91" chip instead. */
function IconInput({ icon: Icon, style, ...props }) {
  return (
    <div style={inputWrap}>
      <Icon size={16} style={inputIcon} />
      <input {...props} style={{ ...input, paddingLeft: 38, ...style }} />
    </div>
  );
}

/**
 * Six single-digit boxes rather than one plain field.
 *
 * Handles the two real ways a code arrives: typed one digit at a time (each
 * box auto-advances, backspace on an empty box steps back), or delivered all
 * at once — a paste, or a phone's own SMS-autofill suggestion, which lands
 * the whole code in whichever box has focus. `maxLength` is deliberately NOT
 * set as an HTML attribute: the browser would clip an autofilled or pasted
 * multi-character value to 1 char before this component ever saw it, which
 * is exactly the case that matters most for a real phone.
 */
function OtpInput({ value, onChange, error }) {
  const refs = useRef([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? "");

  const setDigits = (next) => onChange(next.join("").slice(0, 6));

  const handleChange = (i, raw) => {
    const v = raw.replace(/\D/g, "");
    if (!v) {
      const next = digits.slice();
      next[i] = "";
      setDigits(next);
      return;
    }
    // One or more digits landed in this box at once (paste, or SMS autofill).
    const chars = v.slice(0, 6 - i).split("");
    const next = digits.slice();
    chars.forEach((c, k) => {
      next[i + k] = c;
    });
    setDigits(next);
    const last = Math.min(i + chars.length, 5);
    refs.current[last]?.focus();
  };

  const handleKeyDown = (i, e) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      const next = digits.slice();
      next[i - 1] = "";
      setDigits(next);
      refs.current[i - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!text) return;
    e.preventDefault();
    setDigits(text.split(""));
    refs.current[Math.min(text.length, 6) - 1]?.focus();
  };

  return (
    <div style={otpRow} onPaste={handlePaste}>
      {digits.map((d, i) => (
        <input
          // eslint-disable-next-line react/no-array-index-key
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={d}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          autoFocus={i === 0}
          aria-label={`Digit ${i + 1} of 6`}
          style={{ ...otpBox, ...(d ? otpBoxFilled : {}), ...(error ? otpBoxError : {}) }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------- styles */

const shell = {
  minHeight: "calc(100dvh - 40px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px 16px",
};
const card = {
  width: "100%",
  maxWidth: 400,
  background: "var(--color-bg)",
  border: "1px solid var(--color-border)",
  borderTop: "3px solid var(--color-primary)",
  borderRadius: "calc(var(--radius-card) + 6px)",
  padding: "30px 24px 26px",
  boxShadow: "0 20px 50px -20px rgba(0,0,0,0.25)",
};
const iconBadge = {
  width: 46,
  height: 46,
  borderRadius: "var(--radius-card)",
  display: "grid",
  placeItems: "center",
  background:
    "radial-gradient(circle at 30% 25%, color-mix(in srgb, var(--color-primary) 22%, var(--color-bg)), color-mix(in srgb, var(--color-primary) 9%, var(--color-bg)))",
  color: "var(--color-primary)",
  marginBottom: 14,
  boxShadow: "0 6px 16px -6px color-mix(in srgb, var(--color-primary) 45%, transparent)",
};
const title = { margin: "0 0 6px", fontFamily: "var(--font-heading)", fontSize: 21, lineHeight: 1.25 };
const subtitle = { margin: "0 0 20px", color: "var(--color-text-muted)", fontSize: 13.5, lineHeight: 1.5 };
const fieldWrap = { display: "block", marginBottom: 15 };
const fieldLabel = { display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 6 };
const fieldHint = { fontWeight: 400, color: "var(--color-text-muted)" };
const input = {
  width: "100%",
  font: "inherit",
  fontSize: 15,
  padding: "11px 13px",
  borderRadius: "var(--radius-card)",
  border: "1px solid var(--color-border)",
  background: "var(--color-bg)",
  color: "var(--color-text)",
  boxSizing: "border-box",
  transition: "border-color var(--motion-fast) var(--ease-out)",
};
const inputWrap = { position: "relative" };
const inputIcon = { position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)", pointerEvents: "none" };
const prefixChip = {
  position: "absolute",
  left: 6,
  top: 6,
  bottom: 6,
  display: "grid",
  placeItems: "center",
  padding: "0 10px",
  borderRadius: "calc(var(--radius-card) - 4px)",
  background: "var(--color-surface)",
  color: "var(--color-text-muted)",
  fontSize: 13.5,
  fontWeight: 600,
};
const verifiedChip = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  padding: "11px 13px",
  borderRadius: "var(--radius-card)",
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
  fontSize: 14.5,
  fontWeight: 500,
};
const verifiedChipIcon = { color: "var(--color-text-muted)", flexShrink: 0 };
const verifiedBadge = {
  display: "inline-flex",
  alignItems: "center",
  gap: 3,
  fontSize: 11,
  fontWeight: 700,
  padding: "3px 7px",
  borderRadius: 999,
  background: "var(--tone-success-wash)",
  color: "var(--tone-success)",
  flexShrink: 0,
};
const segmented = { display: "flex", gap: 8 };
const segmentBtn = {
  flex: 1,
  font: "inherit",
  fontSize: 13.5,
  fontWeight: 600,
  padding: "10px 8px",
  borderRadius: "calc(var(--radius-card) - 2px)",
  // Long-hand border props (not the `border` shorthand) so the active state
  // below can override just the colour — mixing shorthand and longhand across
  // a rerender is what React's dev overlay flags as a styling-bug risk, since
  // the shorthand silently resets everything the longhand didn't re-set.
  borderWidth: 1.5,
  borderStyle: "solid",
  borderColor: "var(--color-border)",
  background: "var(--color-bg)",
  color: "var(--color-text)",
  cursor: "pointer",
};
const segmentBtnActive = {
  borderColor: "var(--color-primary)",
  background: "color-mix(in srgb, var(--color-primary) 10%, var(--color-bg))",
  color: "var(--color-primary)",
};
const otpRow = { display: "flex", gap: 8 };
const otpBox = {
  width: "100%",
  aspectRatio: "1",
  font: "inherit",
  fontSize: 20,
  fontWeight: 700,
  textAlign: "center",
  borderRadius: "calc(var(--radius-card) - 2px)",
  borderWidth: 1.5,
  borderStyle: "solid",
  borderColor: "var(--color-border)",
  background: "var(--color-bg)",
  color: "var(--color-text)",
  padding: 0,
  transition: "border-color var(--motion-fast) var(--ease-out), background var(--motion-fast) var(--ease-out)",
};
const otpBoxFilled = { borderColor: "var(--color-primary)", background: "color-mix(in srgb, var(--color-primary) 6%, var(--color-bg))" };
const otpBoxError = { borderColor: "var(--tone-danger)" };
const primaryBtn = {
  width: "100%",
  marginTop: 6,
  font: "inherit",
  fontWeight: 700,
  fontSize: 15,
  padding: "13px 18px",
  borderRadius: "var(--radius-card)",
  background: "var(--color-primary)",
  color: "var(--color-on-primary)",
  border: "none",
  cursor: "pointer",
};
const linkRow = { display: "flex", justifyContent: "space-between", gap: 8, marginTop: 4 };
const linkBtn = {
  flex: 1,
  font: "inherit",
  fontSize: 12.5,
  fontWeight: 600,
  padding: "10px 6px",
  background: "none",
  border: "none",
  color: "var(--color-primary)",
  cursor: "pointer",
};
const linkBtnDisabled = { color: "var(--color-text-muted)", cursor: "default" };
const errorBox = {
  color: "var(--tone-danger)",
  background: "var(--tone-danger-wash)",
  fontSize: 13,
  fontWeight: 500,
  padding: "9px 12px",
  borderRadius: "calc(var(--radius-card) - 2px)",
  margin: "2px 0 14px",
};
const devHint = { fontSize: 12, color: "var(--color-text-muted)", margin: "8px 0 0" };
const trustNote = { margin: "18px 0 0", fontSize: 11.5, color: "var(--color-text-muted)", textAlign: "center", lineHeight: 1.5 };
