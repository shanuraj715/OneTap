import { RefreshControl, ScrollView, View, type StyleProp, type ViewStyle } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { useNetInfo } from "@react-native-community/netinfo";
import { Icon } from "./Icon";
import { Text } from "./Text";
import { useTheme } from "./theme";
import { useLayout } from "@/lib/layout";

/** "No internet": the board cannot refresh, so what is on it may be out of date. Shown above everything else while the phone is offline. */
export function OfflineBanner() {
  const { c } = useTheme();
  const { isConnected } = useNetInfo();
  if (isConnected !== false) return null;
  return (
    <View accessibilityLiveRegion="polite" testID="offline-banner" style={{ flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", paddingVertical: 8, paddingHorizontal: 12, backgroundColor: c.warningWash }}>
      <Icon name="wifi-off" size={16} color={c.warning} />
      <Text variant="label" style={{ color: c.warning }}>No internet — the board can&apos;t refresh until it is back</Text>
    </View>
  );
}

export interface ScreenProps {
  children: React.ReactNode;
  /** a scrolling page (forms, details). Lists that scroll themselves (FlatList) leave this off. */
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** keep a form from stretching across a wide tablet */
  narrow?: boolean;
  padded?: boolean;
  edges?: Edge[];
  style?: StyleProp<ViewStyle>;
}

/** The page: safe against the camera cut-out and the system bars, themed, and centred on a tablet when it is a form. */
export function Screen({ children, scroll = false, refreshing = false, onRefresh, narrow = false, padded = true, edges = ["top", "left", "right"], style }: ScreenProps) {
  const { c } = useTheme();
  const layout = useLayout();
  const inner: ViewStyle = { flex: scroll ? undefined : 1, padding: padded ? 16 : 0, width: "100%", maxWidth: narrow ? layout.contentMaxWidth : undefined, alignSelf: "center", gap: 14 };
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: c.bg }}>
      <OfflineBanner />
      {scroll ? (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }} refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[c.primary]} /> : undefined}>
          <View style={[inner, style]}>{children}</View>
        </ScrollView>
      ) : (
        <View style={[inner, style]}>{children}</View>
      )}
    </SafeAreaView>
  );
}
