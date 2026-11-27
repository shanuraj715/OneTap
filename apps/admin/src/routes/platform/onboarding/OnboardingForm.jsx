import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "../../../lib/nav";
import { CUSTOM_PLAN_ID, ORDER_MODES, VIRTUAL_CUSTOM_PLAN, blankOnboarding, planAllowances, planFit, resolvePricing, validateOnboarding } from "@rasoipulse/config-schema";
import { AlertTriangle, ArrowLeft, CheckCircle2, ClipboardList, FileDown, Printer, RotateCcw, Save, Send } from "lucide-react";
import * as api from "../../../lib/api";
import { useOnboardingForm, usePlans, usePlatformMutation, usePlatformSettings, usePricing } from "../../../lib/usePlatform";
import { Button, Card, Modal, PageHeader, Pill, Toast } from "../../../ui";
import { subtle, setIn } from "./parts";
import { EstimateCard } from "./EstimateCard";
import { PublishDialog } from "./PublishDialog";
import { AddressSection, BusinessSection, CommonSection, FeaturesSection, LookSection, MeetingSection, OutletsSection, PlanSection, SetupSection } from "./sections";

/**
 * Print a PDF: load it into a hidden frame and open the browser's print dialog for it. If the browser won't show a PDF in a
 * frame (some can't), the PDF opens in a tab instead — print it from there.
 */
function printBlob(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
    let done = false;
    const finish = (fn) => {
      if (done) return;
      done = true;
      fn();
    };
    frame.onload = () => {
      finish(() => {
        try {
          frame.contentWindow.focus();
          frame.contentWindow.print();
          resolve("dialog");
        } catch (e) {
          reject(e);
        }
      });
      setTimeout(() => {
        frame.remove();
        URL.revokeObjectURL(url);
      }, 60_000);
    };
    setTimeout(() => finish(() => {
      frame.remove();
      window.open(url, "_blank");
      resolve("tab");
    }), 6000);
    frame.src = url;
    document.body.appendChild(frame);
  });
}

function saveBlob({ blob, filename }) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** The requirement form for one client: fill it in, save it, print or export it, and publish it as their store. */
export function OnboardingForm() {
  const { id: routeId } = useParams();
  const navigate = useNavigate();
  const isNew = !routeId || routeId === "new";
  const plansQ = usePlans();
  const base = usePlatformSettings().data?.settings.subdomainBase ?? "";
  const realPlans = useMemo(() => (plansQ.data?.plans ?? []).filter((p) => !p.archived), [plansQ.data]);
  // the Custom plan is always on offer: when nobody has created it yet a stand-in is listed, and publishing creates the real one
  const plans = useMemo(() => (realPlans.some((p) => p.custom) ? realPlans : [...realPlans, VIRTUAL_CUSTOM_PLAN]), [realPlans]);
  const pricing = usePricing().data?.pricing;

  const first = useRef(null);
  if (!first.current) first.current = blankOnboarding();
  const [data, setData] = useState(first.current);
  const [snapshot, setSnapshot] = useState(() => JSON.stringify(first.current));
  const [formId, setFormId] = useState(isNew ? null : routeId);
  const formQ = useOnboardingForm(isNew ? null : routeId);
  const form = formQ.data?.form;
  const loaded = useRef(null);
  useEffect(() => {
    if (form && loaded.current !== form.id) {
      loaded.current = form.id;
      setData(form.data);
      setSnapshot(JSON.stringify(form.data));
      setFormId(form.id);
    }
  }, [form]);
  // moving between /new and a saved form (or between two forms) starts clean
  useEffect(() => {
    if (isNew && loaded.current) {
      loaded.current = null;
      const blank = blankOnboarding();
      setData(blank);
      setSnapshot(JSON.stringify(blank));
      setFormId(null);
    }
  }, [isNew]);

  const readOnly = form?.status === "published";
  const dirty = JSON.stringify(data) !== snapshot;
  const plan = plans.find((p) => p.id === data.planId) ?? (data.planId === CUSTOM_PLAN_ID ? plans.find((p) => p.custom) ?? null : null);
  const allow = useMemo(() => planAllowances(plan, data), [plan, data]);
  const fit = useMemo(() => planFit(data, allow), [data, allow]);
  const problems = useMemo(() => validateOnboarding(data), [data]);

  // a draft that chose "Custom" before the real Custom plan existed now points at the real one
  useEffect(() => {
    const real = realPlans.find((p) => p.custom);
    if (real && data.planId === CUSTOM_PLAN_ID) setData((d) => ({ ...d, planId: real.id }));
  }, [realPlans, data.planId]);

  const P = (path, value) => setData((d) => setIn(d, path, value));
  // "Add for this client" / "Take away": taking an extra away also takes it back out of the form, so nothing stays ticked that the plan lacks
  const forceFlag = (id, on) =>
    setData((d) => {
      const next = { ...d, forced: on ? [...new Set([...d.forced, id])] : d.forced.filter((x) => x !== id) };
      if (on) return next;
      if (id.startsWith("feature:")) {
        const key = id.slice("feature:".length);
        next.features = next.features.filter((k) => k !== key);
        next.outlets = next.outlets.map((o) => ({ ...o, modes: { ...o.modes, ...Object.fromEntries(ORDER_MODES.filter((m) => m.feature === key).map((m) => [m.key, false])) } }));
        if (key === "customDomain") next.address = { ...next.address, ownDomain: "" };
        if (key === "onlinePayments") next.common = { ...next.common, payments: { ...next.common.payments, online: false } };
      } else if (id.startsWith("effect:")) {
        next.look = { ...next.look, effect: "none" };
      }
      return next;
    });
  const ctx = { allow, plans, base, forceFlag, pricing: resolvePricing(pricing) };

  // names, addresses and the owner's email that are already taken — only the server knows, and only for a saved form
  const [serverIssues, setServerIssues] = useState([]);
  useEffect(() => {
    if (!formId || dirty || readOnly) {
      setServerIssues([]);
      return undefined;
    }
    let live = true;
    api.checkOnboarding(formId).then((r) => live && setServerIssues(r.server)).catch(() => live && setServerIssues([]));
    return () => {
      live = false;
    };
  }, [formId, dirty, readOnly, snapshot]);

  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState("");
  const [confirm, setConfirm] = useState(null);
  const [publishing, setPublishing] = useState(false);
  const save = usePlatformMutation(() => (formId ? api.saveOnboarding(formId, data) : api.createOnboarding(data)));

  /** Save what is on screen (creating the form the first time). Returns the form's id. */
  const ensureSaved = async () => {
    if (formId && !dirty) return formId;
    const r = await save.mutateAsync();
    const f = r.form;
    loaded.current = f.id;
    setFormId(f.id);
    setData(f.data);
    setSnapshot(JSON.stringify(f.data));
    if (isNew) navigate(`/platform/onboarding/${f.id}`, { replace: true });
    return f.id;
  };
  const guard = (name, fn) => async () => {
    setBusy(name);
    setNotice(null);
    try {
      await fn();
    } catch (e) {
      setNotice({ kind: "error", text: e.message });
    } finally {
      setBusy("");
    }
  };

  const onSave = guard("save", async () => {
    await ensureSaved();
    setNotice({ kind: "ok", text: "Saved." });
  });
  const onPdf = guard("pdf", async () => {
    const id = await ensureSaved();
    saveBlob(await api.onboardingPdf(id));
    setNotice({ kind: "ok", text: "The PDF was downloaded." });
  });
  const onPrint = guard("print", async () => {
    const id = await ensureSaved();
    const { blob } = await api.onboardingPdf(id);
    const how = await printBlob(blob);
    setNotice({ kind: "ok", text: how === "dialog" ? "The print dialog was opened." : "This browser can't print from here, so the PDF was opened in a new tab — print it from there." });
  });
  const onPublish = guard("publish", async () => {
    await ensureSaved();
    setPublishing(true);
  });
  const leave = () => navigate("/platform/onboarding");
  const onCancel = () => (dirty ? setConfirm("discard") : leave());

  const blockers = [...problems.map((p) => p.message), ...fit.issues.filter((i) => !i.forced).map((i) => i.message), ...serverIssues.map((i) => i.message)];

  if (!isNew && formQ.isLoading) return <p style={subtle}>Loading the form…</p>;
  if (!isNew && formQ.isError) {
    return (
      <>
        <PageHeader title="Onboarding" icon={<ClipboardList size={23} />} />
        <Card><p style={subtle}>{formQ.error.message}</p><Link to="/platform/onboarding">Back to the list</Link></Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={data.business.storeName || "New client"}
        icon={<ClipboardList size={23} />}
        subtitle="Client onboarding form"
        action={readOnly ? <Pill tone="ok">Published</Pill> : <Pill tone="neutral">{formId ? (dirty ? "Unsaved changes" : "Saved draft") : "Not saved yet"}</Pill>}
      />

      {readOnly ? (
        <Card>
          <div data-published-banner style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <CheckCircle2 size={18} color="var(--tone-success)" />
            <span>This form was published as a store on {new Date(form.publishedAt).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })}. It can't be changed, but you can still export or print it.</span>
            {form.brandId ? <Link to={`/platform/stores/${form.brandId}`} style={{ marginLeft: "auto" }}>Open the store</Link> : null}
          </div>
        </Card>
      ) : null}

      <div data-action-bar style={{ position: "sticky", top: 0, zIndex: 5, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", padding: "10px 0", margin: "0 0 12px", background: "var(--color-surface, var(--color-bg))" }}>
        <Button type="button" variant="outline" onClick={onCancel} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><ArrowLeft size={14} /> Cancel</Button>
        {!readOnly ? <Button type="button" variant="outline" onClick={() => setConfirm("reset")} disabled={busy !== ""} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><RotateCcw size={14} /> Reset</Button> : null}
        <span style={{ flex: 1 }} />
        {!readOnly && blockers.length ? <span data-blocked-hint style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>{new Set(blockers).size} thing{new Set(blockers).size === 1 ? "" : "s"} to finish before it can be published</span> : null}
        <Button type="button" variant="outline" onClick={() => void onPdf()} disabled={busy !== ""} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><FileDown size={14} /> {busy === "pdf" ? "Preparing…" : "Export PDF"}</Button>
        <Button type="button" variant="outline" onClick={() => void onPrint()} disabled={busy !== ""} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><Printer size={14} /> {busy === "print" ? "Preparing…" : "Print"}</Button>
        {!readOnly ? (
          <>
            <Button type="button" onClick={() => void onSave()} disabled={busy !== "" || (!dirty && Boolean(formId))} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><Save size={14} /> {busy === "save" ? "Saving…" : "Save"}</Button>
            <Button type="button" onClick={() => void onPublish()} disabled={busy !== "" || blockers.length > 0} title={blockers.length ? "Finish the items listed under “Before it can be published” first" : undefined} aria-disabled={blockers.length > 0} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><Send size={14} /> Publish as store</Button>
          </>
        ) : null}
      </div>
      {notice ? <div data-notice={notice.kind}><Toast kind={notice.kind}>{notice.text}</Toast></div> : null}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "flex-start", marginTop: 8 }}>
        <fieldset disabled={readOnly} style={{ flex: "1 1 600px", minWidth: 0, border: 0, margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 16 }}>
          <PlanSection data={data} P={P} ctx={ctx} />
          <MeetingSection data={data} P={P} />
          <BusinessSection data={data} P={P} />
          <FeaturesSection data={data} P={P} ctx={ctx} />
          <OutletsSection data={data} P={P} ctx={ctx} disabled={readOnly} />
          <CommonSection data={data} P={P} ctx={ctx} />
          <LookSection data={data} P={P} ctx={ctx} />
          <AddressSection data={data} P={P} ctx={ctx} />
          <SetupSection data={data} P={P} ctx={ctx} disabled={readOnly} />
        </fieldset>

        <aside style={{ flex: "0 0 310px", position: "sticky", top: 64, display: "flex", flexDirection: "column", gap: 14 }}>
          <Card title="Plan fit" icon={<AlertTriangle size={15} />}>
            <div data-plan-fit>
              {fit.issues.length === 0 ? (
                <p style={{ ...subtle, color: "var(--tone-success)" }} data-fit-ok>Everything in the form fits the {plan?.name} plan.</p>
              ) : (
                fit.issues.map((i) => (
                  <div key={i.id} data-fit-issue={i.id} data-forced={i.forced ? "yes" : "no"} style={{ marginBottom: 8, padding: "7px 10px", borderRadius: 8, fontSize: 12.5, background: i.forced ? "var(--tone-warning-wash)" : "var(--tone-danger-wash)", color: i.forced ? "var(--tone-warning)" : "var(--tone-danger)" }}>
                    {i.forced ? "Added for this client: " : ""}{i.message}
                  </div>
                ))
              )}
            </div>
          </Card>
          <EstimateCard data={data} plan={plan} plans={realPlans} pricing={pricing} onDiscount={(v) => P("quote.discountPct", v)} disabled={readOnly} />
          {!readOnly ? (
            <Card title="Before it can be published">
              <div data-publish-blockers={blockers.length}>
                {blockers.length === 0 ? (
                  <p style={{ ...subtle, color: "var(--tone-success)" }}>Nothing missing. You can save, then publish.</p>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, display: "flex", flexDirection: "column", gap: 4 }}>
                    {[...new Set(blockers)].slice(0, 12).map((b) => <li key={b}>{b}</li>)}
                  </ul>
                )}
              </div>
            </Card>
          ) : null}
        </aside>
      </div>

      {confirm === "reset" ? (
        <Modal onClose={() => setConfirm(null)} width={440} ariaLabel="Reset the form">
          <div style={{ padding: 22 }}>
            <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>Clear the whole form?</h2>
            <p style={{ margin: "0 0 16px", fontSize: 13.5, color: "var(--color-text-muted)" }}>Every answer on this form will be emptied. {formId ? "The copy you saved earlier stays as it is until you press Save." : "Nothing has been saved yet, so it can't be brought back."}</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Button type="button" variant="outline" onClick={() => setConfirm(null)}>Keep my answers</Button>
              <Button type="button" onClick={() => { setData(blankOnboarding()); setConfirm(null); setNotice(null); }}>Yes, clear everything</Button>
            </div>
          </div>
        </Modal>
      ) : null}
      {confirm === "discard" ? (
        <Modal onClose={() => setConfirm(null)} width={440} ariaLabel="Discard changes">
          <div style={{ padding: 22 }}>
            <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>Leave without saving?</h2>
            <p style={{ margin: "0 0 16px", fontSize: 13.5, color: "var(--color-text-muted)" }}>You have changes that haven't been saved. If you leave now they are lost.</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Button type="button" variant="outline" onClick={() => setConfirm(null)}>Keep editing</Button>
              <Button type="button" onClick={leave}>Discard and leave</Button>
            </div>
          </div>
        </Modal>
      ) : null}
      {publishing && formId ? <PublishDialog formId={formId} data={data} plan={plan} allow={allow} base={base} onClose={() => setPublishing(false)} /> : null}
    </>
  );
}
