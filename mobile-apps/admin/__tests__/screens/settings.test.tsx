import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { Settings } from "@/screens/Settings";
import { fakeServer, renderApp } from "../../test/harness";

const open = () => renderApp(<Settings />, { server: fakeServer({ "GET /api/platform/settings": { json: { settings: { graceDays: 7, realtimeWebsocket: true, subdomainBase: "rasoipulse.in" } } }, "PUT /api/platform/settings": { json: { settings: {} } } }) });

describe("the settings screen", () => {
  it("shows what is set now, and Save waits for a change", async () => {
    await open();
    expect((await screen.findByTestId("setting-grace")).props.value).toBe("7");
    expect(screen.getByTestId("setting-live").props.value).toBe(true);
    expect(screen.getByText("rasoipulse.in")).toBeOnTheScreen();
    expect(screen.getByTestId("settings-save")).toBeDisabled();
  });

  it("saves the grace days and the live switch together", async () => {
    const { server } = await open();
    await fireEvent.changeText(await screen.findByTestId("setting-grace"), "14");
    await fireEvent(screen.getByTestId("setting-live"), "valueChange", false);
    await fireEvent.press(screen.getByTestId("settings-save"));
    await waitFor(() => expect(server.to("PUT", "/api/platform/settings")).toHaveLength(1));
    expect(server.to("PUT", "/api/platform/settings")[0]!.body).toEqual({ graceDays: 14, realtimeWebsocket: false });
  });

  it("only digits are accepted, and an empty or too big number blocks Save with a reason", async () => {
    await open();
    await fireEvent.changeText(await screen.findByTestId("setting-grace"), "1a2");
    expect(screen.getByTestId("setting-grace").props.value).toBe("12");
    await fireEvent.changeText(screen.getByTestId("setting-grace"), "");
    expect(screen.getByText("Enter a whole number from 0 to 365.")).toBeOnTheScreen();
    expect(screen.getByTestId("settings-save")).toBeDisabled();
    await fireEvent.changeText(screen.getByTestId("setting-grace"), "400");
    expect(screen.getByTestId("settings-save")).toBeDisabled();
  });
});
