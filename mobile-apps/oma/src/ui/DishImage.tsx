import { useState } from "react";
import { Image, View } from "react-native";
import { Icon } from "./Icon";
import { radius, useTheme } from "./theme";

/**
 * A dish's picture. Without one, or when it can't be loaded (no connection, a removed file), a quiet placeholder takes its place — a
 * missing picture never leaves a hole or an error. The picture is decoded at the size it is drawn, not at its full size.
 */
export function DishImage({ uri, size = 72 }: { uri: string | null; size?: number }) {
  const { c } = useTheme();
  const [failed, setFailed] = useState<string | null>(null);
  const box = { width: size, height: size, borderRadius: radius.md, backgroundColor: c.surfaceAlt, overflow: "hidden" as const, alignItems: "center" as const, justifyContent: "center" as const };
  if (!uri || failed === uri) {
    return <View style={box} testID="dish-image-placeholder" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><Icon name="utensils" size={Math.round(size * 0.4)} color={c.muted} /></View>;
  }
  return (
    <View style={box}>
      <Image testID="dish-image" source={{ uri }} style={{ width: size, height: size }} resizeMode="cover" resizeMethod="resize" fadeDuration={150} onError={() => setFailed(uri)} accessibilityIgnoresInvertColors accessible={false} />
    </View>
  );
}
