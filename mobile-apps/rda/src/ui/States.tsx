import { View } from "react-native";
import { ApiError } from "@/api/client";
import { Button } from "./Button";
import { Icon, type IconName } from "./Icon";
import { Text } from "./Text";
import { useTheme } from "./theme";

/** Nothing here yet — and what to do about it. */
export function EmptyState({ icon = "list", title, message, action }: { icon?: IconName; title: string; message?: string; action?: { title: string; onPress: () => void } }) {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: "center", gap: 10, padding: 32 }} testID="empty-state">
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: c.surfaceAlt, alignItems: "center", justifyContent: "center" }}><Icon name={icon} size={28} color={c.muted} /></View>
      <Text variant="subheading" style={{ textAlign: "center" }}>{title}</Text>
      {message ? <Text tone="muted" style={{ textAlign: "center" }}>{message}</Text> : null}
      {action ? <Button title={action.title} variant="outline" onPress={action.onPress} style={{ alignSelf: "center" }} /> : null}
    </View>
  );
}

/** Something went wrong — in plain words, with a way to try again. */
export function ErrorState({ error, onRetry, title = "Something went wrong" }: { error: unknown; onRetry?: () => void; title?: string }) {
  const offline = error instanceof ApiError && error.isNetwork;
  const message = error instanceof Error ? error.message : "Please try again.";
  return <EmptyStateLike icon={offline ? "wifi-off" : "alert"} title={offline ? "No connection" : title} message={message} onRetry={onRetry} />;
}
function EmptyStateLike({ icon, title, message, onRetry }: { icon: IconName; title: string; message: string; onRetry?: () => void }) {
  return <EmptyState icon={icon} title={title} message={message} action={onRetry ? { title: "Try again", onPress: onRetry } : undefined} />;
}
