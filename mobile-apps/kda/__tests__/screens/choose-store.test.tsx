import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { AccountScreen } from "@/screens/AccountScreen";
import { ChooseStoreScreen } from "@/screens/ChooseStoreScreen";
import { toasts } from "@/ui";
import { fakeServer, fx, renderApp } from "../../test/harness";

const adminRoutes = (outlets = fx("outlets-super")) => ({ "POST /api/auth/app-login": { json: fx("auth-app-login-super") }, "GET /api/auth/me": { json: { user: fx("auth-app-login-super").user } }, "GET /api/outlets": { json: outlets } });
const ids = () => Object.fromEntries((fx("outlets-super").outlets as { _id: string; name: string }[]).map((o) => [o.name, o._id]));
// (the harness signs in as the cook; for these tests the platform admin signs in instead, through the very same sign-in)
async function asAdmin(ui: React.ReactElement, outlets?: unknown) {
  const server = fakeServer(adminRoutes(outlets as never));
  const r = await renderApp(ui, { server, signedIn: false });
  await act(async () => { await r.runtime.session.getState().signIn("super@sandbox.test", "Super123!", false); });
  return r;
}
beforeEach(() => toasts.clear());

describe("the platform admin is asked which store first", () => {
  it("lists the stores — not the outlets — with how many outlets each has, and picks nothing for them", async () => {
    const r = await asAdmin(<ChooseStoreScreen />);
    expect(await screen.findByText("Choose a store")).toBeOnTheScreen();
    expect(screen.getByText(/signed in as Platform Admin/)).toBeOnTheScreen();
    expect(screen.getByText("Gazab Momos")).toBeOnTheScreen();
    expect(screen.getByText("2 outlets")).toBeOnTheScreen();
    expect(screen.getByText("Spice Route")).toBeOnTheScreen();
    expect(screen.getByText("1 outlet")).toBeOnTheScreen();
    expect(screen.queryByText("Noida")).toBeNull(); // outlets only appear after a store is chosen
    expect(r.runtime.session.getState().outletId).toBeNull();
  });

  it("then which outlet of that store, with its address name to tell same-named outlets apart", async () => {
    await asAdmin(<ChooseStoreScreen />);
    await fireEvent.press(await screen.findByRole("button", { name: "Gazab Momos, 2 outlets" }));
    expect(screen.getByText("Which outlet of Gazab Momos do you want to work in?")).toBeOnTheScreen();
    expect(screen.getByText("Ludhiana")).toBeOnTheScreen();
    expect(screen.getByText("/ludhiana")).toBeOnTheScreen();
    expect(screen.getByText("Noida")).toBeOnTheScreen();
    expect(screen.queryByText("Delhi")).toBeNull(); // another store's outlet
  });

  it("'All stores' goes back to the stores", async () => {
    await asAdmin(<ChooseStoreScreen />);
    await fireEvent.press(await screen.findByRole("button", { name: "Gazab Momos, 2 outlets" }));
    await fireEvent.press(screen.getByTestId("back-to-stores"));
    expect(screen.getByText("Choose a store")).toBeOnTheScreen();
    expect(screen.getByText("Spice Route")).toBeOnTheScreen();
  });

  it("choosing an outlet starts the work there", async () => {
    const r = await asAdmin(<ChooseStoreScreen />);
    await fireEvent.press(await screen.findByRole("button", { name: "Gazab Momos, 2 outlets" }));
    await fireEvent.press(screen.getByTestId(`outlet-${ids().Ludhiana}`));
    expect(r.runtime.session.getState().outletId).toBe(ids().Ludhiana);
  });

  it("asks even with ONE store that has ONE outlet: the store, then the outlet, nothing skipped", async () => {
    const one = { outlets: [fx("outlets-super").outlets[2]] };
    const r = await asAdmin(<ChooseStoreScreen />, one);
    await fireEvent.press(await screen.findByRole("button", { name: "Spice Route, 1 outlet" }));
    expect(screen.getByText("Which outlet of Spice Route do you want to work in?")).toBeOnTheScreen();
    expect(r.runtime.session.getState().outletId).toBeNull();
    await fireEvent.press(screen.getByTestId(`outlet-${ids().Delhi}`));
    expect(r.runtime.session.getState().outletId).toBe(ids().Delhi);
  });

  it("has a way out: Sign out", async () => {
    const r = await asAdmin(<ChooseStoreScreen />);
    await fireEvent.press(await screen.findByTestId("choose-sign-out"));
    await waitFor(() => expect(r.runtime.session.getState().status).toBe("signed-out"));
  });

  it("a short list has no search box", async () => {
    await asAdmin(<ChooseStoreScreen />);
    await screen.findByText("Choose a store");
    expect(screen.queryByLabelText("Find a store")).toBeNull();
  });
});

describe("a long list of stores", () => {
  const many = (n: number) => Array.from({ length: n }, (_, i) => ({ ...fx("outlets-super").outlets[2], _id: `aaaaaaaaaaaaaaaaaaaaaaa${i}`, name: `Branch ${i}`, slug: `branch-${i}`, brandId: `brand-${i}`, brandName: `Store ${String.fromCharCode(65 + i)}` }));
  it("gets a search box that narrows it down, and says when nothing matches", async () => {
    await asAdmin(<ChooseStoreScreen />, { outlets: many(9) });
    const box = await screen.findByLabelText("Find a store");
    await fireEvent.changeText(box, "store c");
    expect(screen.getByText("Store C")).toBeOnTheScreen();
    expect(screen.queryByText("Store D")).toBeNull();
    await fireEvent.changeText(box, "zzz");
    expect(screen.getByText("Nothing matches")).toBeOnTheScreen();
  });
});

describe("Account → Change store or outlet (platform admin only)", () => {
  it("shows where the admin is working and a button that goes back to the question", async () => {
    const r = await asAdmin(<AccountScreen />);
    await act(async () => { await r.runtime.session.getState().selectOutlet(ids().Noida!); });
    expect(await screen.findByText("Noida · Gazab Momos")).toBeOnTheScreen();
    expect(screen.queryByTestId("outlet-dropdown")).toBeNull();
    await fireEvent.press(screen.getByTestId("change-outlet"));
    expect(r.runtime.session.getState().outletId).toBeNull();
  });

  it("a cook has no such button (their outlet is fixed by their account)", async () => {
    await renderApp(<AccountScreen />);
    await screen.findByTestId("account-name");
    expect(screen.queryByTestId("change-outlet")).toBeNull();
  });
});

describe("Account → Check for updates", () => {
  it("says the app is up to date", async () => {
    await renderApp(<AccountScreen />);
    await fireEvent.press(await screen.findByTestId("check-updates"));
    await waitFor(() => expect(toasts.store.getState().toasts.map((t) => t.message)).toContain("You have the latest version."));
    expect(screen.getByText("Up to date")).toBeOnTheScreen();
  });

  it("names a newer version, and the pop-up is left to the update gate", async () => {
    const server = fakeServer({ "GET /api/app-updates/check": { json: fx("update-check-optional") } });
    await renderApp(<AccountScreen />, { server, build: 1 });
    await fireEvent.press(await screen.findByTestId("check-updates"));
    expect(await screen.findByText("v-26.11.27-002 is out")).toBeOnTheScreen();
  });

  it("says when it can't check", async () => {
    const server = fakeServer({ "GET /api/app-updates/check": { throws: new TypeError("Network request failed") } });
    await renderApp(<AccountScreen />, { server });
    await fireEvent.press(await screen.findByTestId("check-updates"));
    await waitFor(() => expect(toasts.store.getState().toasts.map((t) => t.message).join(" ")).toMatch(/Couldn't check for updates: Can't reach the server/));
    expect(screen.getByText("Not checked yet")).toBeOnTheScreen();
  });
});
