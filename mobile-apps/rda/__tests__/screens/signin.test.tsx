import { act, fireEvent, screen, waitFor, within } from "@testing-library/react-native";
import { SignInScreen } from "@/screens/SignInScreen";
import { fakeServer, fx, memoryStorage, renderApp } from "../../test/harness";

const open = (server = fakeServer(), storage = memoryStorage()) => renderApp(<SignInScreen />, { server, storage, signedIn: false });
const fill = async (phone: string, pin: string) => {
  await fireEvent.changeText(screen.getByTestId("signin-phone"), phone);
  await fireEvent.changeText(screen.getByTestId("signin-pin"), pin);
};
const submit = () => fireEvent.press(screen.getByTestId("signin-submit"));
/** the screen has finished working (in the real app it is gone by now: signing in moves on to the deliveries) */
const settled = () => waitFor(() => expect(screen.getByTestId("signin-submit")).not.toBeBusy());

describe("the sign-in screen", () => {
  it("shows the app name, what RDA means and the version", async () => {
    await open();
    expect(screen.getByText("Rasoi Pulse RDA", { exact: true })).toBeOnTheScreen();
    expect(screen.getByText("Rider Delivery App")).toBeOnTheScreen();
    expect(screen.getByText(/v-\d{2}\.\d{2}\.\d{2}-\d{3}|dev/)).toBeOnTheScreen();
  });

  it("shows the app's own icon at the top (the artwork on the phone's home screen), not a drawn symbol", async () => {
    await open();
    const icon = screen.getByTestId("app-icon");
    expect(icon).toBeOnTheScreen();
    expect(icon.props.accessibilityLabel).toBe("Rasoi Pulse RDA icon");
    expect(JSON.stringify(icon.props.source)).toContain("assets/icon.png");
    expect(icon.props.style.width).toBeGreaterThanOrEqual(80);
  });

  it("asks for both fields before sending anything", async () => {
    const { server } = await open();
    await submit();
    expect(screen.getByText("Enter your mobile number.")).toBeOnTheScreen();
    expect(screen.getByText("Enter your PIN.")).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByTestId("signin-phone"), "98765");
    await fireEvent.changeText(screen.getByTestId("signin-pin"), "12");
    await submit();
    expect(screen.getByText("Enter your 10-digit mobile number.")).toBeOnTheScreen();
    expect(screen.getByText("Your PIN is 4 to 6 digits.")).toBeOnTheScreen();
    expect(server.to("POST", "/api/rider/login")).toHaveLength(0);
  });

  it("signs in: sends the number and PIN, and keeps NOTHING on the phone unless asked", async () => {
    const { server, runtime, storage } = await open();
    await fill("  98765 43210 ", "4821");
    await submit();
    await waitFor(() => expect(runtime.session.getState().status).toBe("signed-in"));
    await settled();
    expect(server.to("POST", "/api/rider/login")[0]!.body).toEqual({ phone: "98765 43210", pin: "4821" });
    expect(storage.save).not.toHaveBeenCalled();
    expect(storage.state().token).toBeNull();
  });

  it("'Keep me signed in' stores the token in the phone's secure storage", async () => {
    const { runtime, storage } = await open();
    await fill("9876543210", "4821");
    await fireEvent(screen.getByTestId("signin-keep"), "valueChange", true);
    await submit();
    await waitFor(() => expect(runtime.session.getState().status).toBe("signed-in"));
    await settled();
    expect(storage.save).toHaveBeenCalledTimes(1);
    expect(storage.state().token).toBe(runtime.session.getState().token);
  });

  it("a wrong PIN: says so with the tries left, empties the PIN, keeps the number", async () => {
    const server = fakeServer({ "POST /api/rider/login": { status: 401, json: fx("error-wrong-pin") } });
    await open(server);
    await fill("9876543210", "0000");
    await submit();
    expect(await screen.findByText(/Incorrect phone number or PIN\. 4 tries left/)).toBeOnTheScreen();
    expect(screen.getByTestId("signin-pin").props.value).toBe("");
    expect(screen.getByTestId("signin-phone").props.value).toBe("9876543210");
  });

  it("too many tries: shows a countdown, blocks the button, and lets the person try again when it ends", async () => {
    jest.useFakeTimers();
    try {
      const server = fakeServer({ "POST /api/rider/login": { status: 429, json: { error: "Too many attempts. Try again in 5 seconds.", details: { retryAfterSec: 5 } } } });
      await open(server);
      await fill("9876543210", "0000");
      await submit();
      expect(await screen.findByTestId("signin-paused")).toBeOnTheScreen();
      expect(within(screen.getByTestId("signin-paused")).getByText(/Try again in 5 s/)).toBeOnTheScreen();
      expect(within(screen.getByTestId("signin-submit")).getByText("Try again in 5 s")).toBeOnTheScreen();
      expect(screen.getByTestId("signin-submit")).toBeDisabled();
      const before = server.to("POST", "/api/rider/login").length;
      await submit(); // pressing a disabled button sends nothing
      expect(server.to("POST", "/api/rider/login")).toHaveLength(before);
      await act(async () => { await jest.advanceTimersByTimeAsync(6000); });
      expect(screen.queryByTestId("signin-paused")).toBeNull();
      expect(screen.getByTestId("signin-submit")).toBeEnabled();
    } finally { jest.useRealTimers(); }
  });

  it("an address that is already paused when the app opens shows the countdown at once", async () => {
    const server = fakeServer({ "GET /api/auth/guard": { json: { blocked: true, retryAfterSec: 90 } } });
    await open(server);
    expect(await screen.findByTestId("signin-paused")).toBeOnTheScreen();
    expect(within(screen.getByTestId("signin-paused")).getByText(/1 min 30 s/)).toBeOnTheScreen();
  });

  it("a server that has no app sign-in yet (older version): says so plainly instead of 'Not found'", async () => {
    const server = fakeServer({ "POST /api/rider/login": { status: 404, json: { error: "Not found" } } });
    await open(server);
    await fill("9876543210", "4821");
    await submit();
    const failure = await screen.findByTestId("signin-failure");
    expect(failure).toHaveTextContent(/This server doesn't have the rider sign-in yet/);
    expect(failure).not.toHaveTextContent(/^Not found$/);
  });

  it("only digits can be typed in the PIN, at most six", async () => {
    await open();
    await fireEvent.changeText(screen.getByTestId("signin-pin"), "12ab34567");
    expect(screen.getByTestId("signin-pin").props.value).toBe("123456");
  });

  it("a switched-off login: the manager's sentence is shown and nobody is signed in", async () => {
    const server = fakeServer({ "POST /api/rider/login": { status: 403, json: fx("error-switched-off") } });
    const { runtime } = await open(server);
    await fill("9876543210", "4821");
    await submit();
    expect(await screen.findByText("Your login is switched off. Ask your manager.")).toBeOnTheScreen();
    expect(runtime.session.getState().status).not.toBe("signed-in");
  });

  it("shows which server the app is talking to (so a wrong server is obvious)", async () => {
    await open();
    expect(screen.getByTestId("signin-server")).toHaveTextContent(/api\.example\.test$/); // the test setup's server (jest.setup.ts)
  });

  it("no internet: says so", async () => {
    const server = fakeServer({ "POST /api/rider/login": { throws: new TypeError("Network request failed") } });
    await open(server);
    await fill("9876543210", "4821");
    await submit();
    expect(await screen.findByText(/Can't reach the server/)).toBeOnTheScreen();
  });

  it("shows why the person is back here (their sign-in ended)", async () => {
    const { runtime } = await renderApp(<SignInScreen />, { signedIn: true });
    await act(async () => { runtime.session.getState().expire(); });
    expect(await screen.findByText("Your sign-in ended. Please sign in again.")).toBeOnTheScreen();
  });

  it("a double tap sends one request", async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const server = fakeServer({ "POST /api/rider/login": { json: fx("rider-login"), gate } });
    const { runtime } = await open(server);
    await fill("9876543210", "4821");
    const first = submit(); // (pressing waits for the whole sign-in, so it is not awaited here)
    await waitFor(() => expect(screen.getByTestId("signin-submit")).toBeBusy());
    await submit(); // a second tap while the first answer has not come back yet
    await act(async () => { release(); }); // now the answer arrives
    await first;
    await settled();
    expect(runtime.session.getState().status).toBe("signed-in");
    expect(server.to("POST", "/api/rider/login")).toHaveLength(1);
  });
});
