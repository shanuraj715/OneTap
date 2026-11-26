import { Modal, Pressable, View } from "react-native";
import { Button } from "./Button";
import type { IconName } from "./Icon";
import { IconTile } from "./IconTile";
import { Text } from "./Text";
import { radius, useTheme } from "./theme";

export interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** red button: this cannot be undone (void an order, cancel a table) */
  destructive?: boolean;
  /** a picture above the title (a question about money, a warning…) */
  icon?: IconName;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** "Are you sure?" — a small centred box with two buttons. The safe answer is always the left/first one. */
export function ConfirmDialog({ visible, title, message, confirmLabel, cancelLabel = "Cancel", destructive = false, icon, loading = false, onConfirm, onCancel }: ConfirmDialogProps) {
  const { c } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={loading ? undefined : onCancel} statusBarTranslucent navigationBarTranslucent>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: c.overlay }}>
        <Pressable accessibilityLabel="Dismiss" accessibilityRole="button" disabled={loading} onPress={onCancel} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
        <View accessibilityViewIsModal accessibilityRole="alert" style={{ width: "100%", maxWidth: 420, backgroundColor: c.surface, borderRadius: radius.lg + 4, padding: 20, gap: 12 }}>
          {icon ? <IconTile icon={icon} tone={destructive ? "danger" : "primary"} size={44} /> : null}
          <Text variant="heading" accessibilityRole="header">{title}</Text>
          <Text tone="muted">{message}</Text>
          <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 6 }}>
            <Button title={cancelLabel} variant="outline" icon="close" onPress={onCancel} disabled={loading} />
            <Button title={confirmLabel} variant={destructive ? "danger" : "primary"} icon="check" onPress={onConfirm} loading={loading} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
