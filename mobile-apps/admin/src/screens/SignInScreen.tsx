import { useEffect, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ApiError } from "@/api/client";
import { API_HOST, APP_NAME, APP_TAGLINE, APP_VERSION } from "@/lib/config";
import { useApi, useRuntime, useSession } from "@/runtime";
import { AppIcon, Button, Glass, Icon, Input, Reveal, Text, useResponsive, useTheme, AppSwitch } from "@/ui";

const problems = (email: string, password: string) => ({
  email: !email.trim() ? "Enter your email." : !/^\S+@\S+\.\S+$/.test(email.trim()) ? "That doesn't look like an email address." : undefined,
  password: !password ? "Enter your password." : undefined,
});

/** The first screen when nobody is signed in. Only the Rasoi Pulse team (the owner and the people with a role) can get past it. */
export function SignInScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { contentWidth } = useResponsive();
  const api = useApi();
  const { session } = useRuntime();
  const notice = useSession((s) => s.notice);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [keep, setKeep] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);
  const passwordRef = useRef<{ focus(): void } | null>(null);
  void passwordRef;

  useEffect(() => { // is this phone's address already paused (a few wrong tries a moment ago)?
    let live = true;
    api.guard().then((g) => { if (live && g.blocked && g.retryAfterSec) setWait(g.retryAfterSec); }).catch(() => undefined);
    return () => { live = false; };
  }, [api]);
  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => Math.max(0, w - 1)), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function submit() {
    if (busy || wait > 0) return;
    const found = problems(email, password);
    setErrors(found);
    setFailure(null);
    if (found.email || found.password) return;
    session.getState().clearNotice();
    setBusy(true);
    try {
      await session.getState().signIn(email, password, keep); // signed in: the app moves on by itself
    } catch (e) {
      if (e instanceof ApiError && e.retryAfterSec) setWait(e.retryAfterSec);
      setFailure(e instanceof ApiError ? (e.status === 401 ? "Incorrect email or password." : e.message) : "Something went wrong. Try again.");
      setPassword("");
    } finally { setBusy(false); }
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", alignItems: "center", paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24, paddingHorizontal: 20 }} keyboardShouldPersistTaps="handled">
        <View style={{ width: "100%", maxWidth: Math.min(440, contentWidth), gap: 18 }}>
          <Reveal>
            <View style={{ alignItems: "center", gap: 6 }}>
              <AppIcon size={92} label={`${APP_NAME} icon`} />
              <Text variant="title" accessibilityRole="header" style={{ marginTop: 8 }}>{APP_NAME}</Text>
              <Text tone="muted">{APP_TAGLINE}</Text>
            </View>
          </Reveal>
          <Reveal index={1}>
            <Glass blur strong padding={20} radiusSize={28}>
              <View style={{ gap: 14 }}>
                {notice ? <Text tone="info" testID="signin-notice">{notice}</Text> : null}
                {wait > 0 ? <Text tone="warn" testID="signin-paused">Too many attempts. This phone is paused for {wait >= 60 ? `${Math.ceil(wait / 60)} min` : `${wait} s`}.</Text> : null}
                {failure && wait <= 0 ? <Text tone="danger" testID="signin-failure">{failure}</Text> : null}
                <View style={{ gap: 6 }}>
                  <Text variant="label" tone="muted">Email</Text>
                  <Input value={email} onChangeText={(t) => { setEmail(t); if (errors.email) setErrors((p) => ({ ...p, email: undefined })); }} leftIcon="mail" keyboardType="email-address" returnKeyType="next" testID="signin-email" editable={!busy} />
                  {errors.email ? <Text variant="caption" tone="danger">{errors.email}</Text> : null}
                </View>
                <View style={{ gap: 6 }}>
                  <Text variant="label" tone="muted">Password</Text>
                  <Input value={password} onChangeText={(t) => { setPassword(t); if (errors.password) setErrors((p) => ({ ...p, password: undefined })); }} leftIcon="lock" secure returnKeyType="go" onSubmitEditing={submit} testID="signin-password" editable={!busy} />
                  {errors.password ? <Text variant="caption" tone="danger">{errors.password}</Text> : null}
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <Icon name="shield" size={18} color={c.muted} />
                  <View style={{ flex: 1 }}>
                    <Text variant="label">Keep me signed in</Text>
                    <Text variant="caption" tone="muted">Only on a phone nobody else uses.</Text>
                  </View>
                  <AppSwitch value={keep} onValueChange={setKeep} testID="signin-keep" accessibilityLabel="Keep me signed in" />
                </View>
                <Button title={wait > 0 ? `Try again in ${wait >= 60 ? `${Math.ceil(wait / 60)} min` : `${wait} s`}` : "Sign in"} icon={wait > 0 ? "history" : "chevron"} size="lg" fullWidth loading={busy} disabled={wait > 0} onPress={submit} testID="signin-submit" />
              </View>
            </Glass>
          </Reveal>
          <Reveal index={2}><View style={{ flexDirection: "row", justifyContent: "center", gap: 6 }}><Icon name="server" size={13} color={c.muted} /><Text variant="caption" tone="muted" testID="signin-server">{APP_NAME} · {APP_VERSION} · {API_HOST}</Text></View></Reveal>
        </View>
      </ScrollView>
    </View>
  );
}
