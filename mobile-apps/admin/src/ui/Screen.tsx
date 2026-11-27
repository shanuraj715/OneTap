import { useEffect, useState, type ReactNode } from "react";
import { Animated, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStore } from "zustand";
import { Button, Glass, Icon, Reveal, Skeleton, Text, type IconName, type Tone, Pill } from "./primitives";
import { Input } from "./Sheet";
import { radius, useResponsive, useTheme } from "./theme";
import { toasts } from "./toast-store";

/** One screen: the glass background, a big title, and a scrolling column of cards (centred and 2–3 wide on a tablet). Pull down to refresh. */
export function Screen({ title, subtitle, back, right, onRefresh, refreshing = false, children, testID, scroll = true }: { title: string; subtitle?: string; back?: () => void; right?: ReactNode; onRefresh?: () => void; refreshing?: boolean; children: ReactNode; testID?: string; scroll?: boolean }) {
  const { c, dark } = useTheme();
  const insets = useSafeAreaInsets();
  const { contentWidth } = useResponsive();
  const head = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 8, paddingBottom: 4 }}>
      {back ? <Pressable onPress={back} accessibilityRole="button" accessibilityLabel="Back" hitSlop={10} style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: c.glassStrong }} testID="back"><Icon name="left" size={22} /></Pressable> : null}
      <View style={{ flex: 1 }}>
        <Text variant="title" accessibilityRole="header" numberOfLines={1}>{title}</Text>
        {subtitle ? <Text variant="caption" tone="muted" numberOfLines={2}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
  return (
    <View style={{ flex: 1 }} testID={testID}>
      {scroll ? (
        <ScrollView
          indicatorStyle={dark ? "white" : "black"}
          contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 120, paddingHorizontal: 16, gap: 16, alignItems: "center" }}
          refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} colors={[c.primary]} progressBackgroundColor={c.solid} /> : undefined}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ width: "100%", maxWidth: contentWidth, gap: 16 }}>{head}{children}</View>
        </ScrollView>
      ) : (
        <View style={{ flex: 1, paddingTop: insets.top + 8, paddingHorizontal: 16, alignItems: "center" }}><View style={{ width: "100%", maxWidth: contentWidth, flex: 1, gap: 16 }}>{head}{children}</View></View>
      )}
    </View>
  );
}

export function Section({ title, action, children, hint }: { title: string; action?: ReactNode; children: ReactNode; hint?: string }) {
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Text variant="overline" tone="muted">{title}</Text>
          {hint ? <Text variant="caption" tone="muted">{hint}</Text> : null}
        </View>
        {action}
      </View>
      {children}
    </View>
  );
}

/** Cards flow into as many columns as fit (1 on a phone, 2–3 on a tablet). */
export function Grid({ children, min = 300, gap = 12 }: { children: ReactNode[] | ReactNode; min?: number; gap?: number }) {
  const { columns } = useResponsive();
  const cols = columns(min);
  const items = ([] as ReactNode[]).concat(children as ReactNode[]).filter(Boolean);
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap }}>
      {items.map((child, i) => <View key={i} style={{ width: cols === 1 ? "100%" : `${100 / cols - (gap * (cols - 1)) / cols / 8}%`, flexGrow: 1, flexBasis: cols === 1 ? "100%" : `${Math.floor(100 / cols) - 3}%` }}>{child}</View>)}
    </View>
  );
}

/** A figure with a name under it: a number that counts up, an optional change arrow, and a colour. */
export function Stat({ label, value, sub, tone = "neutral", icon, index = 0, onPress }: { label: string; value: ReactNode; sub?: ReactNode; tone?: Tone; icon?: IconName; index?: number; onPress?: () => void }) {
  const { c } = useTheme();
  const col = { neutral: c.muted, ok: c.ok, warn: c.warn, danger: c.danger, info: c.info, primary: c.primaryText }[tone];
  return (
    <Reveal index={index}>
      <Glass onPress={onPress} accessibilityLabel={`${label}`}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {icon ? <View style={{ width: 28, height: 28, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: c.glassStrong }}><Icon name={icon} size={15} color={col} /></View> : null}
          <Text variant="label" tone="muted" style={{ flex: 1 }} numberOfLines={1}>{label}</Text>
        </View>
        <View style={{ marginTop: 8 }}>{typeof value === "string" || typeof value === "number" ? <Text variant="title" numberOfLines={1} adjustsFontSizeToFit>{value}</Text> : value}</View>
        {sub ? <View style={{ marginTop: 4 }}>{typeof sub === "string" || typeof sub === "number" ? <Text variant="caption" tone="muted">{sub}</Text> : sub}</View> : null}
      </Glass>
    </Reveal>
  );
}

/** A row in a list: an icon tile, a title and a line under it, something on the right, optional press. */
export function Row({ icon, title, subtitle, right, onPress, testID, index = 0, danger, children }: { icon?: IconName; title: string; subtitle?: string; right?: ReactNode; onPress?: () => void; testID?: string; index?: number; danger?: boolean; children?: ReactNode }) {
  const { c } = useTheme();
  return (
    <Reveal index={index}>
      <Glass onPress={onPress} testID={testID} accessibilityLabel={title} padding={14}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          {icon ? <View style={{ width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: danger ? c.dangerWash : c.glassStrong }}><Icon name={icon} size={19} color={danger ? c.danger : c.primaryText} /></View> : null}
          <View style={{ flex: 1 }}>
            <Text variant="subheading" numberOfLines={1}>{title}</Text>
            {subtitle ? <Text variant="caption" tone="muted" numberOfLines={2}>{subtitle}</Text> : null}
          </View>
          {right}
          {onPress && !right ? <Icon name="chevron" size={18} color={c.muted} /> : null}
        </View>
        {children ? <View style={{ marginTop: 12 }}>{children}</View> : null}
      </Glass>
    </Reveal>
  );
}

export function SearchField({ value, onChange, placeholder = "Search", testID }: { value: string; onChange: (v: string) => void; placeholder?: string; testID?: string }) {
  return <Input value={value} onChangeText={onChange} placeholder={placeholder} leftIcon="search" testID={testID} />;
}

/** A row of choices of which one is on (All · Draft · Published): a pill that slides to the chosen one. */
export function Segmented<T extends string>({ value, options, onChange, testID }: { value: T; options: { value: T; label: string; count?: number }[]; onChange: (v: T) => void; testID?: string }) {
  const { c } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }} testID={testID}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={o.label} testID={testID ? `${testID}-${o.value}` : undefined}
            style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 9, paddingHorizontal: 16, borderRadius: radius.pill, backgroundColor: on ? c.primary : c.glass, borderWidth: 1, borderColor: on ? c.primary : c.border }}>
            <Text variant="label" style={{ color: on ? c.onPrimary : c.text }}>{o.label}</Text>
            {typeof o.count === "number" ? <Text variant="caption" style={{ color: on ? c.onPrimary : c.muted, opacity: 0.85 }}>{o.count}</Text> : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function Empty({ icon = "info", title, message, action }: { icon?: IconName; title: string; message?: string; action?: ReactNode }) {
  const { c } = useTheme();
  return (
    <Glass>
      <View style={{ alignItems: "center", gap: 8, paddingVertical: 14 }}>
        <View style={{ width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", backgroundColor: c.glassStrong }}><Icon name={icon} size={24} color={c.primaryText} /></View>
        <Text variant="subheading">{title}</Text>
        {message ? <Text tone="muted" style={{ textAlign: "center" }}>{message}</Text> : null}
        {action}
      </View>
    </Glass>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const status = (error as { status?: number })?.status;
  const message = status === 403 ? "Your role doesn't include this." : error instanceof Error ? error.message : "Something went wrong.";
  return <Empty icon="alert" title={status === 403 ? "Not allowed" : "Couldn't load this"} message={message} action={onRetry && status !== 403 ? <Button title="Try again" icon="refresh" variant="glass" onPress={onRetry} /> : undefined} />;
}

export function LoadingCards({ n = 3, height = 84 }: { n?: number; height?: number }) {
  return <View style={{ gap: 12 }} accessibilityLabel="Loading">{Array.from({ length: n }, (_, i) => <Glass key={i}><Skeleton height={height - 32} /></Glass>)}</View>;
}

/** A coloured dot with a word: ok · warning · problem. */
export function Status({ tone, children }: { tone: Tone; children: string }) { return <Pill tone={tone}>{children}</Pill>; }

/* ------------------------------------------------------------------------------------------------ toasts */
export function ToastHost() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const list = useStore(toasts.store, (s) => s.toasts);
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", top: insets.top + 8, left: 16, right: 16, gap: 8, alignItems: "center", zIndex: 2000 }}>
      {list.map((t) => <ToastItem key={t.id} id={t.id} message={t.message} tone={t.tone} ms={t.durationMs} color={{ ok: c.ok, info: c.info, warn: c.warn, danger: c.danger }[t.tone]} />)}
    </View>
  );
}
function ToastItem({ id, message, tone, ms, color }: { id: number; message: string; tone: string; ms: number; color: string }) {
  const { c } = useTheme();
  const [t] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(t, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    const timer = setTimeout(() => toasts.dismiss(id), ms);
    return () => clearTimeout(timer);
  }, [id, ms, t]);
  return (
    <Animated.View style={{ opacity: t, transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] }) }], maxWidth: 560, width: "100%" }}>
      <Pressable onPress={() => toasts.dismiss(id)} accessibilityRole="alert" accessibilityLabel={message} testID={`toast-${tone}`}
        style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: radius.md, backgroundColor: c.solid, borderWidth: 1, borderColor: color }}>
        <Icon name={tone === "ok" ? "check" : tone === "danger" ? "alert" : "info"} size={18} color={color} />
        <Text style={{ flex: 1 }}>{message}</Text>
      </Pressable>
    </Animated.View>
  );
}
