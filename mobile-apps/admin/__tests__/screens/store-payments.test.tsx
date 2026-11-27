import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { PaymentsSection } from "@/screens/StorePayments";
import { StoreDetail } from "@/screens/StoreDetail";
import { todayKey } from "@/ui/calendar";
import { fakeServer, SUPPORT, renderApp, type FakeServer } from "../../test/harness";

const pay = (id: string, amount: number, paidOn: string, kind: "new" | "renewal", over: Record<string, unknown> = {}) => ({
  id, storeId: "s1", storeName: "Acme Momos", planId: "pl1", planName: "Pro", amount, months: 1, paidOn, kind, coversFrom: paidOn, coversTo: "2027-01-01", note: "", recordedBy: "Platform Owner", createdAt: `${paidOn}T09:00:00Z`, ...over,
});
const suggest = { planId: "pl1", planName: "Pro", monthly: 2499, yearly: 23990 };
const listing = (payments: ReturnType<typeof pay>[], standing: Record<string, unknown> = { state: "active", paidUntil: "2027-01-01", daysLeft: 30 }) => ({
  storeId: "s1", storeName: "Acme Momos", payments, standing, total: Math.round(payments.reduce((a, p) => a + p.amount, 0) * 100) / 100, suggest,
});
const PLANS = { plans: [
  { id: "pl1", name: "Pro", description: "", custom: false, limits: { maxUsers: 5, maxOutlets: 3, maxTables: 20 }, entitlements: { allFeatures: false, features: [] }, archived: false, storeCount: 2, marketing: { monthly: 2499, yearlyDiscount: 20, price: "₹2,499" } },
  { id: "pl2", name: "Basic", description: "", custom: false, limits: { maxUsers: 3, maxOutlets: 1, maxTables: 5 }, entitlements: { allFeatures: false, features: [] }, archived: false, storeCount: 1, marketing: { monthly: 999, yearlyDiscount: 0, price: "₹999" } },
  { id: "pl3", name: "Old plan", description: "", custom: false, limits: { maxUsers: 3, maxOutlets: 1, maxTables: 5 }, entitlements: { allFeatures: false, features: [] }, archived: true, storeCount: 0, marketing: { monthly: 100, yearlyDiscount: 0, price: "₹100" } },
] };
const TWO = [pay("p2", 2499.5, "2026-11-20", "renewal"), pay("p1", 2499, "2026-10-20", "new", { note: "UPI 4471" })];

function serverWith(payments: ReturnType<typeof pay>[], extra: Record<string, unknown> = {}): FakeServer {
  return fakeServer({ "GET /api/platform/stores/s1/payments": { json: listing(payments) }, "GET /api/platform/plans": { json: PLANS }, ...(extra as object) });
}
const openSheet = async () => { await fireEvent.press(await screen.findByTestId("payment-add")); await screen.findByTestId("payment-amount"); };
const amountBox = () => screen.getByTestId("payment-amount");

describe("a store's subscription payments", () => {
  it("shows where the store stands, what it has paid in all, and each payment as 'New sale' or 'Re-subscribed'", async () => {
    await renderApp(<PaymentsSection id="s1" mayManage />, { server: serverWith(TWO) });
    expect(await screen.findByText(/Paid until 1 Jan 2027 · 30 days left/)).toBeOnTheScreen();
    expect(screen.getByTestId("payments-total")).toHaveTextContent("2 payments · ₹4,998.5 in all");
    expect(screen.getByText("₹2,499.5 · 20 Nov 2026")).toBeOnTheScreen();
    expect(screen.getByText("₹2,499 · 20 Oct 2026")).toBeOnTheScreen();
    expect(screen.getByText("Re-subscribed")).toBeOnTheScreen();
    expect(screen.getByText("New sale")).toBeOnTheScreen();
    expect(screen.getByText(/UPI 4471/)).toBeOnTheScreen();
    expect(screen.getAllByText(/written by Platform Owner/)).toHaveLength(2);
  });

  it("says when a store ran out, and when nothing has been written down yet", async () => {
    await renderApp(<PaymentsSection id="s1" mayManage />, { server: fakeServer({ "GET /api/platform/stores/s1/payments": { json: listing([pay("p1", 2499, "2026-09-01", "new")], { state: "expired", paidUntil: "2026-10-01", daysLeft: -58 }) }, "GET /api/platform/plans": { json: PLANS } }) });
    expect(await screen.findByText(/Ran out on 1 Oct 2026 — not renewed/)).toBeOnTheScreen();
  });
  it("…nothing written down yet", async () => {
    await renderApp(<PaymentsSection id="s1" mayManage />, { server: fakeServer({ "GET /api/platform/stores/s1/payments": { json: listing([], { state: "never", paidUntil: null, daysLeft: null }) }, "GET /api/platform/plans": { json: PLANS } }) });
    expect(await screen.findByText("No payment written down yet")).toBeOnTheScreen();
    expect(screen.getByText("Nothing written down yet")).toBeOnTheScreen();
  });

  it("a role that can only LOOK sees the payments but gets no button to write or delete one, and is told why", async () => {
    await renderApp(<PaymentsSection id="s1" mayManage={false} />, { server: serverWith(TWO), signedInAs: SUPPORT });
    expect(await screen.findByText("₹2,499.5 · 20 Nov 2026")).toBeOnTheScreen();
    expect(screen.queryByTestId("payment-add")).toBeNull();
    expect(screen.queryByTestId("payment-delete-p1")).toBeNull();
    expect(screen.getByTestId("payments-readonly")).toBeOnTheScreen();
  });

  describe("the form", () => {
    it("starts the amount from the plan's price, and follows the months until someone types an amount", async () => {
      await renderApp(<PaymentsSection id="s1" mayManage />, { server: serverWith(TWO) });
      await openSheet();
      expect(amountBox().props.value).toBe("2499");
      await fireEvent.changeText(screen.getByTestId("payment-months"), "12");
      expect(amountBox().props.value).toBe("23990"); // the yearly price with the plan's 20% off
      await fireEvent.changeText(screen.getByTestId("payment-months"), "3");
      expect(amountBox().props.value).toBe("7497");
      await fireEvent.changeText(amountBox(), "7000");
      await fireEvent.changeText(screen.getByTestId("payment-months"), "6");
      expect(amountBox().props.value).toBe("7000"); // a typed amount is never changed under the person
      const use = screen.getByTestId("payment-use-price");
      expect(use).toHaveTextContent("Use the plan's price (₹14,994)");
      await fireEvent.press(use);
      expect(amountBox().props.value).toBe("14994");
      expect(screen.queryByTestId("payment-use-price")).toBeNull();
    });

    it("says what to fix and keeps Save off until the form is good", async () => {
      await renderApp(<PaymentsSection id="s1" mayManage />, { server: serverWith(TWO) });
      await openSheet();
      await fireEvent.changeText(amountBox(), "");
      expect(screen.getByTestId("payment-will-be")).toHaveTextContent("Type the amount that was paid, in rupees.");
      expect(screen.getByTestId("payment-save")).toBeDisabled();
      await fireEvent.changeText(amountBox(), "2499");
      await fireEvent.changeText(screen.getByTestId("payment-months"), "0");
      expect(screen.getByTestId("payment-will-be")).toHaveTextContent("Months must be a whole number from 1 to 60.");
      expect(screen.getByTestId("payment-save")).toBeDisabled();
      await fireEvent.changeText(screen.getByTestId("payment-months"), "61");
      expect(screen.getByTestId("payment-save")).toBeDisabled();
      await fireEvent.changeText(screen.getByTestId("payment-months"), "1");
      expect(screen.getByTestId("payment-will-be")).toHaveTextContent(/RE-SUBSCRIPTION/); // the store has paid before
      expect(screen.getByTestId("payment-save")).not.toBeDisabled();
    });

    it("for a store that has never paid, it says this will be the NEW SALE", async () => {
      await renderApp(<PaymentsSection id="s1" mayManage />, { server: fakeServer({ "GET /api/platform/stores/s1/payments": { json: listing([], { state: "never", paidUntil: null, daysLeft: null }) }, "GET /api/platform/plans": { json: PLANS } }) });
      await openSheet();
      expect(screen.getByTestId("payment-will-be")).toHaveTextContent(/NEW SALE/);
    });

    it("writes the payment down: sends the day, months, amount and note, says it is done, and the list loads again", async () => {
      const s = serverWith(TWO);
      s.set("POST /api/platform/stores/s1/payments", () => {
        const now = [pay("p3", 2499, todayKey(), "renewal", { note: "Bank transfer" }), ...TWO];
        s.set("GET /api/platform/stores/s1/payments", { json: listing(now) });
        return { status: 201, json: { ...listing(now), payment: now[0] } };
      });
      await renderApp(<PaymentsSection id="s1" mayManage />, { server: s });
      await openSheet();
      await fireEvent.changeText(screen.getByTestId("payment-note"), "Bank transfer");
      await act(async () => { await fireEvent.press(screen.getByTestId("payment-save")); });
      await waitFor(() => expect(s.to("POST", "/api/platform/stores/s1/payments")).toHaveLength(1));
      expect(s.to("POST", "/api/platform/stores/s1/payments")[0]!.body).toEqual({ amount: 2499, paidOn: todayKey(), months: 1, note: "Bank transfer" });
      expect(await screen.findByText("Payment written down.")).toBeOnTheScreen();
      expect(await screen.findByTestId("payment-p3")).toBeOnTheScreen();
      expect(screen.getByTestId("payments-total")).toHaveTextContent(/3 payments/);
      await waitFor(() => expect(screen.queryByTestId("payment-amount")).toBeNull()); // the sheet slid away
    });

    it("a payment for another plan sends that plan, and its price starts the amount; an archived plan is not offered", async () => {
      const s = serverWith(TWO);
      s.set("POST /api/platform/stores/s1/payments", { status: 201, json: { ...listing(TWO), payment: TWO[0] } });
      await renderApp(<PaymentsSection id="s1" mayManage />, { server: s });
      await openSheet();
      await fireEvent.press(screen.getByTestId("payment-plan"));
      expect(screen.queryByTestId("payment-plan-option-pl3")).toBeNull();
      await fireEvent.press(await screen.findByTestId("payment-plan-option-pl2"));
      expect(amountBox().props.value).toBe("999");
      await act(async () => { await fireEvent.press(screen.getByTestId("payment-save")); });
      await waitFor(() => expect(s.to("POST", "/api/platform/stores/s1/payments")).toHaveLength(1));
      expect(s.to("POST", "/api/platform/stores/s1/payments")[0]!.body).toMatchObject({ amount: 999, planId: "pl2" });
    });

    it("when the server refuses (the same payment twice), the person is told why and the form stays open", async () => {
      const s = serverWith(TWO);
      s.set("POST /api/platform/stores/s1/payments", { status: 409, json: { error: "This exact payment (same store, day and amount) is already written down." } });
      await renderApp(<PaymentsSection id="s1" mayManage />, { server: s });
      await openSheet();
      await act(async () => { await fireEvent.press(screen.getByTestId("payment-save")); });
      expect(await screen.findByText(/is already written down/)).toBeOnTheScreen();
      expect(screen.getByTestId("payment-amount")).toBeOnTheScreen();
    });

    it("when the server says the role may not, it says so in plain words", async () => {
      const s = serverWith(TWO);
      s.set("POST /api/platform/stores/s1/payments", { status: 403, json: { error: "Your role can't do this." } });
      await renderApp(<PaymentsSection id="s1" mayManage />, { server: s });
      await openSheet();
      await act(async () => { await fireEvent.press(screen.getByTestId("payment-save")); });
      expect(await screen.findByText("Your role can't do this.")).toBeOnTheScreen();
    });
  });

  describe("deleting a wrong payment", () => {
    it("asks first, then takes it off and loads the list again", async () => {
      const s = serverWith(TWO);
      s.set("DELETE /api/platform/stores/s1/payments/:id", () => { s.set("GET /api/platform/stores/s1/payments", { json: listing([TWO[1]!]) }); return { json: listing([TWO[1]!]) }; });
      await renderApp(<PaymentsSection id="s1" mayManage />, { server: s });
      await fireEvent.press(await screen.findByTestId("payment-delete-p2"));
      expect(await screen.findByText(/Delete the payment of ₹2,499.5 made on 20 Nov 2026\? Only do this if it was written down by mistake\./)).toBeOnTheScreen();
      expect(s.to("DELETE", "/api/platform/stores/s1/payments/p2")).toHaveLength(0); // nothing yet
      await act(async () => { await fireEvent.press(screen.getByTestId("confirm-yes")); });
      await waitFor(() => expect(s.to("DELETE", "/api/platform/stores/s1/payments/p2")).toHaveLength(1));
      expect(await screen.findByText("Payment deleted.")).toBeOnTheScreen();
      await waitFor(() => expect(screen.queryByTestId("payment-p2")).toBeNull());
      expect(screen.getByTestId("payment-p1")).toBeOnTheScreen();
    });
    it("Cancel leaves everything as it was", async () => {
      const s = serverWith(TWO);
      await renderApp(<PaymentsSection id="s1" mayManage />, { server: s });
      await fireEvent.press(await screen.findByTestId("payment-delete-p2"));
      await fireEvent.press(await screen.findByText("Cancel"));
      expect(s.to("DELETE", /payments/)).toHaveLength(0);
      expect(screen.getByTestId("payment-p2")).toBeOnTheScreen();
    });
  });

  it("when the list can't be loaded there is a way to try again", async () => {
    const s = fakeServer({ "GET /api/platform/plans": { json: PLANS } });
    await renderApp(<PaymentsSection id="s1" mayManage />, { server: s });
    expect(await screen.findByText("The payments could not be loaded.")).toBeOnTheScreen();
    s.set("GET /api/platform/stores/s1/payments", { json: listing(TWO) });
    await fireEvent.press(screen.getByTestId("payments-retry"));
    expect(await screen.findByTestId("payment-p2")).toBeOnTheScreen();
  });
});

describe("on a store's page", () => {
  const DETAIL = { store: {
    id: "s1", name: "Acme Momos", slug: "acme", ownerEmail: "o@acme.test", createdAt: "2026-01-05T00:00:00Z", plan: { id: "pl1", name: "Pro" }, usage: { users: 2, outlets: 1, tables: 4 }, max: { users: 5, outlets: 3, tables: 20 },
    status: "ok", disabled: null, blocked: { outlets: 0, people: 0 }, outlets: [{ id: "o1", name: "Acme Main", slug: "main", blocked: null }], people: [], domains: { hostnames: ["acme.test"], primary: "acme.test" },
    subdomain: { host: null, label: "" }, limits: { maxUsers: 5, maxOutlets: 3, maxTables: 20 }, entitlements: { features: [] },
  } };
  it("has a 'Subscription payments' section for a role that can see stores, with the form for one that can manage them", async () => {
    const s = serverWith(TWO, { "GET /api/platform/stores/s1": { json: DETAIL } });
    await renderApp(<StoreDetail id="s1" />, { server: s });
    expect(await screen.findByText("Subscription payments")).toBeOnTheScreen();
    expect(await screen.findByTestId("payments-standing")).toBeOnTheScreen();
    expect(screen.getByTestId("payment-add")).toBeOnTheScreen();
  });
  it("…and a role that can only look sees the list without the form", async () => {
    const s = serverWith(TWO, { "GET /api/platform/stores/s1": { json: DETAIL } });
    await renderApp(<StoreDetail id="s1" />, { server: s, signedInAs: SUPPORT });
    expect(await screen.findByTestId("payments-readonly")).toBeOnTheScreen();
    expect(screen.queryByTestId("payment-add")).toBeNull();
  });
});
