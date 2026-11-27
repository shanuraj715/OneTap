import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Animated, Easing, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Button, Icon, Text, usePressScale } from "./primitives";
import { MONTHS, WEEKDAYS, inRange, monthGrid, parseDay, prettyDay, shiftMonth, todayKey } from "./calendar";
import { radius, useResponsive, useTheme } from "./theme";

/* ------------------------------------------------------------------------------------------------ sheet */
/** A panel that slides up from the bottom (on a tablet: a centred card). Tap outside or the × to close. */
export function Sheet({ visible, onClose, title, children, footer, testID }: { visible: boolean; onClose: () => void; title?: string; children: ReactNode; footer?: ReactNode; testID?: string }) {
  const { c } = useTheme();
  const { tablet, height } = useResponsive();
  const [t] = useState(() => new Animated.Value(0));
  const [mounted, setMounted] = useState(visible);
  if (visible && !mounted) setMounted(true); // opening: draw it at once (then it slides in); closing: it stays drawn until it has slid away
  useEffect(() => {
    if (visible) Animated.timing(t, { toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    else Animated.timing(t, { toValue: 0, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => setMounted(false));
  }, [visible, t]);
  if (!mounted) return null;
  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: c.overlay, opacity: t }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" />
      </Animated.View>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, justifyContent: tablet ? "center" : "flex-end", alignItems: "center" }} pointerEvents="box-none">
        <Animated.View testID={testID} style={{ width: "100%", maxWidth: tablet ? 560 : undefined, maxHeight: height * 0.88, opacity: t, transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }) }, { scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) }] }}>
          <View style={{ borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, borderBottomLeftRadius: tablet ? radius.xl : 0, borderBottomRightRadius: tablet ? radius.xl : 0, overflow: "hidden", backgroundColor: c.solid, borderWidth: 1, borderColor: c.border }}>
            <View style={{ backgroundColor: c.glass }}>
              {!tablet ? <View style={{ alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: c.border, marginTop: 8 }} /> : null}
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 14, paddingBottom: 6 }}>
                <Text variant="heading" accessibilityRole="header">{title ?? ""}</Text>
                <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={12}><Icon name="close" size={22} color={c.muted} /></Pressable>
              </View>
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: footer ? 8 : 24, gap: 12 }}>{children}</ScrollView>
              {footer ? <View style={{ paddingHorizontal: 20, paddingVertical: 14, flexDirection: "row", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>{footer}</View> : null}
            </View>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ------------------------------------------------------------------------------------------------ a labelled field */
export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Text variant="label" tone="muted">{label}</Text>
      {children}
      {error ? <Text variant="caption" tone="danger">{error}</Text> : hint ? <Text variant="caption" tone="muted">{hint}</Text> : null}
    </View>
  );
}

/** A text box in the glass style. */
export function Input({ value, onChangeText, placeholder, secure, keyboardType, autoCapitalize = "none", multiline, testID, editable = true, onSubmitEditing, returnKeyType, leftIcon, maxLength }: {
  value: string; onChangeText: (t: string) => void; placeholder?: string; secure?: boolean; keyboardType?: "default" | "email-address" | "numeric" | "phone-pad"; autoCapitalize?: "none" | "sentences" | "words";
  multiline?: boolean; testID?: string; editable?: boolean; onSubmitEditing?: () => void; returnKeyType?: "next" | "go" | "done"; leftIcon?: Parameters<typeof Icon>[0]["name"]; maxLength?: number;
}) {
  const { c, dark } = useTheme();
  const [focus, setFocus] = useState(false);
  const [shown, setShown] = useState(false);
  return (
    <View style={{ flexDirection: "row", alignItems: multiline ? "flex-start" : "center", gap: 10, paddingHorizontal: 14, minHeight: 50, borderRadius: radius.md, backgroundColor: c.field, borderWidth: 1.5, borderColor: focus ? c.primary : c.fieldBorder, opacity: editable ? 1 : 0.6 }}>
      {leftIcon ? <Icon name={leftIcon} size={18} color={c.muted} /> : null}
      <TextInput testID={testID} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={c.muted} secureTextEntry={secure && !shown} keyboardType={keyboardType} autoCapitalize={autoCapitalize} autoCorrect={false} keyboardAppearance={dark ? "dark" : "light"} selectionColor={c.primary}
        multiline={multiline} editable={editable} maxLength={maxLength} onSubmitEditing={onSubmitEditing} returnKeyType={returnKeyType} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
        style={{ flex: 1, color: c.text, fontSize: 16, paddingVertical: multiline ? 12 : 10, minHeight: multiline ? 90 : undefined, textAlignVertical: multiline ? "top" : "center" }} />
      {secure ? <Pressable onPress={() => setShown((s) => !s)} hitSlop={10} accessibilityRole="button" accessibilityLabel={shown ? "Hide the password" : "Show the password"}><Icon name={shown ? "eyeOff" : "eye"} size={18} color={c.muted} /></Pressable> : null}
    </View>
  );
}

/* ------------------------------------------------------------------------------------------------ dropdown */
export interface Option<T extends string = string> { value: T; label: string; hint?: string }
/** A dropdown: the box shows the choice; pressing it opens a sheet with the options (and a search box when there are many). */
export function Select<T extends string = string>({ label, value, options, onChange, placeholder = "Choose…", searchable, testID, disabled }: { label?: string; value: T | ""; options: Option<T>[]; onChange: (v: T) => void; placeholder?: string; searchable?: boolean; testID?: string; disabled?: boolean }) {
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const press = usePressScale(0.99);
  const chosen = options.find((o) => o.value === value);
  const shown = useMemo(() => (q.trim() ? options.filter((o) => `${o.label} ${o.hint ?? ""}`.toLowerCase().includes(q.trim().toLowerCase())) : options), [options, q]);
  const body = (
    <Pressable testID={testID} disabled={disabled} onPress={() => { setQ(""); setOpen(true); }} onPressIn={press.onPressIn} onPressOut={press.onPressOut} accessibilityRole="button" accessibilityLabel={`${label ?? "Choice"}: ${chosen?.label ?? placeholder}`}>
      <Animated.View style={[press.style, { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, minHeight: 50, borderRadius: radius.md, backgroundColor: c.field, borderWidth: 1.5, borderColor: c.fieldBorder, opacity: disabled ? 0.6 : 1 }]}>
        <Text style={{ flex: 1 }} tone={chosen ? "normal" : "muted"} numberOfLines={1}>{chosen?.label ?? placeholder}</Text>
        <Icon name="down" size={18} color={c.muted} />
      </Animated.View>
    </Pressable>
  );
  return (
    <>
      {label ? <Field label={label}>{body}</Field> : body}
      <Sheet visible={open} onClose={() => setOpen(false)} title={label ?? "Choose"} testID={testID ? `${testID}-sheet` : undefined}>
        {searchable || options.length > 8 ? <Input value={q} onChangeText={setQ} placeholder="Search" leftIcon="search" autoCapitalize="none" testID={testID ? `${testID}-search` : undefined} /> : null}
        {shown.length ? shown.map((o) => {
          const on = o.value === value;
          return (
            <Pressable key={o.value} onPress={() => { onChange(o.value); setOpen(false); }} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={o.label} testID={testID ? `${testID}-option-${o.value}` : undefined}
              style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 13, paddingHorizontal: 14, borderRadius: radius.md, backgroundColor: on ? c.glassStrong : "transparent", borderWidth: on ? 1 : 0, borderColor: c.border }}>
              <View style={{ flex: 1 }}>
                <Text variant="subheading">{o.label}</Text>
                {o.hint ? <Text variant="caption" tone="muted">{o.hint}</Text> : null}
              </View>
              {on ? <Icon name="check" size={18} color={c.primaryText} /> : null}
            </Pressable>
          );
        }) : <Text tone="muted">Nothing matches “{q}”.</Text>}
      </Sheet>
    </>
  );
}

/* ------------------------------------------------------------------------------------------------ date picker */
/** A date box; pressing it opens a calendar sheet (month by month, today ringed, the chosen day filled). The value is "YYYY-MM-DD" or "". */
export function DateField({ label, value, onChange, min, max, placeholder = "Choose a date", testID, clearable = true }: { label?: string; value: string; onChange: (v: string) => void; min?: string; max?: string; placeholder?: string; testID?: string; clearable?: boolean }) {
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  const start = parseDay(value) ?? parseDay(todayKey())!;
  const [view, setView] = useState({ y: start.y, m: start.m });
  const press = usePressScale(0.99);
  const grid = useMemo(() => monthGrid(view.y, view.m), [view]);
  const today = todayKey();
  const body = (
    <Pressable testID={testID} onPress={() => { const p = parseDay(value) ?? parseDay(today)!; setView({ y: p.y, m: p.m }); setOpen(true); }} onPressIn={press.onPressIn} onPressOut={press.onPressOut} accessibilityRole="button" accessibilityLabel={`${label ?? "Date"}: ${value ? prettyDay(value) : placeholder}`}>
      <Animated.View style={[press.style, { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, minHeight: 50, borderRadius: radius.md, backgroundColor: c.field, borderWidth: 1.5, borderColor: c.fieldBorder }]}>
        <Icon name="calendar" size={18} color={c.primaryText} />
        <Text style={{ flex: 1 }} tone={value ? "normal" : "muted"}>{value ? prettyDay(value) : placeholder}</Text>
      </Animated.View>
    </Pressable>
  );
  return (
    <>
      {label ? <Field label={label}>{body}</Field> : body}
      <Sheet visible={open} onClose={() => setOpen(false)} title={label ?? "Choose a date"} testID={testID ? `${testID}-sheet` : undefined}
        footer={<>{clearable && value ? <Button title="Clear" variant="ghost" onPress={() => { onChange(""); setOpen(false); }} /> : null}<Button title="Today" variant="glass" disabled={!inRange(today, min, max)} onPress={() => { onChange(today); setOpen(false); }} /></>}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Pressable onPress={() => setView(shiftMonth(view.y, view.m, -1))} accessibilityRole="button" accessibilityLabel="Previous month" hitSlop={10} style={{ padding: 8 }}><Icon name="left" size={22} /></Pressable>
          <Text variant="subheading" testID={testID ? `${testID}-month` : undefined}>{MONTHS[view.m]} {view.y}</Text>
          <Pressable onPress={() => setView(shiftMonth(view.y, view.m, 1))} accessibilityRole="button" accessibilityLabel="Next month" hitSlop={10} style={{ padding: 8 }}><Icon name="chevron" size={22} /></Pressable>
        </View>
        <View style={{ flexDirection: "row" }}>{WEEKDAYS.map((w) => <View key={w} style={{ flex: 1, alignItems: "center" }}><Text variant="caption" tone="muted">{w}</Text></View>)}</View>
        {grid.map((week, wi) => (
          <View key={wi} style={{ flexDirection: "row" }}>
            {week.map((d, di) => {
              if (!d) return <View key={di} style={{ flex: 1, height: 44 }} />;
              const on = d === value, ok = inRange(d, min, max), isToday = d === today;
              return (
                <Pressable key={d} disabled={!ok} onPress={() => { onChange(d); setOpen(false); }} accessibilityRole="button" accessibilityState={{ selected: on, disabled: !ok }} accessibilityLabel={prettyDay(d)} testID={testID ? `${testID}-day-${d}` : undefined} style={{ flex: 1, height: 44, alignItems: "center", justifyContent: "center" }}>
                  <View style={{ width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: on ? c.primary : "transparent", borderWidth: isToday && !on ? 1.5 : 0, borderColor: c.primaryText }}>
                    <Text variant="label" style={{ color: on ? c.onPrimary : ok ? c.text : c.muted, opacity: ok ? 1 : 0.4 }}>{Number(d.slice(8))}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </Sheet>
    </>
  );
}

/** A yes / no question in a sheet: the red button does the thing. */
export function ConfirmSheet({ visible, title, message, confirm, danger = true, busy, onConfirm, onClose, children }: { visible: boolean; title: string; message: string; confirm: string; danger?: boolean; busy?: boolean; onConfirm: () => void; onClose: () => void; children?: ReactNode }) {
  return (
    <Sheet visible={visible} onClose={onClose} title={title} testID="confirm-sheet" footer={<><Button title="Cancel" variant="glass" onPress={onClose} /><Button title={confirm} variant={danger ? "danger" : "primary"} loading={busy} onPress={onConfirm} testID="confirm-yes" /></>}>
      <Text tone="muted" style={{ lineHeight: 21 }}>{message}</Text>
      {children}
    </Sheet>
  );
}

