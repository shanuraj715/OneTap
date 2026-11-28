import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { Share } from "react-native";
import { AppManagement } from "@/screens/AppManagement";
import { AreaScreen } from "@/screens/AreaScreen";
import { SALES, fakeServer, renderApp } from "../../test/harness";

const app = (over: Record<string, unknown>) => ({ app: "oma", code: "OMA", name: "Rasoi Pulse OMA", public: true, publicByDefault: true, usesRefreshInterval: true, pageUrl: "https://rasoipulse.in/apps/oma", refreshSeconds: 8, updatedAt: null, ...over });
const SETTINGS = [app({}), app({ app: "kda", code: "KDA", name: "Rasoi Pulse KDA" }), app({ app: "admin", code: "ADM", name: "Rasoi Pulse Admin", public: false, publicByDefault: false, pageUrl: "https://rasoipulse.in/apps/admin" }), app({ app: "business", code: "BIZ", name: "Rasoi Pulse Business", public: false, publicByDefault: false, pageUrl: "https://rasoipulse.in/apps/business" })];
const server = (extra = {}) => fakeServer({ "GET /api/platform/app-releases/settings": { json: { settings: SETTINGS } }, "PUT /api/platform/app-releases/visibility/:app": { json: { ok: true } }, ...extra });

describe("App Management", () => {
  it("lists every app with its code and whether it is public or private", async () => {
    await renderApp(<AppManagement />, { server: server() });
    expect(await screen.findByTestId("app-oma")).toHaveTextContent(/OMA/);
    expect(screen.getByTestId("app-oma")).toHaveTextContent(/Public/);
    expect(screen.getByTestId("app-admin")).toHaveTextContent(/Private/);
    expect(screen.getByTestId("app-business")).toHaveTextContent(/Rasoi Pulse Business/);
    expect(screen.getByTestId("app-business")).toHaveTextContent(/apps\/business/);
    expect(screen.getByTestId("app-switch-oma").props.value).toBe(true);
    expect(screen.getByTestId("app-switch-admin").props.value).toBe(false);
  });

  it("making a public app private is one tap and tells the server", async () => {
    const s = server();
    await renderApp(<AppManagement />, { server: s });
    await act(async () => { await fireEvent(await screen.findByTestId("app-switch-oma"), "valueChange", false); });
    await waitFor(() => expect(s.to("PUT", "/api/platform/app-releases/visibility/oma")).toHaveLength(1));
    expect(s.to("PUT", "/api/platform/app-releases/visibility/oma")[0]!.body).toEqual({ public: false });
    expect(await screen.findByText(/Now private/)).toBeOnTheScreen();
  });

  it("making a private app public asks first, and only a yes tells the server", async () => {
    const s = server();
    await renderApp(<AppManagement />, { server: s });
    await fireEvent(await screen.findByTestId("app-switch-business"), "valueChange", true);
    expect(await screen.findByText("Make Rasoi Pulse Business public?")).toBeOnTheScreen();
    expect(s.to("PUT", "/api/platform/app-releases/visibility/business")).toHaveLength(0);
    await act(async () => { await fireEvent.press(screen.getByTestId("confirm-yes")); });
    await waitFor(() => expect(s.to("PUT", "/api/platform/app-releases/visibility/business")).toHaveLength(1));
    expect(s.to("PUT", "/api/platform/app-releases/visibility/business")[0]!.body).toEqual({ public: true });
    expect(await screen.findByText(/Now public/)).toBeOnTheScreen();
  });

  it("saying no leaves the app private", async () => {
    const s = server();
    await renderApp(<AppManagement />, { server: s });
    await fireEvent(await screen.findByTestId("app-switch-admin"), "valueChange", true);
    await fireEvent.press(await screen.findByText("Cancel"));
    expect(s.to("PUT", "/api/platform/app-releases/visibility/admin")).toHaveLength(0);
  });

  it("the server's refusal is shown and nothing changes on screen", async () => {
    await renderApp(<AppManagement />, { server: server({ "PUT /api/platform/app-releases/visibility/:app": { status: 403, json: { error: "Your role can't manage apps." } } }) });
    await act(async () => { await fireEvent(await screen.findByTestId("app-switch-kda"), "valueChange", false); });
    expect(await screen.findByText(/can't/)).toBeOnTheScreen();
    expect(screen.getByTestId("app-switch-kda").props.value).toBe(true);
  });

  it("Share link opens the phone's share sheet with the app's page", async () => {
    const share = jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction", activityType: undefined });
    await renderApp(<AppManagement />, { server: server() });
    await fireEvent.press(await screen.findByTestId("app-share-business"));
    expect(share).toHaveBeenCalledWith({ message: "Rasoi Pulse Business: https://rasoipulse.in/apps/business" });
    share.mockRestore();
  });

  it("when the list can't be loaded it says so", async () => {
    await renderApp(<AppManagement />, { server: server({ "GET /api/platform/app-releases/settings": { status: 500, json: { error: "x" } } }) });
    expect(await screen.findByText("Couldn't load this")).toBeOnTheScreen();
  });

  it("a team member without the apps permission does not get the screen", async () => {
    await renderApp(<AreaScreen id="app-management" />, { server: server(), signedInAs: SALES });
    expect(await screen.findByTestId("no-access")).toBeOnTheScreen();
    expect(screen.queryByTestId("screen-app-management")).toBeNull();
  });
});
