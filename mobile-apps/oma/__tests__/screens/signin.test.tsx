import { act, fireEvent, screen, waitFor, within } from "@testing-library/react-native";
import { SignInScreen } from "@/screens/SignInScreen";
import { fakeServer, fx, memoryStorage, renderApp } from "../../test/harness";

const open = (server = fakeServer(), storage = memoryStorage()) => renderApp(<SignInScreen />, { server, storage, signedIn: false });
const fill = async (email: string, password: string) => {
  await fireEvent.changeText(screen.getByTestId("signin-email"), email);
  await fireEvent.changeText(screen.getByTestId("signin-password"), password);
};
const submit = () => fireEvent.press(screen.getByTestId("signin-submit"));
/** the screen has finished working (in the real app it is gone by now: signing in moves on to the tables) */
const settled = () => waitFor(() => expect(screen.getByTestId("signin-submit")).not.toBeBusy());

describe("the sign-in screen", () => {
  it("shows the app name, what OMA means and the version", async () => {
    await open();
    expect(screen.getByText("Rasoi Pulse OMA", { exact: true })).toBeOnTheScreen();
    expect(screen.getByText("Order Management App")).toBeOnTheScreen();
    expect(screen.getByText(/v-\d{2}\.\d{2}\.\d{2}-\d{3}|dev/)).toBeOnTheScreen();
  });

  it("asks for both fields before sending anything", async () => {
    const { server } = await open();
    await submit();
    expect(screen.getByText("Enter your email.")).toBeOnTheScreen();
    expect(screen.getByText("Enter your password.")).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByTestId("signin-email"), "not-an-email");
    await fireEvent.changeText(screen.getByTestId("signin-password"), "x");
    await submit();
    expect(screen.getByText("That doesn't look like an email address.")).toBeOnTheScreen();
    expect(server.to("POST", "/api/auth/app-login")).toHaveLength(0);
  });

  it("signs in: sends the trimmed email, and keeps NOTHING on the phone unless asked", async () => {
    const { server, runtime, storage } = await open();
    await fill("  waiter@sandbox.test ", "Staff123!");
    await submit();
    await waitFor(() => expect(runtime.session.getState().status).toBe("signed-in"));
    await settled();
    expect(server.to("POST", "/api/auth/app-login")[0]!.body).toEqual({ email: "waiter@sandbox.test", password: "Staff123!" });
    expect(storage.save).not.toHaveBeenCalled();
    expect(storage.state().token).toBeNull();
  });

  it("'Keep me signed in' stores the token in the phone's secure storage", async () => {
    const { runtime, storage } = await open();
    await fill("waiter@sandbox.test", "Staff123!");
    await fireEvent(screen.getByTestId("signin-keep"), "valueChange", true);
    await submit();
    await waitFor(() => expect(runtime.session.getState().status).toBe("signed-in"));
    await settled();
    expect(storage.save).toHaveBeenCalledTimes(1);
    expect(storage.state().token).toBe(runtime.session.getState().token);
  });

  it("a wrong password: says so with the attempts left, empties the password, keeps the email", async () => {
    const server = fakeServer({ "POST /api/auth/app-login": { status: 401, json: fx("error-wrong-password") } });
    await open(server);
    await fill("waiter@sandbox.test", "wrong");
    await submit();
    expect(await screen.findByText(/Incorrect email or password\. 4 attempts left/)).toBeOnTheScreen();
    expect(screen.getByTestId("signin-password").props.value).toBe("");
    expect(screen.getByTestId("signin-email").props.value).toBe("waiter@sandbox.test");
  });

  it("too many tries: shows a countdown, blocks the button, and lets the person try again when it ends", async () => {
    jest.useFakeTimers();
    try {
      const server = fakeServer({ "POST /api/auth/app-login": { status: 429, json: { error: "Too many attempts. Try again in 5 seconds.", details: { retryAfterSec: 5 } } } });
      await open(server);
      await fill("waiter@sandbox.test", "wrong");
      await submit();
      expect(await screen.findByTestId("signin-paused")).toBeOnTheScreen();
      expect(within(screen.getByTestId("signin-paused")).getByText(/Try again in 5 s/)).toBeOnTheScreen();
      expect(within(screen.getByTestId("signin-submit")).getByText("Try again in 5 s")).toBeOnTheScreen();
      expect(screen.getByTestId("signin-submit")).toBeDisabled();
      const before = server.to("POST", "/api/auth/app-login").length;
      await submit(); // pressing a disabled button sends nothing
      expect(server.to("POST", "/api/auth/app-login")).toHaveLength(before);
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

  it("an account that cannot take orders (the kitchen) is refused clearly, and its new sign-in is ended on the server", async () => {
    const server = fakeServer({ "POST /api/auth/app-login": { json: fx("auth-app-login-kitchen") } });
    const { runtime } = await open(server);
    await fill("chef@sandbox.test", "Staff123!");
    await submit();
    expect(await screen.findByText(/can't take orders/)).toBeOnTheScreen();
    expect(runtime.session.getState().status).not.toBe("signed-in");
    expect(server.to("POST", "/api/auth/logout")).toHaveLength(1);
  });

  it("a server that has no app sign-in yet (older version): says so plainly instead of 'Not found'", async () => {
    const server = fakeServer({ "POST /api/auth/app-login": { status: 404, json: { error: "Not found" } } });
    await open(server);
    await fill("waiter@sandbox.test", "Staff123!");
    await submit();
    const failure = await screen.findByTestId("signin-failure");
    expect(failure).toHaveTextContent(/This server doesn't have the app's sign-in yet/);
    expect(failure).not.toHaveTextContent(/^Not found$/);
  });

  it("shows which server the app is talking to (so a wrong server is obvious)", async () => {
    await open();
    expect(screen.getByTestId("signin-server")).toHaveTextContent(/api\.example\.test$/); // the test setup's server (jest.setup.ts)
  });

  it("no internet: says so", async () => {
    const server = fakeServer({ "POST /api/auth/app-login": { throws: new TypeError("Network request failed") } });
    await open(server);
    await fill("waiter@sandbox.test", "Staff123!");
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
    const server = fakeServer({ "POST /api/auth/app-login": { json: fx("auth-app-login"), gate } });
    const { runtime } = await open(server);
    await fill("waiter@sandbox.test", "Staff123!");
    const first = submit(); // (pressing waits for the whole sign-in, so it is not awaited here)
    await waitFor(() => expect(screen.getByTestId("signin-submit")).toBeBusy());
    await submit(); // a second tap while the first answer has not come back yet
    await act(async () => { release(); }); // now the answer arrives
    await first;
    await settled();
    expect(runtime.session.getState().status).toBe("signed-in");
    expect(server.to("POST", "/api/auth/app-login")).toHaveLength(1);
  });
});
