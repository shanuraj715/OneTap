import { AppState, BackHandler, Linking } from "react-native";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react-native";
import { ApiError } from "@/api/client";
import { SignInScreen } from "@/screens/SignInScreen";
import { toasts } from "@/ui";
import { UpdateGate } from "@/updates/UpdateGate";
import { fakeServer, fx, renderApp } from "../../test/harness";

const checkRoute = (name: string) => ({ "GET /api/app-updates/check": { json: fx(name) } });
const messages = () => toasts.store.getState().toasts.map((t) => t.message);
let openURL: jest.SpyInstance;
/** Listens for who asks to hear the phone's Back button (replaced and put back by assignment: the setup's own BackHandler is already a mock). */
function holdBackPresses() {
  const handlers: (() => boolean)[] = [];
  const original = BackHandler.addEventListener;
  BackHandler.addEventListener = ((_event: string, fn: () => boolean) => {
    handlers.push(fn);
    return { remove: () => { const at = handlers.indexOf(fn); if (at >= 0) handlers.splice(at, 1); } };
  }) as never;
  return { handlers, restore: () => { BackHandler.addEventListener = original; } };
}
beforeEach(() => { toasts.clear(); openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined); });
afterEach(() => openURL.mockRestore());

describe("an optional update (a pop-up when the app opens)", () => {
  it("names the new version, its size and what changed, next to the version the phone has", async () => {
    await renderApp(<UpdateGate />, { signedIn: false, build: 1, server: fakeServer(checkRoute("update-check-optional")) });
    const box = within(await screen.findByTestId("update-optional"));
    expect(box.getByText("New version available")).toBeOnTheScreen();
    expect(box.getByText(/v-26.11.27-002 · 3\.2 MB is ready\. You have v-26.11.26-001\./)).toBeOnTheScreen();
    expect(box.getByText("• Order alerts are louder")).toBeOnTheScreen();
    expect(box.getByText("• The prep list groups the same dish")).toBeOnTheScreen();
    expect(box.getByRole("button", { name: "Later" })).toBeOnTheScreen();
    expect(box.getByRole("button", { name: "Update" })).toBeOnTheScreen();
  });

  it("asks the server with this phone's build number, with no sign-in", async () => {
    const { server } = await renderApp(<UpdateGate />, { signedIn: false, build: 1, server: fakeServer(checkRoute("update-check-optional")) });
    await screen.findByTestId("update-optional");
    const calls = server.to("GET", "/api/app-updates/check");
    expect(calls).toHaveLength(1);
    expect(calls[0]!.query).toContain("versionCode=1");
    expect(calls[0]!.headers.authorization).toBeUndefined();
  });

  it("'Later' puts it away, and it doesn't come back while the app is open", async () => {
    await renderApp(<UpdateGate />, { signedIn: false, build: 1, server: fakeServer(checkRoute("update-check-optional")) });
    await fireEvent.press(within(await screen.findByTestId("update-optional")).getByRole("button", { name: "Later" }));
    expect(screen.queryByTestId("update-optional")).toBeNull();
    expect(openURL).not.toHaveBeenCalled();
  });

  it("'Update' opens the download page in the phone's browser, then closes the pop-up", async () => {
    await renderApp(<UpdateGate />, { signedIn: false, build: 1, server: fakeServer(checkRoute("update-check-optional")) });
    await fireEvent.press(within(await screen.findByTestId("update-optional")).getByRole("button", { name: "Update" }));
    await waitFor(() => expect(openURL).toHaveBeenCalledWith("https://rasoipulse.in/apps/kda"));
    await waitFor(() => expect(screen.queryByTestId("update-optional")).toBeNull());
  });

  it("if the browser can't be opened it says so, with the address to type, and stays open", async () => {
    openURL.mockRejectedValue(new Error("no browser"));
    await renderApp(<UpdateGate />, { signedIn: false, build: 1, server: fakeServer(checkRoute("update-check-optional")) });
    await fireEvent.press(within(await screen.findByTestId("update-optional")).getByRole("button", { name: "Update" }));
    await waitFor(() => expect(messages().join(" ")).toMatch(/Couldn't open the browser\. Open https:\/\/rasoipulse\.in\/apps\/kda yourself/));
    expect(screen.getByTestId("update-optional")).toBeOnTheScreen();
  });

  it("only opens web addresses: a made-up page address from the server is refused", async () => {
    const odd = { ...fx("update-check-optional"), pageUrl: "tel:100" };
    await renderApp(<UpdateGate />, { signedIn: false, build: 1, server: fakeServer({ "GET /api/app-updates/check": { json: odd } }) });
    await fireEvent.press(within(await screen.findByTestId("update-optional")).getByRole("button", { name: "Update" }));
    await waitFor(() => expect(messages().join(" ")).toMatch(/Couldn't open/));
    expect(openURL).not.toHaveBeenCalled();
  });
});

describe("a required update (a screen nobody gets past)", () => {
  it("fills the screen: what to install, what changed in every newer version, and how", async () => {
    await renderApp(<UpdateGate />, { signedIn: false, build: 1, server: fakeServer(checkRoute("update-check-required")) });
    const page = within(await screen.findByTestId("update-required"));
    expect(page.getByText("Update needed")).toBeOnTheScreen();
    expect(page.getByText(/This version of the app \(v-26.11.26-001\) can't be used any more\. Install v-26.11.28-003 \(3\.2 MB\) to carry on\./)).toBeOnTheScreen();
    expect(page.getByText("v-26.11.28-003")).toBeOnTheScreen();
    expect(page.getByText("v-26.11.27-002")).toBeOnTheScreen();
    expect(page.getByText("• Security fix: please update")).toBeOnTheScreen();
    expect(page.getByText(/Download the file, open it and tap Install/)).toBeOnTheScreen();
    expect(page.queryByRole("button", { name: "Later" })).toBeNull(); // no way to put it off
    expect(screen.queryByTestId("update-optional")).toBeNull();
  });

  it("the Back button does nothing: the update screen holds the press, so the app isn't closed and the screen stays", async () => {
    const back = holdBackPresses();
    try {
      await renderApp(<UpdateGate />, { signedIn: false, build: 1, server: fakeServer(checkRoute("update-check-required")) });
      await screen.findByTestId("update-required");
      expect(back.handlers).toHaveLength(1);
      expect(back.handlers[0]!()).toBe(true); // "handled": the phone does not go back or close the app
      expect(screen.getByTestId("update-required")).toBeOnTheScreen();
    } finally { back.restore(); }
  });

  it("with no update to install nothing holds the Back button", async () => {
    const back = holdBackPresses();
    try {
      const r = await renderApp(<UpdateGate />, { signedIn: false, build: 2, server: fakeServer(checkRoute("update-check-current")) });
      await waitFor(() => expect(r.runtime.updates.getState().status).toBe("current"));
      expect(back.handlers).toHaveLength(0);
    } finally { back.restore(); }
  });

  it("'Download update' opens the download page in the browser", async () => {
    await renderApp(<UpdateGate />, { signedIn: false, build: 1, server: fakeServer(checkRoute("update-check-required")) });
    await fireEvent.press(await screen.findByTestId("update-download"));
    await waitFor(() => expect(openURL).toHaveBeenCalledWith("https://rasoipulse.in/apps/kda"));
    expect(screen.getByTestId("update-required")).toBeOnTheScreen(); // still there: only installing gets past it
  });

  it("'Check again' while still on the old version says so", async () => {
    const { server } = await renderApp(<UpdateGate />, { signedIn: false, build: 1, server: fakeServer(checkRoute("update-check-required")) });
    await fireEvent.press(await screen.findByTestId("update-check-again"));
    await waitFor(() => expect(server.to("GET", "/api/app-updates/check")).toHaveLength(2));
    await waitFor(() => expect(messages().join(" ")).toMatch(/still has the old version/));
    expect(screen.getByTestId("update-required")).toBeOnTheScreen();
  });

  it("'Check again' once the admin has switched 'Required' off lets the person in", async () => {
    const server = fakeServer(checkRoute("update-check-required"));
    await renderApp(<UpdateGate />, { signedIn: false, build: 1, server });
    await screen.findByTestId("update-required");
    server.set("GET /api/app-updates/check", { json: fx("update-check-current") });
    await fireEvent.press(screen.getByTestId("update-check-again"));
    await waitFor(() => expect(screen.queryByTestId("update-required")).toBeNull());
  });

  it("'Check again' with no connection says so and keeps the screen", async () => {
    const server = fakeServer(checkRoute("update-check-required"));
    await renderApp(<UpdateGate />, { signedIn: false, build: 1, server });
    await screen.findByTestId("update-required");
    server.set("GET /api/app-updates/check", { throws: new TypeError("Network request failed") });
    await fireEvent.press(screen.getByTestId("update-check-again"));
    await waitFor(() => expect(messages().join(" ")).toMatch(/Can't check right now: Can't reach the server/));
    expect(screen.getByTestId("update-required")).toBeOnTheScreen();
  });
});

describe("a server that can't be asked", () => {
  it("shows nothing and blocks nobody", async () => {
    const r = await renderApp(<UpdateGate />, { signedIn: false, build: 1, server: fakeServer({ "GET /api/app-updates/check": { throws: new TypeError("Network request failed") } }) });
    await waitFor(() => expect(r.runtime.updates.getState().checking).toBe(false));
    expect(screen.queryByTestId("update-optional")).toBeNull();
    expect(screen.queryByTestId("update-required")).toBeNull();
    expect(r.runtime.updates.getState().status).toBe("unknown");
  });

  it("an up-to-date app shows nothing", async () => {
    const r = await renderApp(<UpdateGate />, { signedIn: false, build: 2, server: fakeServer(checkRoute("update-check-current")) });
    await waitFor(() => expect(r.runtime.updates.getState().status).toBe("current"));
    expect(screen.queryByTestId("update-optional")).toBeNull();
  });
});

describe("coming back to the app", () => {
  it("asks again after a long time away, but not for a quick glance at another app", async () => {
    let onChange: ((s: string) => void) | undefined;
    // (replaced and put back by assignment: the test setup's own AppState is already a mock, and restoring a spy on it would wipe it for later tests)
    const original = AppState.addEventListener;
    AppState.addEventListener = ((_t: string, fn: (s: string) => void) => { onChange = fn; return { remove: () => undefined }; }) as never;
    // a clock the test can wind forward (the update check reads it to know how long ago it last asked)
    const realNow = Date.now.bind(Date);
    let skew = 0;
    const clock = jest.spyOn(Date, "now").mockImplementation(() => realNow() + skew);
    try {
      const server = fakeServer(checkRoute("update-check-current"));
      const r = await renderApp(<UpdateGate />, { signedIn: false, build: 2, server });
      await waitFor(() => expect(r.runtime.updates.getState().status).toBe("current"));
      expect(server.to("GET", "/api/app-updates/check")).toHaveLength(1);
      await act(async () => { onChange?.("active"); });
      expect(server.to("GET", "/api/app-updates/check")).toHaveLength(1); // a moment ago: no new question
      // thirty-one minutes later the admin has published an optional update
      skew = 31 * 60_000;
      server.set("GET /api/app-updates/check", { json: fx("update-check-optional") });
      await act(async () => { onChange?.("active"); });
      expect(server.to("GET", "/api/app-updates/check")).toHaveLength(2);
    } finally { clock.mockRestore(); AppState.addEventListener = original; }
  });
});

describe("sign-in refused because the build is out of date (426)", () => {
  it("every request carries the build number, and the refusal turns into the update screen", async () => {
    const refusal = { status: 426, json: fx("error-update-required") };
    const server = fakeServer({ "POST /api/auth/app-login": refusal });
    const r = await renderApp(<><SignInScreen /><UpdateGate /></>, { signedIn: false, build: 1, server });
    await fireEvent.changeText(await screen.findByLabelText("Email"), "chef@sandbox.test");
    await fireEvent.changeText(screen.getByLabelText("Password"), "Staff123!");
    await fireEvent.press(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(screen.getByTestId("update-required")).toBeOnTheScreen());
    const login = server.to("POST", "/api/auth/app-login")[0]!;
    expect(login.headers["x-app-id"]).toBe("kda");
    expect(login.headers["x-app-version-code"]).toBe("1");
    expect(login.headers["x-app-version"]).toMatch(/^v-/);
    expect(r.runtime.updates.getState()).toMatchObject({ status: "required", pageUrl: "https://rasoipulse.in/apps/kda" });
    expect(r.runtime.session.getState().status).not.toBe("signed-in"); // not let in
  });
});

it("an ApiError for 426 carries the code the app looks for", () => {
  const e = new ApiError(426, "x", { code: "update_required" });
  expect(e.code).toBe("update_required");
});
