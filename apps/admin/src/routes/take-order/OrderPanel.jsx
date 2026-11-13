import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatINR } from "@onetap/config-schema";
import { ArrowLeft, BadgeCheck, Coins, DoorOpen, Minus, Plus, Send, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import * as api from "../../lib/api";
import { useCloseSession } from "../../lib/useTables";
import { FoodMark } from "./MenuBrowser";
import { disabledLook, ghostBtn, input, label, maskPhone, muted, prettyPhone, primaryBtn } from "./styles";

function useDebounced(value, ms) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Step 3 (and the always-visible right pane on a wide screen): what's in the
 * order, who it's for, coins, and Send. Every total shown comes from the
 * server's own pricing, so what staff read out is what the bill will say.
 */
export function OrderPanel({ outlet, table, session, partyKey, order, wide, onChangeTable, onBack, onSent }) {
  const qc = useQueryClient();
  const { state, set, setQty, setCustomer } = order;
  const freeTable = useCloseSession(outlet);
  // a seated party with nothing left to make or pay for — they've finished
  const partyDone = Boolean(session && session.allPaid && session.openOrders === 0);
  const seated = Boolean(session);
  const typedPhone = state.phone.replace(/\D/g, "").slice(0, 10);
  const phone = seated ? session.customerPhone ?? "" : typedPhone;
  const phoneReady = phone.length === 10;

  const lookup = useQuery({
    queryKey: ["staff-customer", outlet._id, phone],
    queryFn: () => api.staffCustomerLookup(outlet, phone),
    enabled: phoneReady,
    staleTime: 30_000,
  });
  const known = lookup.data?.customer ?? null;

  // A returning customer found by their full number fills in their name and
  // email (only into empty fields, and once per number — staff can still edit).
  const filledFor = useRef(null);
  useEffect(() => {
    if (seated || !known || filledFor.current === phone) return;
    filledFor.current = phone;
    const patch = {};
    if (!state.name.trim() && known.name) patch.name = known.name;
    if (!state.email.trim() && known.email) patch.email = known.email;
    if (Object.keys(patch).length) setCustomer(patch, partyKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [known?.id, phone, seated]);
  const wallet = lookup.data?.wallet;
  const smsCodes = Boolean(lookup.data?.smsCodes);
  const canUseCoins = Boolean(wallet?.enabled && known?.coins > 0);
  const useCoins = canUseCoins && state.useCoins;
  const coinsAsked = useCoins ? Math.min(state.coins || known.coins, known.coins) : 0;
  const approved = Boolean(state.approval && state.approvalPhone === phone);
  const needsApproval = useCoins && smsCodes && !approved;

  const cartLines = useMemo(
    () => state.lines.map((l) => ({ itemId: l.itemId, variantId: l.variantId, modifierOptionIds: l.modifierOptionIds ?? [], quantity: l.quantity, note: l.note })),
    [state.lines],
  );
  const quoteBody = useDebounced(
    JSON.stringify({ tableId: table?.id, phone: phoneReady ? phone : undefined, cart: { lines: cartLines, redeemCoins: coinsAsked || undefined } }),
    250,
  );
  // Decide from the same (debounced) body that gets sent — checking the live
  // cart instead fired one request with the previous, empty cart the moment
  // the first item went in, and the server rightly refused it.
  const quotedLineCount = useMemo(() => JSON.parse(quoteBody).cart.lines.length, [quoteBody]);
  const quote = useQuery({
    queryKey: ["staff-quote", outlet._id, quoteBody],
    queryFn: () => api.staffQuote(outlet, JSON.parse(quoteBody)),
    enabled: quotedLineCount > 0 && Boolean(table),
    placeholderData: (prev) => prev,
    retry: false,
  });
  const totals = cartLines.length ? quote.data?.totals : null;
  const estimate = state.lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);

  const sendCode = useMutation({ mutationFn: () => api.sendStaffCoinsCode(outlet, phone) });
  const [code, setCode] = useState("");
  const verify = useMutation({
    mutationFn: () => api.verifyStaffCoinsCode(outlet, phone, code),
    onSuccess: (r) => {
      set({ approval: r.approval, approvalPhone: phone });
      setCode("");
    },
  });

  const place = useMutation({
    mutationFn: () =>
      api.placeStaffOrder(outlet, {
        tableId: table.id,
        cart: { lines: cartLines, redeemCoins: coinsAsked || undefined },
        phone: seated ? undefined : typedPhone,
        name: seated ? undefined : state.name.trim() || undefined,
        email: seated ? undefined : state.email.trim() || undefined,
        note: state.note.trim() || undefined,
        coinsApproval: approved ? state.approval : undefined,
      }),
    onSuccess: ({ order: placed }) => {
      for (const key of ["orders", "sessions", "tables", "staff-customer"]) qc.invalidateQueries({ queryKey: [key] });
      onSent(placed);
    },
  });

  const emailBad = !seated && state.email.trim() && !EMAIL_RE.test(state.email.trim());
  const blocker = !table
    ? "Pick a table"
    : state.lines.length === 0
      ? "Add something from the menu"
      : !seated && !phoneReady
        ? "Enter the customer's mobile number"
        : emailBad
          ? "Check the email address"
          : needsApproval
            ? "Verify the customer's code to use their coins"
            : null;
  const grand = totals?.grandTotal ?? estimate;

  return (
    <div style={wide ? paneWide : paneNarrow}>
      <div style={scroll}>
        {!wide ? (
          <button type="button" onClick={onBack} style={backLink}>
            <ArrowLeft size={16} /> Add more items
          </button>
        ) : null}

        {/* ---------------------------------------------------------- table */}
        <div style={tableCard}>
          <div>
            <div style={{ ...label, marginBottom: 2 }}>Table</div>
            <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.1 }}>
              {table ? table.number : "—"}
              {table?.zone ? <span style={{ ...muted, fontSize: 13, fontWeight: 600 }}> · {table.zone}</span> : null}
            </div>
          </div>
          <button type="button" onClick={onChangeTable} style={{ ...ghostBtn, minHeight: 40, fontSize: 13.5, padding: "0 14px" }}>
            Change
          </button>
        </div>

        {/* ---------------------------------------------------------- items */}
        <section style={section}>
          <h3 style={sectionHead}>Order · {state.lines.reduce((s, l) => s + l.quantity, 0)} items</h3>
          {state.lines.length === 0 ? (
            <p style={{ ...muted, fontSize: 13.5, margin: 0 }}>Nothing added yet — pick dishes from the menu.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {state.lines.map((l) => (
                <div key={l.key} style={lineRow}>
                  <FoodMark type={l.foodType} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 650, fontSize: 14 }}>{l.name}</div>
                    {[l.variantLabel, ...(l.modifierLabels ?? [])].filter(Boolean).length ? (
                      <div style={{ ...muted, fontSize: 12.5 }}>{[l.variantLabel, ...(l.modifierLabels ?? [])].filter(Boolean).join(" · ")}</div>
                    ) : null}
                    {l.note ? <div style={{ fontSize: 12.5, color: "var(--tone-warning)", fontWeight: 600 }}>“{l.note}”</div> : null}
                    <div style={{ fontSize: 12.5, fontWeight: 700, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>{formatINR(l.unitPrice * l.quantity)}</div>
                  </div>
                  <span style={stepper}>
                    <button type="button" onClick={() => setQty(l.key, l.quantity - 1)} style={stepBtn} aria-label={`One less ${l.name}`}>
                      <Minus size={14} />
                    </button>
                    <span style={{ minWidth: 20, textAlign: "center", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{l.quantity}</span>
                    <button type="button" onClick={() => setQty(l.key, l.quantity + 1)} style={stepBtn} aria-label={`One more ${l.name}`}>
                      <Plus size={14} />
                    </button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ------------------------------------------------------- customer */}
        <section style={section}>
          <h3 style={sectionHead}>Customer</h3>
          {seated ? (
            <>
              <div style={known_}>
                <UserRound size={18} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>Adding to {session.customerName || "this party"}'s bill</div>
                  <div style={{ ...muted, fontSize: 12.5 }}>
                    {session.customerPhone ? `${maskPhone(session.customerPhone)} · ` : ""}
                    {formatINR(session.tab)} so far
                  </div>
                </div>
              </div>
              {/* New guests at a table the last party never left in the system */}
              {partyDone ? (
                <div style={newGuests}>
                  <span style={{ fontSize: 13 }}>
                    New guests at this table? {session.customerName || "The last party"}'s meal is done and paid.
                  </span>
                  <button
                    type="button"
                    onClick={() => freeTable.mutate(session.id)}
                    disabled={freeTable.isPending}
                    style={{ ...ghostBtn, minHeight: 44, fontSize: 14, ...(freeTable.isPending ? disabledLook : {}) }}
                  >
                    <DoorOpen size={16} /> {freeTable.isPending ? "Freeing…" : "Free table for new guests"}
                  </button>
                </div>
              ) : (
                <p style={{ ...muted, fontSize: 12.5, margin: "10px 0 0" }}>
                  New guests here? {session.customerName || "This party"}'s bill
                  {session.unpaidTotal > 0 ? ` still has ${formatINR(session.unpaidTotal)} unpaid` : " still has orders being prepared"} — settle it in Tables, or pick another table.
                </p>
              )}
              {freeTable.error ? <p style={errText}>{freeTable.error.message}</p> : null}
            </>
          ) : (
            <>
              <label style={label} htmlFor="to-phone">
                Mobile number <span style={{ color: "var(--tone-danger)" }}>*</span>
              </label>
              <PhoneSearch
                outlet={outlet}
                digits={typedPhone}
                onType={(d) => {
                  filledFor.current = null;
                  setCustomer({ phone: d }, partyKey);
                }}
                onPick={(c) => {
                  // picked from the list: everything we know about them, at once
                  filledFor.current = c.phone;
                  setCustomer({ phone: c.phone, name: c.name ?? "", email: c.email ?? "" }, partyKey);
                }}
              />
              {phoneReady ? (
                lookup.isLoading ? (
                  <p style={{ ...muted, fontSize: 13, margin: "8px 0 0" }}>Looking up…</p>
                ) : known ? (
                  <div style={{ ...known_, marginTop: 10 }}>
                    <BadgeCheck size={18} color="var(--tone-success)" />
                    <div>
                      <div style={{ fontWeight: 700 }}>Welcome back{known.name ? `, ${known.name}` : ""}</div>
                      <div style={{ ...muted, fontSize: 12.5 }}>
                        {known.visits} visit{known.visits === 1 ? "" : "s"}
                        {wallet?.enabled ? ` · ${known.coins} coins` : ""}
                      </div>
                    </div>
                  </div>
                ) : lookup.data ? (
                  <div style={{ ...known_, marginTop: 10 }}>
                    <Sparkles size={18} color="var(--color-primary)" />
                    <div>
                      <div style={{ fontWeight: 700 }}>New customer</div>
                      <div style={{ ...muted, fontSize: 12.5 }}>{wallet?.enabled ? "They'll start earning coins with this order." : "We'll remember them next time."}</div>
                    </div>
                  </div>
                ) : lookup.error ? (
                  <p style={errText}>{lookup.error.message}</p>
                ) : null
              ) : null}

              <div style={twoCol}>
                <div>
                  <label style={label} htmlFor="to-name">
                    Name <span style={{ fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>· optional</span>
                  </label>
                  <input id="to-name" value={state.name} onChange={(e) => setCustomer({ name: e.target.value.slice(0, 80) }, partyKey)} placeholder="Customer's name" style={input} />
                </div>
                <div>
                  <label style={label} htmlFor="to-email">
                    Email <span style={{ fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>· optional</span>
                  </label>
                  <input
                    id="to-email"
                    type="email"
                    value={state.email}
                    onChange={(e) => setCustomer({ email: e.target.value.slice(0, 120) }, partyKey)}
                    placeholder="name@example.com"
                    style={{ ...input, ...(emailBad ? { borderColor: "var(--tone-danger)" } : {}) }}
                  />
                </div>
              </div>
            </>
          )}
        </section>

        {/* ---------------------------------------------------------- coins */}
        {canUseCoins ? (
          <section style={section}>
            <label style={coinsRow}>
              <Coins size={18} color="var(--tone-warning)" />
              <span style={{ flex: 1 }}>
                <span style={{ fontWeight: 700, display: "block" }}>Use coins</span>
                <span style={{ ...muted, fontSize: 12.5 }}>
                  {known.coins} available · 1 coin = {formatINR(wallet.redeemValuePaise)} · up to {wallet.maxRedeemPercent}% of the bill
                </span>
              </span>
              <input
                type="checkbox"
                checked={state.useCoins}
                onChange={(e) => set({ useCoins: e.target.checked, coins: known.coins })}
                style={{ width: 22, height: 22, accentColor: "var(--color-primary)" }}
              />
            </label>
            {useCoins ? (
              <>
                {totals?.coinsRedeemed ? (
                  <p style={{ margin: "8px 0 0", fontSize: 13, fontWeight: 600, color: "var(--tone-success)" }}>
                    Using {totals.coinsRedeemed} coins · −{formatINR(totals.coinsDiscount)}
                  </p>
                ) : quote.data?.coinsError ? (
                  <p style={errText}>{quote.data.coinsError}</p>
                ) : null}
                {smsCodes ? (
                  approved ? (
                    <p style={{ ...okText, display: "flex", alignItems: "center", gap: 6 }}>
                      <ShieldCheck size={16} /> Customer verified
                    </p>
                  ) : (
                    <div style={codeBox}>
                      <p style={{ margin: 0, fontSize: 13 }}>
                        Coins need the customer's OK — send a code to {maskPhone(phone)} and ask them to read it out.
                      </p>
                      {!sendCode.isSuccess ? (
                        <button type="button" onClick={() => sendCode.mutate()} disabled={sendCode.isPending} style={{ ...ghostBtn, minHeight: 44, ...(sendCode.isPending ? disabledLook : {}) }}>
                          {sendCode.isPending ? "Sending…" : "Send code"}
                        </button>
                      ) : (
                        <div style={{ display: "flex", gap: 8 }}>
                          <input
                            value={code}
                            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            placeholder="6-digit code"
                            aria-label="Code from the customer's phone"
                            style={{ ...input, letterSpacing: "0.3em", fontWeight: 800 }}
                          />
                          <button
                            type="button"
                            onClick={() => verify.mutate()}
                            disabled={code.length !== 6 || verify.isPending}
                            style={{ ...primaryBtn, minHeight: 48, ...(code.length !== 6 || verify.isPending ? disabledLook : {}) }}
                          >
                            Verify
                          </button>
                        </div>
                      )}
                      {sendCode.isSuccess ? (
                        <button type="button" onClick={() => sendCode.mutate()} style={linkBtn}>
                          Send again
                        </button>
                      ) : null}
                      {sendCode.error ? <p style={errText}>{sendCode.error.message}</p> : null}
                      {verify.error ? <p style={errText}>{verify.error.message}</p> : null}
                    </div>
                  )
                ) : null}
              </>
            ) : null}
          </section>
        ) : null}

        {/* ----------------------------------------------------------- note */}
        <section style={section}>
          <label style={label} htmlFor="to-note">
            Note for this order <span style={{ fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>· optional</span>
          </label>
          <textarea
            id="to-note"
            value={state.note}
            onChange={(e) => set({ note: e.target.value.slice(0, 300) })}
            rows={2}
            placeholder="e.g. birthday — bring the cake last"
            style={{ ...input, minHeight: 64, padding: "10px 14px", resize: "vertical" }}
          />
        </section>
      </div>

      {/* ------------------------------------------------------------- send */}
      <footer style={footer}>
        {totals ? (
          <div style={totalsBox}>
            <Row label="Items" value={formatINR(totals.subtotal)} />
            {totals.coinsDiscount ? <Row label="Coins" value={`−${formatINR(totals.coinsDiscount)}`} tone="var(--tone-success)" /> : null}
            {totals.taxAmount ? (
              <Row label={quote.data?.pricesIncludeTax ? "Includes taxes" : "Taxes"} value={formatINR(totals.taxAmount)} />
            ) : null}
            {totals.serviceCharge ? <Row label="Service charge" value={formatINR(totals.serviceCharge)} /> : null}
          </div>
        ) : null}
        {quote.error && cartLines.length > 0 ? <p style={errText}>{quote.error.message}</p> : null}
        {place.error ? <p style={errText} role="alert">{place.error.message}</p> : null}
        <button
          type="button"
          onClick={() => !blocker && place.mutate()}
          disabled={Boolean(blocker) || place.isPending}
          style={{ ...primaryBtn, width: "100%", minHeight: 56, fontSize: 16.5, ...(blocker || place.isPending ? disabledLook : {}) }}
        >
          <Send size={18} />
          {place.isPending ? "Sending…" : `Send to kitchen · ${formatINR(grand)}`}
        </button>
        {blocker && state.lines.length > 0 ? <p style={{ ...muted, fontSize: 12.5, margin: "8px 0 0", textAlign: "center" }}>{blocker}</p> : null}
      </footer>
    </div>
  );
}

/**
 * The mobile field, with the customers whose number starts with what's typed
 * so far listed underneath (from the 3rd digit). Picking one fills in their
 * number, name and email. Arrow keys + Enter work too.
 */
function PhoneSearch({ outlet, digits, onType, onPick }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const q = useDebounced(digits, 180);
  const search = useQuery({
    queryKey: ["staff-customer-search", outlet._id, q],
    queryFn: () => api.searchStaffCustomers(outlet, q),
    enabled: q.length >= 3,
    staleTime: 15_000,
    placeholderData: (prev) => prev,
  });
  const matches = q.length >= 3 ? search.data?.customers ?? [] : [];
  // once the full number is typed and it's the only match, there's nothing left to choose
  const exact = digits.length === 10 && matches.length === 1 && matches[0].phone === digits;
  const showList = open && digits.length >= 3 && matches.length > 0 && !exact;

  useEffect(() => setActive(0), [q]);

  const pick = (c) => {
    onPick(c);
    setOpen(false);
  };

  return (
    <div style={{ position: "relative" }}>
      <span style={prefix}>+91</span>
      <input
        id="to-phone"
        role="combobox"
        aria-expanded={showList}
        aria-controls="to-phone-list"
        aria-autocomplete="list"
        aria-activedescendant={showList ? `to-phone-opt-${active}` : undefined}
        value={prettyPhone(digits)}
        onChange={(e) => {
          onType(e.target.value.replace(/\D/g, "").slice(0, 10));
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (!showList) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(matches.length - 1, i + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(0, i - 1));
          } else if (e.key === "Enter") {
            e.preventDefault();
            pick(matches[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        inputMode="numeric"
        autoComplete="off"
        placeholder="98765 43210"
        style={{ ...input, paddingLeft: 56, fontWeight: 700, letterSpacing: "0.04em", fontVariantNumeric: "tabular-nums" }}
      />
      {showList ? (
        <ul id="to-phone-list" role="listbox" aria-label="Matching customers" style={dropdown} className="ot-anim-drop">
          {matches.map((c, i) => (
            <li
              key={c.id}
              id={`to-phone-opt-${i}`}
              role="option"
              aria-selected={i === active}
              // mousedown, not click: picking must happen before the field's blur closes the list
              onMouseDown={(e) => {
                e.preventDefault();
                pick(c);
              }}
              onMouseEnter={() => setActive(i)}
              style={{ ...option, background: i === active ? "var(--color-surface)" : "transparent" }}
            >
              <span style={avatar}>{(c.name || "?").slice(0, 1).toUpperCase()}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontWeight: 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.name || "No name saved"}
                </span>
                <span style={{ display: "block", fontSize: 12.5, color: "var(--color-text-muted)", fontVariantNumeric: "tabular-nums" }}>
                  <Highlight phone={c.phone} typed={digits} />
                  {c.visits ? ` · ${c.visits} visit${c.visits === 1 ? "" : "s"}` : ""}
                  {c.coins ? ` · ${c.coins} coins` : ""}
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** "98765 43210" with the digits already typed in bold. */
function Highlight({ phone, typed }) {
  const pretty = prettyPhone(phone);
  // count through the pretty string so the space after the 5th digit is skipped
  let seen = 0;
  let cut = 0;
  for (; cut < pretty.length && seen < typed.length; cut++) if (pretty[cut] !== " ") seen++;
  return (
    <>
      <strong style={{ color: "var(--color-text)" }}>{pretty.slice(0, cut)}</strong>
      {pretty.slice(cut)}
    </>
  );
}

function Row({ label: l, value, tone }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, color: tone ?? "var(--color-text-muted)" }}>
      <span>{l}</span>
      <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{value}</span>
    </div>
  );
}

const paneWide = { display: "flex", flexDirection: "column", height: "100%", borderLeft: "1px solid var(--color-border)", background: "var(--color-surface)" };
const paneNarrow = { display: "flex", flexDirection: "column", minHeight: "100%", background: "var(--color-surface)" };
const scroll = { flex: 1, overflowY: "auto", padding: "14px 16px 8px" };
const backLink = { display: "inline-flex", alignItems: "center", gap: 6, minHeight: 40, padding: "0 4px", marginBottom: 6, border: "none", background: "transparent", color: "var(--color-primary)", font: "inherit", fontWeight: 700, cursor: "pointer" };
const tableCard = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 14px", borderRadius: 16, background: "var(--color-bg)", border: "1px solid var(--color-border)" };
const section = { marginTop: 16, padding: 14, borderRadius: 16, background: "var(--color-bg)", border: "1px solid var(--color-border)" };
const sectionHead = { margin: "0 0 10px", fontSize: 13, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--color-text-muted)" };
const lineRow = { display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 0", borderBottom: "1px dashed var(--color-border)" };
const stepper = { display: "inline-flex", alignItems: "center", gap: 2, padding: 2, borderRadius: 12, border: "1px solid var(--color-border)", flexShrink: 0 };
const stepBtn = { width: 34, height: 34, borderRadius: 10, border: "none", background: "transparent", color: "var(--color-text)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" };
const newGuests = { display: "flex", flexDirection: "column", gap: 10, marginTop: 10, padding: 12, borderRadius: 12, background: "var(--tone-success-wash)" };
const dropdown = {
  position: "absolute",
  zIndex: 5,
  top: "calc(100% + 6px)",
  left: 0,
  right: 0,
  margin: 0,
  padding: 6,
  listStyle: "none",
  borderRadius: 14,
  border: "1px solid var(--color-border)",
  background: "var(--color-bg)",
  boxShadow: "0 12px 32px rgba(0,0,0,0.14)",
  maxHeight: 300,
  overflowY: "auto",
};
const option = { display: "flex", alignItems: "center", gap: 10, minHeight: 52, padding: "6px 10px", borderRadius: 10, cursor: "pointer" };
const avatar = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 34,
  height: 34,
  borderRadius: 99,
  background: "color-mix(in srgb, var(--color-primary) 12%, var(--color-bg))",
  color: "var(--color-primary)",
  fontWeight: 800,
  flexShrink: 0,
};
const prefix = { position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontWeight: 700, color: "var(--color-text-muted)", fontSize: 15 };
const known_ = { display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, background: "var(--color-surface)" };
const twoCol = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginTop: 14 };
const coinsRow = { display: "flex", alignItems: "center", gap: 10, cursor: "pointer" };
const codeBox = { display: "flex", flexDirection: "column", gap: 10, marginTop: 12, padding: 12, borderRadius: 12, background: "var(--tone-warning-wash)" };
const linkBtn = { alignSelf: "flex-start", border: "none", background: "transparent", padding: 0, color: "var(--color-primary)", font: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer" };
const footer = { position: "sticky", bottom: 0, padding: "12px 16px calc(14px + env(safe-area-inset-bottom))", borderTop: "1px solid var(--color-border)", background: "var(--color-bg)" };
const totalsBox = { display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 };
const errText = { margin: "8px 0 0", fontSize: 13, color: "var(--tone-danger)", fontWeight: 600 };
const okText = { margin: "10px 0 0", fontSize: 13, color: "var(--tone-success)", fontWeight: 700 };
