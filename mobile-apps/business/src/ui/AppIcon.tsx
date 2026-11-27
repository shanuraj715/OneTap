import { Image } from "react-native";

/** The app's own icon (the artwork that is on the phone's home screen), for the sign-in and start-up screens. */
export function AppIcon({ size = 72, label }: { size?: number; label: string }) {
  return <Image source={require("../../assets/icon.png")} accessibilityLabel={label} style={{ width: size, height: size, borderRadius: size * 0.22 }} resizeMode="cover" testID="app-icon" />;
}
