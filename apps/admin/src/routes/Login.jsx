import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";

import * as api from "../lib/api";
import { useLogin } from "../lib/useAuth";
import { Button, Field, TextInput, Toast } from "../ui";

/** "4:07" — minutes and seconds left */
const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/**
 * Counts down to `until`, then calls `onDone`. The sign-in page shows this INSTEAD of the form while this network is
 * blocked (too many wrong passwords) — there is nothing to type into until the block ends.
 */
export function BlockedNotice({ until, onDone, what = "Sign-in" }) {
  const [left, setLeft] = useState(() => Math.max(0, Math.ceil((new Date(until).getTime() - Date.now()) / 1000)));
  useEffect(() => {
    const tick = () => {
      const s = Math.max(0, Math.ceil((new Date(until).getTime() - Date.now()) / 1000));
      setLeft(s);
      if (s <= 0) onDone();
    };
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [until, onDone]);
  return (
    <div role="alert" aria-live="polite" style={{ textAlign: "center" }} data-blocked="true" data-retry-seconds={left}>
      <ShieldAlert size={34} color="var(--tone-error)" />
      <h1 style={{ fontFamily: "var(--font-heading)", fontSize: 20, margin: "10px 0 6px" }}>{what} is paused</h1>
      <p style={{ margin: "0 0 14px", fontSize: 14, lineHeight: 1.5, color: "var(--color-text-muted)" }}>
        Too many failed attempts from this network. For safety, nobody can sign in from here for a little while.
      </p>
      <div style={{ fontSize: 30, fontWeight: 700, fontVariantNumeric: "tabular-nums" }} data-testid="blocked-countdown">{clock(left)}</div>
      <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "var(--color-text-muted)" }}>Try again when the timer reaches 0:00.</p>
    </div>
  );
}

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const login = useLogin();
  // is this network blocked? asked first, so a blocked visitor is never shown the form at all
  const guard = useQuery({ queryKey: ["login-guard"], queryFn: api.loginGuard, retry: false, staleTime: 0, gcTime: 0, refetchOnWindowFocus: true });
  const [until, setUntil] = useState(null);

  useEffect(() => {
    if (guard.data?.blocked) setUntil(guard.data.blockedUntil);
  }, [guard.data]);
  useEffect(() => {
    const d = login.error?.details;
    if (d?.code === "ip_blocked") setUntil(d.blockedUntil);
  }, [login.error]);

  const submit = (e                 ) => {
    e.preventDefault();
    login.mutate({ email, password });
  };

  const attemptsLeft = login.error?.details?.attemptsLeft;

  return (
    <div style={page}>
      <form onSubmit={submit} style={card}>
        {until ? (
          <BlockedNotice
            until={until}
            onDone={() => {
              setUntil(null);
              login.reset();
              void guard.refetch();
            }}
          />
        ) : guard.isLoading ? (
          <div style={{ minHeight: 120 }} aria-busy="true" />
        ) : (
          <>
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 20, display: "flex", alignItems: "center", gap: 10 }}>
                <img src="/favicon.svg" alt="" width={32} height={32} style={{ borderRadius: 9, flexShrink: 0 }} />
                <span>
                  Rasoi Pulse<span style={{ color: "var(--color-text-muted)", fontWeight: 400 }}> admin</span>
                </span>
              </div>
              <p style={{ margin: "6px 0 0", fontSize: 14, color: "var(--color-text-muted)" }}>
                Sign in to manage your restaurant.
              </p>
            </div>

            <Field label="Email">
              <TextInput
                type="email"
                value={email}
                autoComplete="username"
                autoFocus
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field label="Password">
              <TextInput
                type="password"
                value={password}
                autoComplete="current-password"
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>

            <Button type="submit" disabled={login.isPending || !email || !password} style={{ width: "100%", marginTop: 4 }}>
              {login.isPending ? "Signing in…" : "Sign in"}
            </Button>

            {login.error ? <Toast kind="error">{(login.error         ).message}</Toast> : null}
            {attemptsLeft !== undefined ? (
              <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "var(--color-text-muted)" }} data-attempts-left={attemptsLeft}>
                {attemptsLeft} {attemptsLeft === 1 ? "attempt" : "attempts"} left before sign-in is paused for a while.
              </p>
            ) : null}
          </>
        )}
      </form>
    </div>
  );
}

const page                = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  padding: 24,
  background: "var(--color-surface)",
};
const card                = {
  width: "100%",
  maxWidth: 380,
  background: "var(--color-bg)",
  border: "1px solid var(--color-border)",
  borderRadius: 14,
  padding: 28,
};
