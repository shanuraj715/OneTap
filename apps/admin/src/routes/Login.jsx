import { useState } from "react";
                                           
import { useMutation } from "@tanstack/react-query";
import { seedDemo } from "../lib/api";
import { useLogin } from "../lib/useAuth";
import { Button, Field, TextInput, Toast } from "../ui";

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const login = useLogin();
  const seed = useMutation({
    mutationFn: seedDemo,
    onSuccess: (r) => {
      setEmail(r.owner.email);
      setPassword("momos1234");
    },
  });

  const submit = (e                 ) => {
    e.preventDefault();
    login.mutate({ email, password });
  };

  return (
    <div style={page}>
      <form onSubmit={submit} style={card}>
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 20 }}>
            TablePe<span style={{ color: "var(--color-text-muted)", fontWeight: 400 }}> admin</span>
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

        <div style={hint}>
          <div style={{ marginBottom: 8 }}>
            First run? Create the demo brand, menu and owner account:
          </div>
          <Button type="button" variant="outline" onClick={() => seed.mutate()} disabled={seed.isPending}>
            {seed.isPending ? "Setting up…" : "Set up demo data"}
          </Button>
          {seed.isSuccess ? (
            <Toast kind="ok">
              Ready — signed in as <code>{seed.data.owner.email}</code>. Press Sign in.
            </Toast>
          ) : null}
          {seed.error ? <Toast kind="error">{(seed.error         ).message}</Toast> : null}
        </div>
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
const hint                = {
  marginTop: 18,
  paddingTop: 14,
  borderTop: "1px solid var(--color-border)",
  fontSize: 12.5,
  color: "var(--color-text-muted)",
  lineHeight: 1.6,
};
