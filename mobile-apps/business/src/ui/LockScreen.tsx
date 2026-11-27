import { useEffect } from "react";
import { View } from "react-native";
import { useAppLock } from "@/data/appLock";
import { APP_NAME } from "@/lib/config";
import { AppIcon } from "./AppIcon";
import { Background, Button, Text } from "./primitives";

/** Covers the whole app while the lock is on and locked. It asks once as it appears, and again whenever "Unlock" is pressed. */
export function LockScreen() {
  const unlock = useAppLock((s) => s.unlock);
  useEffect(() => { void unlock(); }, [unlock]);
  return (
    <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 }} testID="lock-screen" accessibilityViewIsModal>
      <Background target={false} />
      <AppIcon size={88} label={`${APP_NAME} icon`} />
      <Text variant="title">Locked</Text>
      <Text tone="muted" style={{ textAlign: "center" }}>Use your fingerprint, face or screen lock to open {APP_NAME}.</Text>
      <Button title="Unlock" icon="lock" onPress={() => void unlock()} testID="lock-unlock" />
    </View>
  );
}
