import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Animated, Easing, Keyboard, KeyboardAvoidingView, Modal, Pressable, ScrollView, TextInput, View, type ScrollViewInstance, type ViewInstance } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { IconButton } from "./Button";
import { Text } from "./Text";
import { radius, useTheme } from "./theme";
import { useLayout } from "@/lib/layout";

/**
 * Inside a pop-up that scrolls, a box the person taps must come into view above the keyboard. The pop-up provides this function; a
 * TextField calls it when it gets the focus. (Outside a pop-up it does nothing.)
 */
const RevealContext = createContext<(() => void) | null>(null);
export const useReveal = () => useContext(RevealContext);

/** How far (in px) the bottom of a panel at `y` with height `h` is hidden under a keyboard whose top edge is at `keyboardTop`; 0 when it is clear (a few px of rounding don't count). */
export const keyboardOverlap = (y: number, h: number, keyboardTop: number): number => {
  const under = Math.round(y + h - keyboardTop);
  return under > 4 ? under : 0;
};

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** buttons pinned under the content */
  footer?: React.ReactNode;
  /** the content scrolls itself (a FlatList): do not wrap it in another ScrollView */
  selfScrolling?: boolean;
  testID?: string;
}

/**
 * A panel that slides up from the bottom on a phone, and floats in the middle on a tablet. Android's back button and a tap on the dim area
 * close it. (Built on the system Modal: no extra native libraries.)
 *
 * The keyboard: the panel is lifted above it. Phones and Android versions differ in whether the pop-up's window is resized for the
 * keyboard, so the lift is CHECKED: once the keyboard is up, where the panel's bottom edge really is gets measured, and if any of it is
 * still under the keyboard the panel is raised by exactly that much. And the box being typed in is scrolled into view.
 */
export function Sheet({ visible, onClose, title, children, footer, selfScrolling = false, testID }: SheetProps) {
  const { c } = useTheme();
  const layout = useLayout();
  // keep it mounted while it slides away, so closing is smooth rather than a pop
  const [mounted, setMounted] = useState(visible);
  const [progress] = useState(() => new Animated.Value(visible ? 1 : 0));
  if (visible && !mounted) setMounted(true);
  useEffect(() => {
    Animated.timing(progress, { toValue: visible ? 1 : 0, duration: visible ? 220 : 160, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
  }, [visible, progress]);

  const card = useRef<ViewInstance>(null);
  const scroll = useRef<ScrollViewInstance>(null);
  const content = useRef<ViewInstance>(null);
  const [lift, setLift] = useState(0); // extra raise, when the system did not move the panel clear of the keyboard

  /** scroll the box that has the focus to the top of the scrolling area */
  const reveal = useCallback(() => {
    setTimeout(() => {
      const input = TextInput.State.currentlyFocusedInput?.();
      if (!input || !content.current || !scroll.current) return;
      input.measureLayout(content.current, (_x, y) => scroll.current?.scrollTo({ y: Math.max(0, y - 16), animated: true }), () => undefined);
    }, 120);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const shown = Keyboard.addListener("keyboardDidShow", (e) => {
      const keyboardTop = e.endCoordinates.screenY;
      clearTimeout(timer);
      // measure once the system has finished moving things (the window may be resizing)
      timer = setTimeout(() => card.current?.measureInWindow((_x, y, _w, h) => { const under = keyboardOverlap(y, h, keyboardTop); if (under > 0) setLift((now) => now + under); }), 260);
      reveal();
    });
    const hidden = Keyboard.addListener("keyboardDidHide", () => { clearTimeout(timer); setLift(0); });
    return () => { clearTimeout(timer); shown.remove(); hidden.remove(); };
  }, [mounted, reveal]);

  if (!mounted) return null;

  const centered = layout.kind !== "phone";
  const slide = progress.interpolate({ inputRange: [0, 1], outputRange: [centered ? 24 : 420, 0] });
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      {/* the keyboard pushes the panel up instead of covering its lower half (the Send button!) */}
      <KeyboardAvoidingView behavior="padding" testID={testID} style={{ flex: 1, justifyContent: centered ? "center" : "flex-end", alignItems: "center" }}>
        <Animated.View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.overlay, opacity: progress }} />
        <Pressable accessibilityLabel="Close" accessibilityRole="button" onPress={onClose} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
        <Animated.View
          ref={card}
          accessibilityViewIsModal
          style={{ width: "100%", maxWidth: centered ? 560 : undefined, maxHeight: centered ? "86%" : "92%", marginBottom: lift, opacity: progress, transform: [{ translateY: slide }], backgroundColor: c.surface, borderTopLeftRadius: radius.lg + 4, borderTopRightRadius: radius.lg + 4, borderBottomLeftRadius: centered ? radius.lg + 4 : 0, borderBottomRightRadius: centered ? radius.lg + 4 : 0, overflow: "hidden" }}
        >
          <SafeAreaView edges={centered ? [] : ["bottom"]} style={{ flexShrink: 1 }}>
            {!centered ? <View style={{ alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: c.border, marginTop: 8 }} /> : null}
            <View style={{ flexDirection: "row", alignItems: "center", paddingLeft: 16, paddingRight: 6, paddingTop: 6, minHeight: 52 }}>
              <Text variant="heading" style={{ flex: 1 }} numberOfLines={1} accessibilityRole="header">{title}</Text>
              <IconButton icon="close" label="Close" onPress={onClose} />
            </View>
            <RevealContext.Provider value={reveal}>
              {selfScrolling ? (
                <View style={{ flexShrink: 1 }}>{children}</View>
              ) : (
                <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" style={{ flexShrink: 1 }} contentContainerStyle={{ padding: 16, paddingTop: 4 }}>
                  <View ref={content} collapsable={false} style={{ gap: 14 }}>{children}</View>
                </ScrollView>
              )}
            </RevealContext.Provider>
            {footer ? <View style={{ padding: 16, paddingTop: 10, gap: 10, borderTopWidth: 1, borderTopColor: c.border }}>{footer}</View> : null}
          </SafeAreaView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
