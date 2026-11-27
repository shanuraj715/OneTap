import { useState } from "react";
import { Linking, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/runtime";
import type { Lead, LeadStatus } from "@/api/endpoints";
import { useAction } from "@/data/useAction";
import { dateTime } from "@/lib/format";
import { Button, Empty, ErrorState, Glass, Grid, Input, LoadingCards, Pill, Row, Screen, Section, Segmented, Sheet, Text, type Tone } from "@/ui";

export const LEAD_LABELS: Record<LeadStatus, string> = { new: "New", contacted: "Contacted", won: "Won", lost: "Lost" };
const TONES: Record<LeadStatus, Tone> = { new: "warn", contacted: "info", won: "ok", lost: "neutral" };
const STATUSES: LeadStatus[] = ["new", "contacted", "won", "lost"];

/** 10-digit Indian numbers get 91 in front (WhatsApp wants the country code); anything else is used as typed, digits only. */
export const whatsappNumber = (phone: string) => { const d = phone.replace(/\D/g, ""); return d.length === 10 ? `91${d}` : d; };

const ago = (iso: string) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return dateTime(iso);
};

/** Enquiries from the website's contact form: who to call, and where each one stands. */
export function Leads() {
  const api = useApi();
  const [status, setStatus] = useState<"" | LeadStatus>("");
  const q = useQuery({ queryKey: ["leads", status], queryFn: () => api.leads(status || undefined) });
  const [openId, setOpenId] = useState<string | null>(null);
  const counts = q.data?.counts;
  const total = counts ? STATUSES.reduce((n, s) => n + (counts[s] ?? 0), 0) : 0;
  const leads = q.data?.leads ?? [];
  const open = leads.find((l) => l.id === openId) ?? null;

  return (
    <Screen title="Leads" subtitle="Restaurants that asked to talk to you on the website. Every lead is a call to make." onRefresh={() => void q.refetch()} refreshing={q.isFetching && !q.isLoading} testID="screen-leads">
      <Segmented testID="leads-filter" value={status} onChange={setStatus} options={[{ value: "", label: "All", count: total }, ...STATUSES.map((s) => ({ value: s, label: LEAD_LABELS[s], count: counts?.[s] ?? 0 }))]} />
      {q.isLoading ? <LoadingCards n={4} /> : q.isError ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : !leads.length ? (
        <Empty icon="leads" title={status ? `No ${LEAD_LABELS[status].toLowerCase()} leads` : "No enquiries yet"} message={status ? "Try another filter." : "They appear here the moment someone sends the Contact form on the website."} />
      ) : (
        <Grid min={330}>{leads.map((l, i) => (
          <Row key={l.id} index={i} icon="user" title={l.businessName ? `${l.name} · ${l.businessName}` : l.name} testID={`lead-${l.phone}`} onPress={() => setOpenId(l.id)}
            subtitle={[l.city, l.outlets ? `${l.outlets} outlet${l.outlets === "1" ? "" : "s"}` : "", l.plan ? `asked about ${l.plan}` : ""].filter(Boolean).join(" · ") || l.phone}
            right={<View style={{ alignItems: "flex-end", gap: 5 }}><Pill tone={TONES[l.status]}>{LEAD_LABELS[l.status]}</Pill><Text variant="caption" tone="muted">{ago(l.createdAt)}</Text></View>} />
        ))}</Grid>
      )}
      <LeadSheet lead={open} onClose={() => setOpenId(null)} />
    </Screen>
  );
}

function LeadSheet({ lead, onClose }: { lead: Lead | null; onClose: () => void }) {
  const api = useApi();
  const [note, setNote] = useState("");
  const update = useAction((body: { status?: LeadStatus; note?: string }) => api.updateLead(lead!.id, body), {
    done: (b) => (b.status ? `Marked ${LEAD_LABELS[b.status].toLowerCase()}.` : "Note added."), invalidate: [["leads"], ["dashboard"]], onDone: (b) => { if (b.note) setNote(""); },
  });
  const [last, setLast] = useState<Lead | null>(lead);
  if (lead && lead !== last) setLast(lead); // the sheet slides away over a moment after `lead` is cleared: keep drawing the last one meanwhile
  const shown = lead ?? last;
  const wa = shown ? whatsappNumber(shown.phone) : "";
  return (
    <Sheet visible={Boolean(lead)} onClose={onClose} title={shown ? shown.name : "Lead"} testID="lead-sheet">
      {shown ? (
        <View style={{ gap: 16 }}>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            <Button size="sm" icon="phone" title={`Call ${shown.phone}`} onPress={() => void Linking.openURL(`tel:${shown.phone.replace(/\D/g, "")}`)} testID="lead-call" />
            {wa ? <Button size="sm" variant="glass" icon="orders" title="WhatsApp" onPress={() => void Linking.openURL(`https://wa.me/${wa}`)} testID="lead-whatsapp" /> : null}
            {shown.email ? <Button size="sm" variant="glass" icon="mail" title="Email" onPress={() => void Linking.openURL(`mailto:${shown.email}`)} testID="lead-email" /> : null}
          </View>
          {shown.message ? <Glass><Text variant="body" testID="lead-message">{shown.message}</Text></Glass> : null}
          <View style={{ gap: 4 }}>
            <Text variant="caption" tone="muted">Received {dateTime(shown.createdAt)}{shown.sourcePage ? ` · from ${shown.sourcePage}` : ""}</Text>
            {shown.utm?.source || shown.utm?.campaign ? <Text variant="caption" tone="muted">Campaign: {[shown.utm.source, shown.utm.medium, shown.utm.campaign].filter(Boolean).join(" / ")}</Text> : null}
          </View>
          <Section title="Mark as">
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {STATUSES.map((s) => <Button key={s} size="sm" variant={s === shown.status ? "primary" : "glass"} title={LEAD_LABELS[s]} disabled={update.isPending || s === shown.status} onPress={() => update.mutate({ status: s })} testID={`lead-status-${s}`} />)}
            </View>
          </Section>
          <Section title="Notes">
            <View style={{ gap: 10 }}>
              {shown.notes.map((n, i) => <Glass key={i} padding={12}><Text variant="body">{n.text}</Text><Text variant="caption" tone="muted">{n.by ? `${n.by} · ` : ""}{ago(n.at)}</Text></Glass>)}
              <Input value={note} onChangeText={(t) => setNote(t.slice(0, 2000))} placeholder="Add a note, e.g. called, demo on Friday" autoCapitalize="sentences" multiline testID="lead-note" />
              <Button title="Add note" icon="plus" variant="glass" disabled={!note.trim() || update.isPending} onPress={() => update.mutate({ note })} testID="lead-add-note" />
            </View>
          </Section>
        </View>
      ) : null}
    </Sheet>
  );
}
