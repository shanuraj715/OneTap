"use client";

import { useEffect, useMemo, useState } from "react";
import { CUSTOMER_GENDER_LABELS, CUSTOMER_GENDERS } from "@onetap/config-schema";
import { LogIn, ShieldCheck, User } from "lucide-react";
import { api, apiPatch } from "@/lib/clientApi";

const DRAFT_KEY = "onetap.customerDraft";

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
 * Two modes, one shell:
 *  - `customer` is null → a brand-new or returning visitor: mobile number,
 *    full profile, then the OTP. Whether this phone already has an account
 *    is only known AFTER the code is verified — asking for the profile up
 *    front rather than branching on it means the form can't leak who is
 *    already registered before they've proven they own the number.
 *  - `customer` exists but is missing a field → only THAT field is asked,
 *    no phone, no OTP. Owning the session cookie already proved who they
 *    are; a legacy account is completed once, quietly, not treated as a
 *    fresh signup.
 */
export function CustomerGate({ customer, outletId, onSuccess }) {
  const isCompletion = Boolean(customer);

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

  // A returning visitor on the same device/browser doesn't retype their
  // details — this is a convenience only, never a substitute for the OTP.
  useEffect(() => {
    if (isCompletion) return;
    const draft = loadDraft();
    if (draft.name) setName(draft.name);
    if (draft.gender) setGender(draft.gender);
    if (draft.age) setAge(String(draft.age));
    if (draft.email) setEmail(draft.email);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const needsName = !customer?.name;
  const needsGender = !customer?.gender;
  const needsAge = !customer?.age;
  // Email is always optional, and a completion step never re-asks for it once set.
  const needsEmail = !customer?.email;

  const profileValid = (!needsName || name.trim().length > 0) && (!needsGender || gender) && (!needsAge || (age && Number(age) >= 13 && Number(age) <= 100));

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
      if (!profileValid) throw new Error("Fill in the details above first");
      const r = await api("/api/customer/otp/request", { outletId, destination });
      setSent(true);
      setDevCode(r.devCode ?? null);
      saveDraft({ name: name.trim(), gender, age: Number(age), email: email.trim() });
    });

  const verify = () =>
    run(async () => {
      await api("/api/customer/otp/verify", {
        outletId,
        destination,
        code,
        name: needsName ? name.trim() : undefined,
        gender: needsGender ? gender : undefined,
        age: needsAge ? Number(age) : undefined,
        email: needsEmail && email.trim() ? email.trim() : undefined,
      });
      onSuccess();
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
              : "One quick step — then you can apply coupons and redeem coins on every order."}
        </p>

        {!isCompletion && !sent ? (
          <Field label="Mobile number">
            <input
              style={input}
              type="tel"
              inputMode="numeric"
              autoFocus
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="9810000000"
            />
          </Field>
        ) : null}

        {!sent ? (
          <>
            {needsName ? (
              <Field label="Your name">
                <input style={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" autoFocus={isCompletion} />
              </Field>
            ) : null}

            {needsGender ? (
              <Field label="Gender">
                <div style={segmented}>
                  {CUSTOMER_GENDERS.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGender(g)}
                      style={{ ...segmentBtn, ...(gender === g ? segmentBtnActive : {}) }}
                    >
                      {CUSTOMER_GENDER_LABELS[g]}
                    </button>
                  ))}
                </div>
              </Field>
            ) : null}

            {needsAge ? (
              <Field label="Age">
                <input
                  style={input}
                  type="number"
                  inputMode="numeric"
                  min={13}
                  max={100}
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="e.g. 27"
                />
              </Field>
            ) : null}

            {needsEmail ? (
              <Field label="Email" hint="Optional — for order receipts">
                <input style={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </Field>
            ) : null}
          </>
        ) : (
          <Field label="6-digit code">
            <input
              style={{ ...input, letterSpacing: "0.35em", fontWeight: 700, textAlign: "center" }}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              maxLength={6}
              autoFocus
            />
            {devCode ? (
              <p style={devHint}>
                No SMS provider configured yet — dev code: <strong>{devCode}</strong>
              </p>
            ) : null}
          </Field>
        )}

        {error ? <p style={errorText}>{error}</p> : null}

        <button
          type="button"
          style={primaryBtn}
          disabled={busy || (isCompletion ? !profileValid : sent ? code.length < 4 : destination.length < 8 || !profileValid)}
          onClick={isCompletion ? completeProfile : sent ? verify : requestCode}
        >
          {busy ? "Please wait…" : isCompletion ? "Save and continue" : sent ? "Verify & continue" : "Send code"}
        </button>

        {sent ? (
          <button type="button" style={linkBtn} onClick={() => setSent(false)}>
            Use a different number
          </button>
        ) : null}

        <p style={trustNote}>
          <ShieldCheck size={13} style={{ verticalAlign: -2, marginRight: 4 }} />
          Used only to verify your order and your coin wallet.
        </p>
      </div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <label style={fieldWrap}>
      <span style={fieldLabel}>
        {label}
        {hint ? <span style={fieldHint}> · {hint}</span> : null}
      </span>
      {children}
    </label>
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
  borderRadius: 18,
  padding: "28px 24px",
  boxShadow: "0 20px 50px -20px rgba(0,0,0,0.25)",
};
const iconBadge = {
  width: 44,
  height: 44,
  borderRadius: 12,
  display: "grid",
  placeItems: "center",
  background: "color-mix(in srgb, var(--color-primary) 12%, var(--color-bg))",
  color: "var(--color-primary)",
  marginBottom: 14,
};
const title = { margin: "0 0 6px", fontFamily: "var(--font-heading)", fontSize: 21, lineHeight: 1.25 };
const subtitle = { margin: "0 0 20px", color: "var(--color-text-muted)", fontSize: 13.5, lineHeight: 1.5 };
const fieldWrap = { display: "block", marginBottom: 14 };
const fieldLabel = { display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 6 };
const fieldHint = { fontWeight: 400, color: "var(--color-text-muted)" };
const input = {
  width: "100%",
  font: "inherit",
  fontSize: 15,
  padding: "11px 13px",
  borderRadius: 10,
  border: "1px solid var(--color-border)",
  background: "var(--color-bg)",
  color: "var(--color-text)",
  boxSizing: "border-box",
};
const segmented = { display: "flex", gap: 8 };
const segmentBtn = {
  flex: 1,
  font: "inherit",
  fontSize: 13.5,
  fontWeight: 600,
  padding: "10px 8px",
  borderRadius: 10,
  border: "1.5px solid var(--color-border)",
  background: "var(--color-bg)",
  color: "var(--color-text)",
  cursor: "pointer",
};
const segmentBtnActive = {
  borderColor: "var(--color-primary)",
  background: "color-mix(in srgb, var(--color-primary) 10%, var(--color-bg))",
  color: "var(--color-primary)",
};
const primaryBtn = {
  width: "100%",
  marginTop: 6,
  font: "inherit",
  fontWeight: 700,
  fontSize: 15,
  padding: "13px 18px",
  borderRadius: 12,
  background: "var(--color-primary)",
  color: "var(--color-on-primary)",
  border: "none",
  cursor: "pointer",
};
const linkBtn = {
  width: "100%",
  marginTop: 10,
  font: "inherit",
  fontSize: 13,
  padding: 6,
  background: "none",
  border: "none",
  color: "var(--color-text-muted)",
  cursor: "pointer",
};
const errorText = { color: "#B23B3B", fontSize: 13, margin: "2px 0 14px" };
const devHint = { fontSize: 12, color: "var(--color-text-muted)", margin: "8px 0 0" };
const trustNote = { margin: "18px 0 0", fontSize: 11.5, color: "var(--color-text-muted)", textAlign: "center", lineHeight: 1.5 };
