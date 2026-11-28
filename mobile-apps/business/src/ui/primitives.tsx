import { createContext, createRef, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ComponentRef, type ReactNode } from "react";
import { ActivityIndicator, Animated, Easing, Platform, Pressable, StyleSheet, Switch, Text as RNText, View, type PressableProps, type StyleProp, type TextProps, type TextStyle, type ViewStyle } from "react-native";
import { BlurTargetView, BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import * as Lucide from "lucide-react-native";
import { radius, useTheme } from "./theme";
import { useReducedMotion } from "./motion";

/* ------------------------------------------------------------------------------------------------ icons */
export type IconName = keyof typeof ICONS;
/** The icons the app uses (Lucide — the same family as the web console). */
export const ICONS = {
  dashboard: Lucide.LayoutDashboard, stores: Lucide.Store, onboarding: Lucide.ClipboardList, plans: Lucide.Layers, leads: Lucide.Inbox, website: Lucide.Globe,
  "app-management": Lucide.Smartphone, server: Lucide.Server, security: Lucide.ShieldCheck, cache: Lucide.Database, storage: Lucide.HardDrive, ai: Lucide.Sparkles,
  settings: Lucide.Settings, team: Lucide.Users, more: Lucide.Ellipsis, search: Lucide.Search, plus: Lucide.Plus, close: Lucide.X, check: Lucide.Check, chevron: Lucide.ChevronRight,
  down: Lucide.ChevronDown, left: Lucide.ChevronLeft, up: Lucide.ChevronUp, mail: Lucide.Mail, lock: Lucide.Lock, eye: Lucide.Eye, eyeOff: Lucide.EyeOff, logout: Lucide.LogOut,
  refresh: Lucide.RefreshCw, alert: Lucide.TriangleAlert, info: Lucide.Info, trash: Lucide.Trash2, edit: Lucide.Pencil, power: Lucide.Power, key: Lucide.KeyRound, calendar: Lucide.CalendarDays,
  user: Lucide.User, shield: Lucide.Shield, outlet: Lucide.MapPin, rupee: Lucide.IndianRupee, orders: Lucide.ReceiptText, trend: Lucide.TrendingUp, cpu: Lucide.Cpu, memory: Lucide.MemoryStick,
  truck: Lucide.Truck, qr: Lucide.QrCode, bag: Lucide.ShoppingBag, tag: Lucide.Tag, wallet: Lucide.Wallet, chat: Lucide.MessageCircle, megaphone: Lucide.Megaphone, chart: Lucide.ChartColumn,
  chef: Lucide.ChefHat, calendarCheck: Lucide.CalendarCheck, calendarClock: Lucide.CalendarClock, star: Lucide.Star, bell: Lucide.BellRing, image: Lucide.Image, printer: Lucide.Printer,
  card: Lucide.CreditCard, percent: Lucide.Percent, utensils: Lucide.Utensils, palette: Lucide.Palette, note: Lucide.StickyNote, person: Lucide.UserRound, clock: Lucide.Clock,
  receipt: Lucide.Receipt, link: Lucide.Link2, cash: Lucide.Banknote, rocket: Lucide.Rocket, timer: Lucide.Timer, globe: Lucide.Globe, route: Lucide.Route, sparkles: Lucide.Sparkles,
  circleCheck: Lucide.CircleCheck, circleX: Lucide.CircleX,
  network: Lucide.Network, disk: Lucide.HardDrive, history: Lucide.History, block: Lucide.Ban, unlock: Lucide.LockOpen, filter: Lucide.SlidersHorizontal, phone: Lucide.Phone, building: Lucide.Building2,
  download: Lucide.Download, share: Lucide.Share2, file: Lucide.FileText, sheet: Lucide.FileSpreadsheet, target: Lucide.Target, pie: Lucide.ChartPie, package: Lucide.Package,
  lightbulb: Lucide.Lightbulb, trendDown: Lucide.TrendingDown, copy: Lucide.Copy, fingerprint: Lucide.FingerprintPattern, users: Lucide.UsersRound, store: Lucide.Store, minus: Lucide.Minus,
} as const;

export function Icon({ name, size = 20, color, strokeWidth = 2 }: { name: IconName; size?: number; color?: string; strokeWidth?: number }) {
  const { c } = useTheme();
  const Glyph = ICONS[name];
  return <Glyph size={size} color={color ?? c.text} strokeWidth={strokeWidth} />;
}

/* ------------------------------------------------------------------------------------------------ text */
const VARIANTS = {
  hero: { fontSize: 34, fontWeight: "800", letterSpacing: -0.8 },
  title: { fontSize: 24, fontWeight: "800", letterSpacing: -0.4 },
  heading: { fontSize: 18, fontWeight: "700" },
  subheading: { fontSize: 15, fontWeight: "700" },
  body: { fontSize: 15, fontWeight: "400" },
  label: { fontSize: 13, fontWeight: "600" },
  caption: { fontSize: 12, fontWeight: "500" },
  overline: { fontSize: 11, fontWeight: "800", letterSpacing: 1.1, textTransform: "uppercase" },
} as const satisfies Record<string, TextStyle>;
export interface TextPropsEx extends TextProps { variant?: keyof typeof VARIANTS; tone?: "normal" | "muted" | "primary" | "ok" | "warn" | "danger" | "info" }
export function Text({ variant = "body", tone = "normal", style, ...rest }: TextPropsEx) {
  const { c } = useTheme();
  const color = { normal: c.text, muted: c.muted, primary: c.primaryText, ok: c.ok, warn: c.warn, danger: c.danger, info: c.info }[tone];
  return <RNText {...rest} style={[VARIANTS[variant], { color }, style]} />;
}

/* ------------------------------------------------------------------------------------------------ press feel */
/** A press that gives a little: the thing shrinks under the finger and springs back. */
export function usePressScale(to = 0.97) {
  const [scale] = useState(() => new Animated.Value(1));
  const spring = (v: number) => Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  return { style: { transform: [{ scale }] }, onPressIn: () => spring(to), onPressOut: () => spring(1) };
}

/* ------------------------------------------------------------------------------------------------ the background */
/**
 * The ONE scenery of the app (a gradient and three soft colour blobs that drift slowly), drawn once behind every screen. It is also the thing
 * the frosted panels blur: on Android a blur needs to be told what to blur (a "blur target"), and this is it. Until it exists nothing tries to blur,
 * so no panel shows a half-drawn tint. Stands still when the phone asks for reduced motion.
 */
const scene = { ref: createRef<ComponentRef<typeof View>>(), ready: false, listeners: new Set<() => void>() };
const setScene = (node: ComponentRef<typeof View> | null) => {
  (scene.ref as { current: ComponentRef<typeof View> | null }).current = node;
  const ready = node !== null;
  if (ready === scene.ready) return;
  scene.ready = ready;
  scene.listeners.forEach((l) => l());
};
const subscribeScene = (l: () => void) => { scene.listeners.add(l); return () => { scene.listeners.delete(l); }; };
const sceneReady = () => scene.ready;

export function Background({ target = true }: { /** false for a cover that must not take over as the thing everything blurs (the start-up splash, the error screen) */ target?: boolean }) {
  const { c, dark } = useTheme();
  const reduced = useReducedMotion();
  const [drift] = useState(() => [new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]);
  useEffect(() => {
    if (reduced) { drift.forEach((v) => v.setValue(0)); return; }
    const loops = drift.map((v, i) => Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 14000 + i * 3500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: 14000 + i * 3500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])));
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [drift, reduced]);
  const blob = (i: number, color: string, size: number, pos: ViewStyle, dx: number, dy: number) => (
    <Animated.View
      pointerEvents="none"
      style={[{ position: "absolute", width: size, height: size, borderRadius: size / 2, backgroundColor: color, opacity: dark ? 0.32 : 0.55 }, pos,
        { transform: [{ translateX: drift[i]!.interpolate({ inputRange: [0, 1], outputRange: [0, dx] }) }, { translateY: drift[i]!.interpolate({ inputRange: [0, 1], outputRange: [0, dy] }) }, { scale: drift[i]!.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] }) }] }]}
    />
  );
  const art = (
    <>
      <LinearGradient colors={[c.bgTop, c.bgBottom]} style={StyleSheet.absoluteFill} />
      {blob(0, c.blobA, 340, { top: -120, right: -120 }, -60, 80)}
      {blob(1, c.blobB, 420, { bottom: -160, left: -140 }, 90, -70)}
      {blob(2, c.blobC, 260, { top: "42%", right: -90 }, -80, -50)}
    </>
  );
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" testID="background">
      {target ? <BlurTargetView ref={setScene} style={StyleSheet.absoluteFill}>{art}</BlurTargetView> : art}
    </View>
  );
}

/**
 * Where a blur must NOT be drawn: inside a pop-up sheet. A sheet lives in its own window on a solid fill, so there is no scenery behind its panels —
 * a blur there would show a smudge of the app's background through the sheet. (The Sheet turns it off for everything inside it.)
 */
export const FrostContext = createContext(true);

/** Android 12+ blurs on the graphics chip (RenderEffect) — cheap enough for every panel on screen; older Androids use the slower software blur. */
const ANDROID_BLUR = Platform.OS === "android" && Number(Platform.Version) >= 31 ? "dimezisBlurViewSdk31Plus" : "dimezisBlurView";

/**
 * A real blur of what is behind, filling its parent (put it first inside a clipped, rounded panel). Android blurs the app's scenery (the one
 * Background); iOS blurs whatever really is behind it. Draws nothing until there is a scenery to blur.
 */
export function Frost({ intensity = 50 }: { intensity?: number }) {
  const { dark } = useTheme();
  const allowed = useContext(FrostContext);
  const ready = useSyncExternalStore(subscribeScene, sceneReady, sceneReady);
  if (!ready || !allowed) return null;
  return <BlurView testID="frost" blurTarget={scene.ref} intensity={intensity} tint={dark ? "dark" : "light"} blurMethod={ANDROID_BLUR} style={StyleSheet.absoluteFill} />;
}

/* ------------------------------------------------------------------------------------------------ glass */
export interface GlassProps { children?: ReactNode; style?: StyleProp<ViewStyle>; /** the real blur of what is behind it — ON for every panel (pass `false` only for a panel that must stay plain) */ blur?: boolean; strong?: boolean; padding?: number; onPress?: () => void; testID?: string; accessibilityLabel?: string; radiusSize?: number }
/** A frosted panel: translucent fill, a hairline border, a soft shadow, and the real blur of whatever is behind it. */
export function Glass({ children, style, blur = true, strong = false, padding = 16, onPress, testID, accessibilityLabel, radiusSize = radius.lg }: GlassProps) {
  const { c, dark } = useTheme();
  const press = usePressScale(0.985);
  const body = (
    <View
      testID={testID}
      accessibilityLabel={onPress ? undefined : accessibilityLabel}
      style={[{ borderRadius: radiusSize, overflow: "hidden", backgroundColor: strong ? c.glassStrong : c.glass, borderWidth: StyleSheet.hairlineWidth * 1.5, borderColor: c.border, shadowColor: c.shadow, shadowOpacity: dark ? 0.35 : 0.14, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } }, style]}
    >
      {blur ? <Frost intensity={dark ? 38 : 55} /> : null}
      <View style={{ padding }}>{children}</View>
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} onPressIn={press.onPressIn} onPressOut={press.onPressOut} accessibilityRole="button" accessibilityLabel={accessibilityLabel}>
      <Animated.View style={press.style}>{body}</Animated.View>
    </Pressable>
  );
}

/* ------------------------------------------------------------------------------------------------ buttons and pills */
export interface ButtonProps extends Omit<PressableProps, "style" | "children"> { title: string; icon?: IconName; variant?: "primary" | "glass" | "danger" | "ghost"; size?: "md" | "lg" | "sm"; loading?: boolean; fullWidth?: boolean; style?: StyleProp<ViewStyle> }
export function Button({ title, icon, variant = "primary", size = "md", loading = false, fullWidth = false, disabled, style, onPress, ...rest }: ButtonProps) {
  const { c, dark } = useTheme();
  const press = usePressScale(0.96);
  const off = Boolean(disabled || loading);
  const look = { primary: { bg: c.primary, fg: c.onPrimary, bd: "transparent" }, danger: { bg: c.danger, fg: "#FFFFFF", bd: "transparent" }, glass: { bg: c.glassStrong, fg: c.text, bd: c.border }, ghost: { bg: "transparent", fg: c.primaryText, bd: "transparent" } }[variant];
  const pad = { sm: [8, 14], md: [12, 18], lg: [15, 22] }[size] as [number, number];
  return (
    <Pressable {...rest} onPress={off ? undefined : onPress} onPressIn={press.onPressIn} onPressOut={press.onPressOut} disabled={off} accessibilityRole="button" accessibilityState={{ disabled: off, busy: loading }} accessibilityLabel={rest.accessibilityLabel ?? title} style={fullWidth ? { alignSelf: "stretch" } : { alignSelf: "flex-start" }}>
      <Animated.View style={[press.style, { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: pad[0], paddingHorizontal: pad[1], borderRadius: radius.pill, overflow: "hidden", backgroundColor: look.bg, borderWidth: look.bd === "transparent" ? 0 : 1, borderColor: look.bd, opacity: off ? 0.5 : 1 }, style]}>
        {variant === "glass" ? <Frost intensity={dark ? 38 : 55} /> : null}
        {loading ? <ActivityIndicator size="small" color={look.fg} /> : icon ? <Icon name={icon} size={size === "sm" ? 15 : 18} color={look.fg} /> : null}
        <RNText style={{ color: look.fg, fontWeight: "700", fontSize: size === "sm" ? 13 : 15 }}>{title}</RNText>
      </Animated.View>
    </Pressable>
  );
}

export type Tone = "neutral" | "ok" | "warn" | "danger" | "info" | "primary";
export function Pill({ children, tone = "neutral", icon }: { children: ReactNode; tone?: Tone; icon?: IconName }) {
  const { c } = useTheme();
  const look = { neutral: [c.glass, c.muted], ok: [c.okWash, c.ok], warn: [c.warnWash, c.warn], danger: [c.dangerWash, c.danger], info: [c.infoWash, c.info], primary: [c.glassStrong, c.primaryText] }[tone] as [string, string];
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 3, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: look[0], alignSelf: "flex-start" }}>
      {icon ? <Icon name={icon} size={12} color={look[1]} /> : null}
      <RNText style={{ color: look[1], fontSize: 12, fontWeight: "700" }}>{children}</RNText>
    </View>
  );
}

/* ------------------------------------------------------------------------------------------------ loading */
/** A shimmering placeholder in the shape of what is coming. */
export function Skeleton({ height = 16, width = "100%", style }: { height?: number; width?: number | `${number}%`; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const reduced = useReducedMotion();
  const [t] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduced) { t.setValue(1); return; }
    const loop = Animated.loop(Animated.sequence([Animated.timing(t, { toValue: 1, duration: 900, useNativeDriver: true }), Animated.timing(t, { toValue: 0, duration: 900, useNativeDriver: true })]));
    loop.start();
    return () => loop.stop();
  }, [t, reduced]);
  return <Animated.View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[{ height, width, borderRadius: 8, backgroundColor: c.glassStrong, opacity: t.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }) }, style]} />;
}

export function Spinner({ size = 24, label = "Loading" }: { size?: number; label?: string }) {
  const { c } = useTheme();
  return <ActivityIndicator size={size > 28 ? "large" : "small"} color={c.primary} accessibilityLabel={label} />;
}

/** Something that fades and rises in when it first appears — a list's rows come in one after another (`index`). */
export function Reveal({ children, index = 0, style }: { children: ReactNode; index?: number; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const [t] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduced) { t.setValue(1); return; }
    Animated.timing(t, { toValue: 1, duration: 380, delay: Math.min(index, 8) * 55, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [t, index, reduced]);
  return <Animated.View style={[{ opacity: t, transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }, style]}>{children}</Animated.View>;
}

/** A number that counts up to its value (and counts from the old value to a new one). */
export function CountUp({ value, format, style, variant = "title" }: { value: number; format: (n: number) => string; style?: StyleProp<TextStyle>; variant?: keyof typeof VARIANTS }) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) { from.current = value; return; }
    const t = new Animated.Value(0);
    const id = t.addListener(({ value: p }) => setShown(from.current + (value - from.current) * p));
    Animated.timing(t, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(() => { from.current = value; setShown(value); });
    return () => { t.removeListener(id); from.current = value; };
  }, [value, reduced]);
  const text = useMemo(() => format(Math.round(reduced ? value : shown)), [reduced, value, shown, format]);
  return <Text variant={variant} style={style} accessibilityLabel={format(value)} numberOfLines={1} adjustsFontSizeToFit>{text}</Text>;
}

/**
 * An on/off switch that reads in light AND dark: the "on" track is the app's colour, the "off" track is a visible grey (iOS draws its own off-track
 * behind a see-through one, which vanishes on a dark night), and the thumb is always light.
 */
export function AppSwitch({ value, onValueChange, disabled, accessibilityLabel, testID, tone }: { value: boolean; onValueChange?: (v: boolean) => void; disabled?: boolean; accessibilityLabel?: string; testID?: string; /** the colour of the "on" track: the app's own by default; "ok" (green) or "warn" (amber) when the switch also says something */ tone?: "ok" | "warn" }) {
  const { c, dark } = useTheme();
  const off = dark ? "rgba(255,255,255,0.28)" : "rgba(22,26,51,0.28)";
  return <Switch value={value} onValueChange={onValueChange} disabled={disabled} trackColor={{ true: tone === "ok" ? c.ok : tone === "warn" ? c.warn : c.primary, false: off }} ios_backgroundColor={off} thumbColor="#FFFFFF" accessibilityLabel={accessibilityLabel} testID={testID} />;
}
