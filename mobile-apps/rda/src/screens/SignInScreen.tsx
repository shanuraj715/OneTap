import { useEffect, useRef, useState } from "react";
import { View, type TextInputInstance } from "react-native";
import { Banner, Button, Icon, Screen, SwitchRow, Text, TextField, useTheme } from "@/ui";
import { describeSignInError, signInProblems, type SignInProblems } from "@/features/signin";
import { API_HOST, APP_NAME, APP_TAGLINE, APP_VERSION } from "@/lib/config";
import { countdown } from "@/lib/time";
import { useNow } from "@/lib/useNow";
import { useApi, useRuntime, useSession } from "@/runtime";

/**
 * The first screen, every time the app opens. Nothing else is reachable until a person signs in.
 * A rider signs in with their mobile number and the PIN the manager gave them. The server counts wrong PINs: after too many it pauses this
 * number (and this phone's address), and this screen then shows a countdown instead of letting the rider keep trying.
 */
export function SignInScreen() {
  const { c } = useTheme();
  const api = useApi();
  const { session } = useRuntime();
  const notice = useSession((s) => s.notice);

  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [keep, setKeep] = useState(false);
  const [problems, setProblems] = useState<SignInProblems>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // the pause is kept as 'from when to when' so the countdown is right from the first second, and survives the app being in the background
  const [pause, setPause] = useState<{ since: number; until: number } | null>(null);
  const pauseFor = (sec: number) => { const since = Date.now(); setPause({ since, until: since + sec * 1000 }); };
  const pinRef = useRef<TextInputInstance>(null);

  // is this phone's address already paused (a few wrong tries a moment ago)? Then say so up front.
  useEffect(() => {
    let live = true;
    api.guard().then((g) => { if (live && g.blocked && g.retryAfterSec) pauseFor(g.retryAfterSec); }).catch(() => undefined);
    return () => { live = false; };
  }, [api]);

  const now = useNow(1000, pause !== null);
  const waitLeft = pause === null ? 0 : Math.max(0, Math.ceil((pause.until - Math.max(now, pause.since)) / 1000));
  const paused = waitLeft > 0;

  async function submit() {
    if (busy || paused) return;
    const found = signInProblems(phone, pin);
    setProblems(found);
    setFailure(null);
    if (found.phone || found.pin) return;
    session.getState().clearNotice();
    setBusy(true);
    try {
      await session.getState().signIn(phone, pin, keep);
      // signed in: the app moves on by itself (the sign-in screen is no longer reachable)
    } catch (e) {
      const f = describeSignInError(e);
      setFailure(f.message);
      if (f.waitSec) pauseFor(f.waitSec);
      setPin("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen scroll narrow edges={["top", "bottom", "left", "right"]} style={{ justifyContent: "center", paddingVertical: 32 }}>
      <View style={{ alignItems: "center", gap: 8, marginBottom: 8 }}>
        <View style={{ width: 64, height: 64, borderRadius: 18, backgroundColor: c.primary, alignItems: "center", justifyContent: "center" }}>
          <Icon name="bike" size={32} color={c.onPrimary} />
        </View>
        <Text variant="title" accessibilityRole="header">{APP_NAME}</Text>
        <Text tone="muted">{APP_TAGLINE}</Text>
      </View>

      {notice ? <Banner tone="info" message={notice} testID="signin-notice" /> : null}
      {paused ? <Banner tone="warn" title="Too many attempts" message={`This phone is paused for a short while. Try again in ${countdown(waitLeft)}.`} testID="signin-paused" /> : null}
      {failure && !paused ? <Banner tone="danger" message={failure} testID="signin-failure" /> : null}

      <TextField
        label="Mobile number"
        value={phone}
        onChangeText={(t) => { setPhone(t); if (problems.phone) setProblems((p) => ({ ...p, phone: undefined })); }}
        error={problems.phone}
        helper="The number your manager has for you"
        leftIcon="phone"
        autoCorrect={false}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        returnKeyType="next"
        onSubmitEditing={() => pinRef.current?.focus()}
        editable={!busy}
        testID="signin-phone"
      />
      <TextField
        ref={pinRef}
        label="PIN"
        value={pin}
        onChangeText={(t) => { setPin(t.replace(/\D/g, "").slice(0, 6)); if (problems.pin) setProblems((p) => ({ ...p, pin: undefined })); }}
        error={problems.pin}
        leftIcon="lock"
        secure
        keyboardType="number-pad"
        autoCorrect={false}
        returnKeyType="go"
        onSubmitEditing={submit}
        editable={!busy}
        testID="signin-pin"
      />
      <SwitchRow icon="shield" label="Keep me signed in" hint="Only on your own phone. Otherwise you sign in each time the app opens." value={keep} onChange={setKeep} testID="signin-keep" />
      <Button title={paused ? `Try again in ${countdown(waitLeft)}` : "Sign in"} icon={paused ? "clock" : "arrow-right"} size="lg" fullWidth loading={busy} disabled={paused} onPress={submit} testID="signin-submit" />

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 8 }}><Icon name="server" size={13} color={c.muted} /><Text variant="caption" tone="muted" testID="signin-server">{APP_NAME} · {APP_VERSION} · {API_HOST}</Text></View>
    </Screen>
  );
}
