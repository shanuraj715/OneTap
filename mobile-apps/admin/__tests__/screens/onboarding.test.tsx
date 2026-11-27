import { fireEvent, screen, waitFor, within } from "@testing-library/react-native";
import { router } from "expo-router";
import { Onboarding } from "@/screens/Onboarding";
import { OnboardingForm } from "@/screens/OnboardingForm";
import { blankForm } from "@/lib/onboarding";
import { fakeServer, renderApp } from "../../test/harness";

const ROW = (o: Record<string, unknown>) => ({ id: "f1", storeName: "Curry House", repName: "Sam", status: "draft", planId: "starter", planName: "Starter", outlets: 2, brandId: null, publishedAt: null, createdAt: "2026-11-20T00:00:00Z", updatedAt: "2026-11-26T10:00:00Z", ...o });
const PLANS = { plans: [
  { id: "starter", name: "Starter", description: "", custom: false, limits: { maxUsers: 3, maxOutlets: 1, maxTables: 5 }, entitlements: { allFeatures: false, features: ["takeaway", "dineInQr"] }, archived: false, storeCount: 0 },
  { id: "pro", name: "Pro", description: "", custom: false, limits: { maxUsers: 10, maxOutlets: 5, maxTables: 50 }, entitlements: { allFeatures: true, features: [] }, archived: false, storeCount: 0 },
] };
const READY = { errors: [], server: [], fit: { issues: [], blocking: false }, ready: true };
const NOT_READY = { errors: [{ path: "business.ownerEmail", message: "Enter the owner's email — it is their sign-in." }], server: [{ path: "address.subdomain", message: "“curry” is already taken." }], fit: { issues: [{ id: "feature:delivery", kind: "feature", forced: false, message: "Delivery isn't in the Starter plan." }], blocking: true }, ready: false };

describe("the onboarding list", () => {
  const open = () => renderApp(<Onboarding />, { server: fakeServer({ "GET /api/platform/onboarding": { json: { forms: [ROW({}), ROW({ id: "f2", storeName: "Beta Bites", status: "published", planName: "Pro", outlets: 1, publishedAt: "2026-11-25T00:00:00Z" })] } } }) });

  it("lists the forms with plan, outlets, who took it, and Draft / Published", async () => {
    await open();
    const f = within(await screen.findByTestId("form-Curry House"));
    expect(f.getByText(/Starter · 2 outlets · by Sam/)).toBeOnTheScreen();
    expect(f.getByText("Draft")).toBeOnTheScreen();
    expect(within(screen.getByTestId("form-Beta Bites")).getByText("Published")).toBeOnTheScreen();
  });
  it("filters by status, opens a form, and starts a new one", async () => {
    await open();
    await screen.findByTestId("form-Curry House");
    await fireEvent.press(screen.getByTestId("onboarding-filter-published"));
    expect(screen.queryByTestId("form-Curry House")).toBeNull();
    await fireEvent.press(screen.getByTestId("onboarding-filter-all"));
    await fireEvent.press(screen.getByTestId("form-Curry House"));
    expect(router.push).toHaveBeenCalledWith("/onboarding/f1");
    await fireEvent.press(screen.getByTestId("new-form"));
    expect(router.push).toHaveBeenCalledWith("/onboarding/new");
  });
});

describe("the requirement form", () => {
  const saved = (data = blankForm(), o: Record<string, unknown> = {}) => ({ form: { ...ROW(o), data } });
  const open = (id: string, extra: Record<string, any> = {}, data = blankForm()) =>
    renderApp(<OnboardingForm id={id} />, { server: fakeServer({
      "GET /api/platform/plans": { json: PLANS },
      "GET /api/platform/onboarding/:id": { json: saved(data, id === "f9" ? { status: "published", brandId: "b1", publishedAt: "2026-11-25T00:00:00Z" } : {}) },
      "GET /api/platform/onboarding/:id/check": { json: READY },
      "GET /api/platform/subdomains/check": { json: { available: true } },
      "POST /api/platform/onboarding": (c) => ({ status: 201, json: saved(c.body.data) }),
      "PUT /api/platform/onboarding/:id": (c) => ({ json: saved(c.body.data) }),
      ...extra,
    }) });

  it("a new form is empty, unsaved, and has no Delete (there is nothing to delete)", async () => {
    await open("new");
    expect(screen.getByText("Not saved yet")).toBeOnTheScreen();
    expect(screen.queryByTestId("form-delete")).toBeNull();
    expect(screen.getByTestId("form-publish")).toBeDisabled();
  });

  it("Save creates the draft with everything typed, then the next Save updates it", async () => {
    const { server } = await open("new");
    await fireEvent.changeText(screen.getByTestId("form-store"), "Curry House");
    await fireEvent.changeText(screen.getByTestId("form-owner"), "Ravi Kumar");
    await fireEvent.changeText(screen.getByTestId("form-email"), "ravi@curry.test");
    await fireEvent.changeText(screen.getByTestId("outlet-name-0"), "Curry House Main");
    await fireEvent.press(screen.getByTestId("form-save"));
    await waitFor(() => expect(server.to("POST", "/api/platform/onboarding")).toHaveLength(1));
    const sent = server.to("POST", "/api/platform/onboarding")[0]!.body.data;
    expect(sent.business).toMatchObject({ storeName: "Curry House", ownerName: "Ravi Kumar", ownerEmail: "ravi@curry.test" });
    expect(sent.outlets[0].name).toBe("Curry House Main");
    await waitFor(() => expect(screen.getByText("Draft, saved")).toBeOnTheScreen());
    await fireEvent.changeText(screen.getByTestId("form-store"), "Curry House 2");
    await fireEvent.press(screen.getByTestId("form-save"));
    await waitFor(() => expect(server.to("PUT", "/api/platform/onboarding/f1")).toHaveLength(1));
    expect(server.to("POST", "/api/platform/onboarding")).toHaveLength(1);
  });

  it("with a plan chosen, a feature it lacks says so and can be allowed anyway; unticking it drops the allowance", async () => {
    const { server } = await open("new");
    await fireEvent.press(screen.getByTestId("form-plan"));
    await fireEvent.press(await screen.findByTestId("form-plan-option-starter"));
    await fireEvent(screen.getByTestId("feature-analytics"), "valueChange", true);
    expect(screen.getByText("Not in the Starter plan")).toBeOnTheScreen();
    await fireEvent(screen.getByTestId("allow-feature:analytics"), "valueChange", true);
    await fireEvent.press(screen.getByTestId("form-save"));
    await waitFor(() => expect(server.to("POST", "/api/platform/onboarding")).toHaveLength(1));
    expect(server.to("POST", "/api/platform/onboarding")[0]!.body.data.forced).toEqual(["feature:analytics"]);
    await fireEvent(screen.getByTestId("feature-analytics"), "valueChange", false);
    expect(screen.queryByTestId("allow-feature:analytics")).toBeNull();
    await fireEvent.press(screen.getByTestId("form-save"));
    await waitFor(() => expect(server.to("PUT", "/api/platform/onboarding/f1")).toHaveLength(1));
    expect(server.to("PUT", "/api/platform/onboarding/f1")[0]!.body.data.forced).toEqual([]);
  });

  it("more outlets than the plan allows shows the reason and an Allow anyway switch", async () => {
    await open("new");
    await fireEvent.press(screen.getByTestId("form-plan"));
    await fireEvent.press(await screen.findByTestId("form-plan-option-starter"));
    expect(screen.queryByTestId("allow-outlets")).toBeNull();
    await fireEvent.press(screen.getByTestId("add-outlet"));
    expect(screen.getByText(/2 outlets \(the plan allows 1\)/)).toBeOnTheScreen();
    expect(screen.getByTestId("allow-outlets")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("remove-outlet-1"));
    expect(screen.queryByTestId("allow-outlets")).toBeNull();
  });

  it("delivery on an outlet shows its distance and fee boxes; a map link gives the point at once", async () => {
    await open("new");
    expect(screen.queryByTestId("delivery-km-0")).toBeNull();
    await fireEvent(screen.getByTestId("mode-delivery-0"), "valueChange", true);
    expect(screen.getByTestId("delivery-km-0")).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByTestId("outlet-map-0"), "https://www.google.com/maps/place/X/@30.901,75.8573,15z");
    expect(screen.getByTestId("outlet-point-0")).toHaveTextContent("30.90100, 75.85730");
  });

  it("a short link is opened by the server and the point it finds is shown", async () => {
    const { server } = await open("new", { "POST /api/platform/onboarding/resolve-map": { json: { point: { lat: 28.61, lng: 77.2 }, from: "redirect" } } });
    await fireEvent.changeText(screen.getByTestId("outlet-map-0"), "https://maps.app.goo.gl/abc");
    await fireEvent.press(await screen.findByTestId("outlet-find-0"));
    await waitFor(() => expect(screen.getByTestId("outlet-point-0")).toHaveTextContent("28.61000, 77.20000"));
    expect(server.to("POST", "/api/platform/onboarding/resolve-map")[0]!.body).toEqual({ link: "https://maps.app.goo.gl/abc" });
  });

  it("an opened draft shows what the server says is missing, in its own words, and Publish stays off", async () => {
    await open("f1", { "GET /api/platform/onboarding/:id/check": { json: NOT_READY } });
    expect(await screen.findByText("Not ready yet")).toBeOnTheScreen();
    expect(screen.getByText("Enter the owner's email — it is their sign-in.")).toBeOnTheScreen();
    expect(screen.getByText("“curry” is already taken.")).toBeOnTheScreen();
    expect(screen.getByText("Delivery isn't in the Starter plan.")).toBeOnTheScreen();
    expect(screen.getByTestId("form-publish")).toBeDisabled();
  });

  it("when it is ready: Publish asks for the owner's password (made for you), sends it, and shows the sign-in once", async () => {
    const { server } = await open("f1", { "POST /api/platform/onboarding/:id/publish": { status: 201, json: { formId: "f1", store: { id: "b1", name: "Curry House", slug: "curry" }, ownerEmail: "ravi@curry.test" } } });
    await waitFor(() => expect(screen.getByTestId("form-publish")).toBeEnabled());
    await fireEvent.press(screen.getByTestId("form-publish"));
    const pw = (await screen.findByTestId("publish-password")).props.value as string;
    expect(pw).toMatch(/^(?=.*[A-Za-z])(?=.*\d).{10,}$/);
    await fireEvent.changeText(screen.getByTestId("publish-password"), "short1");
    expect(screen.getByTestId("publish-yes")).toBeDisabled();
    await fireEvent.changeText(screen.getByTestId("publish-password"), pw);
    await fireEvent.press(screen.getByTestId("publish-yes"));
    await waitFor(() => expect(server.to("POST", "/api/platform/onboarding/f1/publish")).toHaveLength(1));
    expect(server.to("POST", "/api/platform/onboarding/f1/publish")[0]!.body).toEqual({ ownerPassword: pw });
    expect(await screen.findByTestId("published-password")).toHaveTextContent(pw);
  });

  it("a published form is read-only: no Save, no Publish, no Delete", async () => {
    await open("f9");
    expect(await screen.findByTestId("form-published")).toBeOnTheScreen();
    expect(screen.queryByTestId("form-save")).toBeNull();
    expect(screen.queryByTestId("form-publish")).toBeNull();
    expect(screen.queryByTestId("form-delete")).toBeNull();
    expect(screen.getByTestId("form-store").props.editable).toBe(false);
  });

  it("Reset asks first, then empties the form (the saved copy stays until Save); Delete asks first", async () => {
    const full = blankForm(); full.business.storeName = "Curry House";
    const { server } = await open("f1", { "DELETE /api/platform/onboarding/:id": { status: 204 } }, full);
    expect((await screen.findByTestId("form-store")).props.value).toBe("Curry House");
    await fireEvent.press(screen.getByTestId("form-reset"));
    expect(screen.getByTestId("form-store").props.value).toBe("Curry House");
    await fireEvent.press(await screen.findByTestId("confirm-yes"));
    await waitFor(() => expect(screen.getByTestId("form-store").props.value).toBe(""));
    expect(server.to("PUT", "/api/platform/onboarding/f1")).toHaveLength(0);
    await fireEvent.press(screen.getByTestId("form-delete"));
    expect(server.to("DELETE", "/api/platform/onboarding/f1")).toHaveLength(0);
    await fireEvent.press(await screen.findByTestId("confirm-yes"));
    await waitFor(() => expect(server.to("DELETE", "/api/platform/onboarding/f1")).toHaveLength(1));
  });

  it("the address says whether it is free, from the server", async () => {
    await open("new", { "GET /api/platform/subdomains/check": { json: { available: false, reason: "“curry” is already taken." } } });
    await fireEvent.changeText(screen.getByTestId("form-store"), "Curry");
    expect(await screen.findByText("“curry” is already taken.", {}, { timeout: 3000 })).toBeOnTheScreen();
  });
});
