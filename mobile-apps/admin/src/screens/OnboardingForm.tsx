import { useEffect, useMemo, useState } from "react";
import { Switch, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useApi } from "@/runtime";
import type { OnboardingData, OnboardingOutlet } from "@/api/endpoints";
import { useAction, messageOf } from "@/data/useAction";
import { makePassword, strongEnough } from "@/lib/password";
import { BUSINESS_TYPES, FEATURE_CHOICES, MENU_SOURCES, ORDER_MODE_CHOICES, beyondPlan, blankForm, isHHMM, newOutlet, offeredPlans, planHas, pointFrom, pruneForced, slugify } from "@/lib/onboarding";
import { Button, ConfirmSheet, DateField, ErrorState, Field, Glass, Input, LoadingCards, Pill, Screen, Section, Select, Sheet, Text, toasts, useTheme } from "@/ui";

/* ------------------------------------------------------------------------------------------------ small pieces */
function Toggle({ label, hint, value, onChange, disabled, testID }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean; testID?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, opacity: disabled ? 0.55 : 1 }}>
      <View style={{ flex: 1 }}>
        <Text variant="subheading">{label}</Text>
        {hint ? <Text variant="caption" tone="muted">{hint}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} disabled={disabled} trackColor={{ true: c.primary, false: c.glassStrong }} accessibilityLabel={label} testID={testID} />
    </View>
  );
}
const num = (t: string, max = 1_000_000) => Math.min(max, Number(t.replace(/\D/g, "")) || 0);

/* ------------------------------------------------------------------------------------------------ the form */
/** One client's requirement form: the plan first (it decides what the rest may ask for), then the business, outlets and settings. Save any time; publish when the server says it is ready. */
export function OnboardingForm({ id }: { id: string }) {
  const api = useApi();
  const qc = useQueryClient();
  const isNew = id === "new";
  const loaded = useQuery({ queryKey: ["onboarding", id], queryFn: () => api.onboarding(id), enabled: !isNew });
  const plansQ = useQuery({ queryKey: ["plans"], queryFn: () => api.plans() });
  const plans = useMemo(() => offeredPlans(plansQ.data?.plans ?? []), [plansQ.data]);
  const [data, setData] = useState<OnboardingData>(blankForm);
  const [formId, setFormId] = useState<string | null>(isNew ? null : id);
  const [seeded, setSeeded] = useState(isNew);
  const [dirty, setDirty] = useState(false);
  const [dialog, setDialog] = useState<null | "leave" | "reset" | "delete" | "publish">(null);
  const [password, setPassword] = useState("");
  const [published, setPublished] = useState<null | { store: string; email: string; password: string }>(null);

  if (!seeded && loaded.data) { setSeeded(true); setData(loaded.data.form.data); } // the saved form arrives once
  const form = loaded.data?.form;
  const readOnly = form?.status === "published" || Boolean(published);
  const plan = plans.find((p) => p.id === data.planId);

  const set = (patch: Partial<OnboardingData>) => { setData((d) => ({ ...d, ...patch })); setDirty(true); };
  const group = <K extends "meeting" | "business" | "common" | "address" | "setup" | "customLimits">(k: K, patch: Partial<OnboardingData[K]>) => set({ [k]: { ...(data[k] as object), ...patch } } as Partial<OnboardingData>);
  const setOutlet = (oid: string, patch: Partial<OnboardingOutlet>) => set({ outlets: data.outlets.map((o) => (o.id === oid ? { ...o, ...patch } : o)) });

  // what is asked beyond the plan, and which of those were allowed anyway
  const beyond = useMemo(() => beyondPlan(data, plan), [data, plan]);
  const allow = (key: string, on: boolean) => set({ forced: on ? [...new Set([...data.forced, key])] : data.forced.filter((f) => f !== key) });

  const check = useQuery({ queryKey: ["onboarding-check", formId], queryFn: () => api.checkOnboarding(formId!), enabled: Boolean(formId) && !readOnly && !dirty });

  const save = useAction(async (_: void) => {
    const body = { ...data, forced: pruneForced(data, plan) };
    const r = formId ? await api.saveOnboarding(formId, body) : await api.createOnboarding(body);
    setFormId(r.form.id); setData(r.form.data); setDirty(false);
    void qc.invalidateQueries({ queryKey: ["onboarding"] }); void qc.invalidateQueries({ queryKey: ["onboarding-check"] });
    return r;
  }, { done: "Saved." });
  const remove = useAction(() => api.deleteOnboarding(formId!), { done: "The draft is deleted.", invalidate: [["onboarding"]], onDone: () => router.replace("/onboarding") });
  const publish = useAction((pw: string) => api.publishOnboarding(formId!, pw), {
    done: "Published as a store.", invalidate: [["onboarding"], ["stores"], ["dashboard"]],
    onDone: () => { setPublished({ store: data.business.storeName, email: data.business.ownerEmail, password }); setDialog(null); },
  });

  useEffect(() => { if (!isNew && loaded.isError) toasts.error(messageOf(loaded.error)); }, [isNew, loaded.isError, loaded.error]);
  const leave = () => (dirty && !readOnly ? setDialog("leave") : router.back());

  if (!isNew && loaded.isLoading) return <Screen title="Requirement form" back={() => router.back()}><LoadingCards n={3} /></Screen>;
  if (!isNew && (loaded.isError || !form)) return <Screen title="Requirement form" back={() => router.back()}><ErrorState error={loaded.error ?? new Error("No answer from the server.")} onRetry={() => void loaded.refetch()} /></Screen>;

  const ro = readOnly;
  const b = data.business;
  const planOptions = plans.map((p) => ({ value: p.id, label: p.name, hint: p.custom ? "Limits set by hand" : [p.limits.maxOutlets === null ? "any outlets" : `${p.limits.maxOutlets} outlet${p.limits.maxOutlets === 1 ? "" : "s"}`, p.limits.maxUsers === null ? "any people" : `${p.limits.maxUsers} people`].join(" · ") }));
  const subdomain = data.address.subdomain || slugify(b.storeName);
  const checkNow = check.data;
  const problems = [...(checkNow?.errors ?? []).map((e) => e.message), ...(checkNow?.server ?? []).map((e) => e.message)];
  const fitIssues = checkNow?.fit.issues ?? [];

  return (
    <Screen title={b.storeName.trim() || "New requirement form"} subtitle={ro ? "Published as a store" : formId ? (dirty ? "Unsaved changes" : "Draft, saved") : "Not saved yet"} back={leave} testID="screen-onboarding-form"
      right={!ro ? <Button size="sm" icon="check" title="Save" loading={save.isPending} disabled={!dirty && Boolean(formId)} onPress={() => save.mutate()} testID="form-save" /> : undefined}>
      {ro ? <Glass strong><Text variant="body" testID="form-published">This form was published as a store{form?.publishedAt ? "" : ""}. It stays here to read; the store is managed under Stores.</Text></Glass> : null}

      <Section title="Plan" hint="Choose it first: it decides what the rest of the form may ask for.">
        <Glass><View style={{ gap: 12 }}>
          <Select label="Plan" value={data.planId} options={planOptions} onChange={(v) => set({ planId: v, forced: [] })} disabled={ro} testID="form-plan" />
          {plan?.custom ? (
            <View style={{ gap: 10 }}>
              <Text variant="caption" tone="muted">A Custom plan includes nothing by itself: set the limits for this client.</Text>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}><Field label="Outlets"><Input value={String(data.customLimits.maxOutlets)} onChangeText={(t) => group("customLimits", { maxOutlets: Math.max(1, num(t, 500)) })} keyboardType="numeric" editable={!ro} testID="form-max-outlets" /></Field></View>
                <View style={{ flex: 1 }}><Field label="People"><Input value={String(data.customLimits.maxUsers)} onChangeText={(t) => group("customLimits", { maxUsers: Math.max(1, num(t, 5000)) })} keyboardType="numeric" editable={!ro} testID="form-max-users" /></Field></View>
              </View>
            </View>
          ) : null}
        </View></Glass>
      </Section>

      <Section title="Meeting">
        <Glass><View style={{ gap: 12 }}>
          <Field label="Representative"><Input value={data.meeting.repName} onChangeText={(t) => group("meeting", { repName: t })} autoCapitalize="words" editable={!ro} testID="form-rep" /></Field>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}><DateField label="Meeting date" value={data.meeting.date} onChange={(v) => group("meeting", { date: v })} testID="form-date" clearable={!ro} /></View>
            <View style={{ flex: 1 }}><DateField label="Go-live" value={data.meeting.goLive} onChange={(v) => group("meeting", { goLive: v })} testID="form-golive" min={data.meeting.date || undefined} clearable={!ro} /></View>
          </View>
          <Field label="Notes"><Input value={data.meeting.notes} onChangeText={(t) => group("meeting", { notes: t })} multiline autoCapitalize="sentences" editable={!ro} testID="form-notes" /></Field>
        </View></Glass>
      </Section>

      <Section title="Business and owner">
        <Glass><View style={{ gap: 12 }}>
          <Field label="Store name" hint={b.storeName.trim() ? `Its address will be ${subdomain}` : undefined}><Input value={b.storeName} onChangeText={(t) => group("business", { storeName: t })} autoCapitalize="words" editable={!ro} testID="form-store" /></Field>
          <Field label="Tagline"><Input value={b.tagline} onChangeText={(t) => group("business", { tagline: t })} autoCapitalize="sentences" editable={!ro} /></Field>
          <Select label="Business type" value={b.type} options={BUSINESS_TYPES.map((t) => ({ value: t, label: t }))} onChange={(v) => group("business", { type: v })} disabled={ro} testID="form-type" />
          <Field label="Owner's name"><Input value={b.ownerName} onChangeText={(t) => group("business", { ownerName: t })} autoCapitalize="words" editable={!ro} testID="form-owner" /></Field>
          <Field label="Owner's email" hint="It becomes their sign-in."><Input value={b.ownerEmail} onChangeText={(t) => group("business", { ownerEmail: t.trim() })} keyboardType="email-address" editable={!ro} testID="form-email" /></Field>
          <Field label="Owner's phone"><Input value={b.ownerPhone} onChangeText={(t) => group("business", { ownerPhone: t })} keyboardType="phone-pad" editable={!ro} testID="form-phone" /></Field>
          <Field label="City"><Input value={b.city} onChangeText={(t) => group("business", { city: t })} autoCapitalize="words" editable={!ro} /></Field>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}><Field label="GSTIN"><Input value={b.gstin} onChangeText={(t) => group("business", { gstin: t.toUpperCase() })} editable={!ro} /></Field></View>
            <View style={{ flex: 1 }}><Field label="FSSAI"><Input value={b.fssai} onChangeText={(t) => group("business", { fssai: t })} keyboardType="numeric" editable={!ro} /></Field></View>
          </View>
        </View></Glass>
      </Section>

      <Section title="Features" hint={plan && !plan.custom ? `What ${plan.name} includes is on; the rest can be added for this client.` : "What the client wants besides ordering."}>
        <Glass><View style={{ gap: 14 }}>
          {FEATURE_CHOICES.map((f) => {
            const inPlan = planHas(plan, f.key);
            const on = data.features.includes(f.key);
            return (
              <View key={f.key} style={{ gap: 6 }}>
                <Toggle label={f.label} value={on} disabled={ro} testID={`feature-${f.key}`} hint={on && !inPlan ? `Not in the ${plan?.name} plan` : undefined}
                  onChange={(v) => set({ features: v ? [...data.features, f.key] : data.features.filter((x) => x !== f.key), ...(v ? {} : { forced: data.forced.filter((x) => x !== `feature:${f.key}`) }) })} />
                {on && !inPlan ? <Toggle label="Allow anyway" hint="Unlock it for this client although the plan lacks it." value={data.forced.includes(`feature:${f.key}`)} onChange={(v) => allow(`feature:${f.key}`, v)} disabled={ro} testID={`allow-feature:${f.key}`} /> : null}
              </View>
            );
          })}
        </View></Glass>
      </Section>

      <Section title="Outlets" hint={`${data.outlets.length} outlet${data.outlets.length === 1 ? "" : "s"}`} action={!ro ? <Button size="sm" variant="glass" icon="plus" title="Add outlet" onPress={() => set({ outlets: [...data.outlets, newOutlet()] })} testID="add-outlet" /> : undefined}>
        <View style={{ gap: 12 }}>
          {data.outlets.map((o, i) => (
            <Glass key={o.id} testID={`outlet-${i}`}><View style={{ gap: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text variant="heading">Outlet {i + 1}</Text>
                {!ro && data.outlets.length > 1 ? <Button size="sm" variant="ghost" icon="trash" title="Remove" onPress={() => set({ outlets: data.outlets.filter((x) => x.id !== o.id) })} testID={`remove-outlet-${i}`} /> : null}
              </View>
              <Field label="Name"><Input value={o.name} onChangeText={(t) => setOutlet(o.id, { name: t })} autoCapitalize="words" editable={!ro} testID={`outlet-name-${i}`} /></Field>
              <Field label="Web address (slug)" hint={`Left empty it is ${slugify(o.name) || "made from the name"}.`}><Input value={o.slug} onChangeText={(t) => setOutlet(o.id, { slug: slugify(t) })} editable={!ro} testID={`outlet-slug-${i}`} /></Field>
              <Field label="Phone"><Input value={o.phone} onChangeText={(t) => setOutlet(o.id, { phone: t })} keyboardType="phone-pad" editable={!ro} /></Field>
              <Field label="Address"><Input value={o.address} onChangeText={(t) => setOutlet(o.id, { address: t })} multiline autoCapitalize="sentences" editable={!ro} testID={`outlet-address-${i}`} /></Field>
              <MapPoint outlet={o} readOnly={ro} index={i} onChange={(patch) => setOutlet(o.id, patch)} />
              <View style={{ gap: 12 }}>
                <Text variant="label" tone="muted">How customers order</Text>
                {ORDER_MODE_CHOICES.map((m) => {
                  const inPlan = planHas(plan, m.feature);
                  return (
                    <View key={m.key} style={{ gap: 6 }}>
                      <Toggle label={m.label} value={o.modes[m.key]} onChange={(v) => setOutlet(o.id, { modes: { ...o.modes, [m.key]: v } })} disabled={ro} testID={`mode-${m.key}-${i}`} hint={o.modes[m.key] && !inPlan ? `Not in the ${plan?.name} plan` : undefined} />
                      {o.modes[m.key] && !inPlan ? <Toggle label="Allow anyway" value={data.forced.includes(`feature:${m.feature}`)} onChange={(v) => allow(`feature:${m.feature}`, v)} disabled={ro} testID={`allow-feature:${m.feature}-${i}`} /> : null}
                    </View>
                  );
                })}
              </View>
              {o.modes.delivery ? (
                <View style={{ gap: 10 }}>
                  <Text variant="label" tone="muted">Delivery</Text>
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <View style={{ flex: 1 }}><Field label="Distance (km)"><Input value={String(o.delivery.radiusKm)} onChangeText={(t) => setOutlet(o.id, { delivery: { ...o.delivery, radiusKm: Math.min(50, Number(t.replace(/[^\d.]/g, "")) || 0) } })} keyboardType="numeric" editable={!ro} testID={`delivery-km-${i}`} /></Field></View>
                    <View style={{ flex: 1 }}><Field label="Fee (₹)"><Input value={String(o.delivery.fee)} onChangeText={(t) => setOutlet(o.id, { delivery: { ...o.delivery, fee: num(t, 100000) } })} keyboardType="numeric" editable={!ro} /></Field></View>
                  </View>
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <View style={{ flex: 1 }}><Field label="Free above (₹)"><Input value={String(o.delivery.freeAbove)} onChangeText={(t) => setOutlet(o.id, { delivery: { ...o.delivery, freeAbove: num(t) } })} keyboardType="numeric" editable={!ro} /></Field></View>
                    <View style={{ flex: 1 }}><Field label="Minimum order (₹)"><Input value={String(o.delivery.minOrder)} onChangeText={(t) => setOutlet(o.id, { delivery: { ...o.delivery, minOrder: num(t) } })} keyboardType="numeric" editable={!ro} /></Field></View>
                  </View>
                </View>
              ) : null}
              <Toggle label="Same hours as the other outlets" value={o.hours.useCommon} onChange={(v) => setOutlet(o.id, { hours: { ...o.hours, useCommon: v } })} disabled={ro} testID={`hours-common-${i}`} />
              {!o.hours.useCommon ? (
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <View style={{ flex: 1 }}><Field label="Opens" error={isHHMM(o.hours.opensAt) ? undefined : "Like 11:00"}><Input value={o.hours.opensAt} onChangeText={(t) => setOutlet(o.id, { hours: { ...o.hours, opensAt: t } })} editable={!ro} testID={`hours-open-${i}`} /></Field></View>
                  <View style={{ flex: 1 }}><Field label="Closes" error={isHHMM(o.hours.closesAt) ? undefined : "Like 23:00"}><Input value={o.hours.closesAt} onChangeText={(t) => setOutlet(o.id, { hours: { ...o.hours, closesAt: t } })} editable={!ro} testID={`hours-close-${i}`} /></Field></View>
                </View>
              ) : null}
            </View></Glass>
          ))}
          {beyond.some((x) => x.id === "outlets") ? (
            <Glass><View style={{ gap: 8 }}>
              <Text variant="body" tone="warn">{beyond.find((x) => x.id === "outlets")!.label}. Remove outlets, choose another plan, or add the extra ones for this client.</Text>
              <Toggle label="Allow anyway" value={data.forced.includes("outlets")} onChange={(v) => allow("outlets", v)} disabled={ro} testID="allow-outlets" />
            </View></Glass>
          ) : null}
        </View>
      </Section>

      <Section title="Common settings" hint="Used by every outlet that has no hours of its own.">
        <Glass><View style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}><Field label="Opens" error={isHHMM(data.common.hours.opensAt) ? undefined : "Like 11:00"}><Input value={data.common.hours.opensAt} onChangeText={(t) => set({ common: { ...data.common, hours: { ...data.common.hours, opensAt: t } } })} editable={!ro} testID="common-open" /></Field></View>
            <View style={{ flex: 1 }}><Field label="Closes" error={isHHMM(data.common.hours.closesAt) ? undefined : "Like 23:00"}><Input value={data.common.hours.closesAt} onChangeText={(t) => set({ common: { ...data.common, hours: { ...data.common.hours, closesAt: t } } })} editable={!ro} testID="common-close" /></Field></View>
          </View>
          <Field label="Preparation time (minutes)"><Input value={String(data.common.prepMinutes)} onChangeText={(t) => group("common", { prepMinutes: Math.min(180, Math.max(1, num(t))) })} keyboardType="numeric" editable={!ro} /></Field>
          <Toggle label="Cash" value={data.common.payments.cash} onChange={(v) => set({ common: { ...data.common, payments: { ...data.common.payments, cash: v } } })} disabled={ro} />
          <Toggle label="Online payments" value={data.common.payments.online} onChange={(v) => set({ common: { ...data.common, payments: { ...data.common.payments, online: v } } })} disabled={ro} />
          <Toggle label="Prices include GST" value={data.common.tax.pricesIncludeTax} onChange={(v) => set({ common: { ...data.common, tax: { ...data.common.tax, pricesIncludeTax: v } } })} disabled={ro} />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}><Field label="GST (%)"><Input value={String(data.common.tax.gstRatePct)} onChangeText={(t) => set({ common: { ...data.common, tax: { ...data.common.tax, gstRatePct: Math.min(40, Number(t.replace(/[^\d.]/g, "")) || 0) } } })} keyboardType="numeric" editable={!ro} /></Field></View>
            <View style={{ flex: 1 }}><Field label="Service charge (%)"><Input value={String(data.common.tax.serviceChargePct)} onChangeText={(t) => set({ common: { ...data.common, tax: { ...data.common.tax, serviceChargePct: Math.min(25, Number(t.replace(/[^\d.]/g, "")) || 0) } } })} keyboardType="numeric" editable={!ro} /></Field></View>
          </View>
        </View></Glass>
      </Section>

      <Section title="Address">
        <Glass><View style={{ gap: 12 }}>
          <AddressField value={data.address.subdomain} fallback={slugify(b.storeName)} readOnly={ro} onChange={(v) => group("address", { subdomain: v })} />
          <Field label="Own domain" hint={planHas(plan, "customDomain") ? "Optional, like dominos.com" : `Not in the ${plan?.name ?? "chosen"} plan; add "Own domain name" under Features first.`}><Input value={data.address.ownDomain} onChangeText={(t) => group("address", { ownDomain: t.trim().toLowerCase() })} editable={!ro} testID="form-own-domain" /></Field>
        </View></Glass>
      </Section>

      <Section title="Setup notes">
        <Glass><View style={{ gap: 12 }}>
          <Select label="How the menu will arrive" value={data.setup.menuSource} options={MENU_SOURCES.map((t) => ({ value: t, label: t }))} onChange={(v) => group("setup", { menuSource: v })} disabled={ro} />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}><Field label="Dishes (about)"><Input value={data.setup.itemCount} onChangeText={(t) => group("setup", { itemCount: t.replace(/[^\d]/g, "") })} keyboardType="numeric" editable={!ro} /></Field></View>
            <View style={{ flex: 1 }}><Field label="Team members"><Input value={String(data.setup.teamCount)} onChangeText={(t) => group("setup", { teamCount: num(t, 500) })} keyboardType="numeric" editable={!ro} testID="form-team" /></Field></View>
          </View>
          {beyond.some((x) => x.id === "users") ? (
            <View style={{ gap: 6 }}><Text variant="caption" tone="warn">{beyond.find((x) => x.id === "users")!.label}.</Text><Toggle label="Allow anyway" value={data.forced.includes("users")} onChange={(v) => allow("users", v)} disabled={ro} testID="allow-users" /></View>
          ) : null}
          <Field label="Printers"><Input value={data.setup.printers} onChangeText={(t) => group("setup", { printers: t })} autoCapitalize="sentences" editable={!ro} /></Field>
          <Field label="Other notes"><Input value={data.setup.notes} onChangeText={(t) => group("setup", { notes: t })} multiline autoCapitalize="sentences" editable={!ro} /></Field>
        </View></Glass>
      </Section>

      {!ro ? (
        <Section title="Ready to publish?" hint="Save first; the server then checks everything, including that the address and the owner's email are free.">
          <Glass strong testID="form-check"><View style={{ gap: 10 }}>
            {!formId || dirty ? <Text tone="muted">Save the form to see whether it is ready.</Text> : check.isLoading ? <Text tone="muted">Checking…</Text> : checkNow ? (
              <>
                <Pill tone={checkNow.ready ? "ok" : "warn"}>{checkNow.ready ? "Ready to publish" : "Not ready yet"}</Pill>
                {problems.map((p, i) => <Text key={i} variant="body" tone="warn" testID="form-problem">{p}</Text>)}
                {fitIssues.map((f) => <Text key={f.id} variant="body" tone={f.forced ? "muted" : "warn"} testID="form-fit">{f.forced ? "Allowed anyway: " : ""}{f.message}</Text>)}
              </>
            ) : null}
          </View></Glass>
          <View style={{ gap: 10, marginTop: 12 }}>
            <Button title="Publish as store" icon="check" disabled={!checkNow?.ready || dirty || !formId} onPress={() => { setPassword(makePassword()); setDialog("publish"); }} testID="form-publish" />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}><Button title="Reset" icon="refresh" variant="glass" onPress={() => setDialog("reset")} testID="form-reset" /></View>
              {formId ? <View style={{ flex: 1 }}><Button title="Delete draft" icon="trash" variant="glass" onPress={() => setDialog("delete")} testID="form-delete" /></View> : null}
            </View>
          </View>
        </Section>
      ) : null}

      <Sheet visible={dialog === "publish"} onClose={() => setDialog(null)} title="Publish as a store" testID="publish-sheet"
        footer={<><Button title="Cancel" variant="glass" onPress={() => setDialog(null)} /><Button title="Create the store" loading={publish.isPending} disabled={!strongEnough(password)} onPress={() => publish.mutate(password)} testID="publish-yes" /></>}>
        <View style={{ gap: 12 }}>
          <Text variant="body">This creates <Text variant="subheading">{b.storeName}</Text> on the {plan?.name} plan with {data.outlets.length} outlet{data.outlets.length === 1 ? "" : "s"}, and an owner login for <Text variant="subheading">{b.ownerEmail}</Text>.</Text>
          {data.forced.length ? <Text variant="caption" tone="warn">Unlocked beyond the plan: {data.forced.join(", ")}.</Text> : null}
          <Field label="Owner's password" hint="Shown to you once. 10+ characters with a letter and a number."><Input value={password} onChangeText={setPassword} testID="publish-password" /></Field>
          <Button title="Make another" variant="glass" icon="refresh" onPress={() => setPassword(makePassword())} />
        </View>
      </Sheet>
      <Sheet visible={Boolean(published)} onClose={() => router.replace("/onboarding")} title="Store created" testID="published-sheet" footer={<Button title="Done" onPress={() => router.replace("/onboarding")} testID="published-done" />}>
        <View style={{ gap: 10 }}>
          <Text variant="body">{published?.store} is live. Send the owner these sign-in details now: the password is not kept anywhere you can read it again.</Text>
          <Glass><Text variant="subheading" selectable testID="published-email">{published?.email}</Text><Text variant="subheading" selectable testID="published-password">{published?.password}</Text></Glass>
        </View>
      </Sheet>
      <ConfirmSheet visible={dialog === "leave"} title="Discard your changes?" message="This form has changes you have not saved." confirm="Discard" onConfirm={() => { setDialog(null); setDirty(false); router.back(); }} onClose={() => setDialog(null)} />
      <ConfirmSheet visible={dialog === "reset"} title="Clear every answer?" message="The form goes back to empty. The saved copy stays until you press Save." confirm="Clear" onConfirm={() => { setData(blankForm()); setDirty(true); setDialog(null); }} onClose={() => setDialog(null)} />
      <ConfirmSheet visible={dialog === "delete"} title="Delete this draft?" message="It cannot be brought back." confirm="Delete" busy={remove.isPending} onConfirm={() => remove.mutate()} onClose={() => setDialog(null)} />
    </Screen>
  );
}

/* ------------------------------------------------------------------------------------------------ map point and address */
/** Paste a Google Maps link (or "lat, lng"): the point is read from it, or by the server for a short link. Delivery distances are measured from this point. */
function MapPoint({ outlet: o, onChange, readOnly, index }: { outlet: OnboardingOutlet; onChange: (p: Partial<OnboardingOutlet>) => void; readOnly: boolean; index: number }) {
  const api = useApi();
  const [error, setError] = useState("");
  const resolve = useAction(async (link: string) => { const r = await api.resolveMap(link); onChange({ point: r.point }); return r; }, { done: "Location found." });
  const type = (t: string) => { setError(""); const p = pointFrom(t); onChange({ mapsLink: t, point: p ?? (t.trim() ? o.point : null) }); };
  return (
    <View style={{ gap: 8 }}>
      <Field label="Map location" hint="Paste a Google Maps link, or type latitude, longitude." error={error || undefined}>
        <Input value={o.mapsLink} onChangeText={type} editable={!readOnly} testID={`outlet-map-${index}`} leftIcon="outlet" />
      </Field>
      {o.point ? <Text variant="caption" tone="ok" testID={`outlet-point-${index}`}>{o.point.lat.toFixed(5)}, {o.point.lng.toFixed(5)}</Text> : null}
      {!readOnly && o.mapsLink.trim() && !pointFrom(o.mapsLink) ? (
        <Button size="sm" variant="glass" icon="search" title="Find the location" loading={resolve.isPending} testID={`outlet-find-${index}`}
          onPress={() => resolve.mutate(o.mapsLink, { onError: (e) => setError(messageOf(e)) })} />
      ) : null}
    </View>
  );
}

/** The store's free Rasoi Pulse address, with a live "is it free?" answer. */
function AddressField({ value, fallback, onChange, readOnly }: { value: string; fallback: string; onChange: (v: string) => void; readOnly: boolean }) {
  const api = useApi();
  const label = slugify(value || fallback);
  const [typed, setTyped] = useState(label);
  useEffect(() => { const t = setTimeout(() => setTyped(label), 450); return () => clearTimeout(t); }, [label]);
  const q = useQuery({ queryKey: ["address", typed], queryFn: () => api.checkAddress(typed), enabled: Boolean(typed) && !readOnly });
  return (
    <Field label="Rasoi Pulse address" hint={value ? undefined : fallback ? `Left empty it is ${fallback}.` : "Made from the store's name."}>
      <View style={{ gap: 6 }}>
        <Input value={value} onChangeText={(t) => onChange(slugify(t))} editable={!readOnly} testID="form-subdomain" />
        {typed && q.data ? <Text variant="caption" tone={q.data.available ? "ok" : "danger"} testID="address-status">{q.data.available ? `${typed} is free.` : q.data.reason ?? `${typed} is taken.`}</Text> : null}
      </View>
    </Field>
  );
}
