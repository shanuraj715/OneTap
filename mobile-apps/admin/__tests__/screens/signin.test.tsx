import { AccessibilityInfo } from "react-native";
import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { SignInScreen } from "@/screens/SignInScreen";
import { fakeServer, OWNER, renderApp } from "../../test/harness";

const open = (server = fakeServer()) => renderApp(<SignInScreen />, { server, signedInAs: null });
const fill = async (email: string, password: string) => {
  await fireEvent.changeText(screen.getByTestId("signin-email"), email);
  await fireEvent.changeText(screen.getByTestId("signin-password"), password);
};
const submit = () => fireEvent.press(screen.getByTestId("signin-submit"));

describe("the sign-in screen", () => {
  it("shows the app's own icon, the name, what it is for and which server it talks to", async () => {
    await open();
    const icon = screen.getByTestId("app-icon");
    expect(icon.props.accessibilityLabel).toBe("Rasoi Pulse Admin icon");
    expect(JSON.stringify(icon.props.source)).toContain("assets/icon.png");
    expect(screen.getByText("Rasoi Pulse Admin", { exact: true })).toBeOnTheScreen();
    expect(screen.getByText("For the Rasoi Pulse team")).toBeOnTheScreen();
    expect(screen.getByTestId("signin-server")).toHaveTextContent(/v-\d{2}\.\d{2}\.\d{2}-\d{3}|dev/);
  });

  it("asks for both fields before sending anything", async () => {
    const { server } = await open();
    await submit();
    expect(screen.getByText("Enter your email.")).toBeOnTheScreen();
    expect(screen.getByText("Enter your password.")).toBeOnTheScreen();
    await fill("not-an-email", "x");
    await submit();
    expect(screen.getByText("That doesn't look like an email address.")).toBeOnTheScreen();
    expect(server.to("POST", "/api/auth/app-login")).toHaveLength(0);
  });

  it("signs in with the trimmed email, sending the app's name, and does not keep the token unless asked", async () => {
    const server = fakeServer({ "POST /api/auth/app-login": { json: { token: "tok", expiresAt: "x", user: OWNER } } });
    const { runtime, storage } = await open(server);
    await fill("  owner@rasoipulse.test ", "Password12345");
    await submit();
    await waitFor(() => expect(runtime.session.getState().status).toBe("signed-in"));
    expect(server.to("POST", "/api/auth/app-login")[0]!.headers["x-app-id"]).toBe("admin");
    expect(server.to("POST", "/api/auth/app-login")[0]!.body.email).toBe("owner@rasoipulse.test");
    expect(storage.save).not.toHaveBeenCalled();
  });

  it("'Keep me signed in' keeps the token on the phone", async () => {
    const server = fakeServer({ "POST /api/auth/app-login": { json: { token: "tok", expiresAt: "x", user: OWNER } } });
    const { storage } = await open(server);
    await fill("owner@rasoipulse.test", "Password12345");
    await fireEvent(screen.getByTestId("signin-keep"), "valueChange", true);
    await submit();
    await waitFor(() => expect(storage.value()).toBe("tok"));
  });

  it("a wrong password says so in words and clears the password box", async () => {
    const server = fakeServer({ "POST /api/auth/app-login": { status: 401, json: { error: "Incorrect email or password" } } });
    await open(server);
    await fill("owner@rasoipulse.test", "wrong-password");
    await submit();
    expect(await screen.findByTestId("signin-failure")).toHaveTextContent("Incorrect email or password.");
    expect(screen.getByTestId("signin-password").props.value).toBe("");
  });

  it("someone who isn't on the Rasoi Pulse team (a restaurant's owner) is told, in the server's words", async () => {
    const server = fakeServer({ "POST /api/auth/app-login": { status: 403, json: { error: "Rasoi Pulse Admin is for the Rasoi Pulse team. This account can't use it.", details: { code: "app_not_allowed" } } } });
    await open(server);
    await fill("o@acme.test", "Owner123!");
    await submit();
    expect(await screen.findByText(/for the Rasoi Pulse team/)).toBeOnTheScreen();
  });

  it("too many wrong tries shows a countdown instead of letting the person keep trying", async () => {
    jest.useFakeTimers();
    // a phone that asks for less motion: the background does not move, so a second of fake time is not thousands of animation frames
    const reduced = jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
    try {
      const server = fakeServer({ "GET /api/auth/guard": { json: { blocked: true, retryAfterSec: 90 } } });
      await open(server);
      await act(async () => { await jest.advanceTimersByTimeAsync(50); });
      expect(screen.getByTestId("signin-paused")).toHaveTextContent(/paused for 2 min/);
      expect(screen.getByTestId("signin-submit")).toBeDisabled();
      for (let i = 0; i < 31; i++) await act(async () => { await jest.advanceTimersByTimeAsync(1000); }); // a tick at a time: each one re-draws, which books the next
      expect(screen.getByTestId("signin-paused")).toHaveTextContent(/paused for 59 s/);
    } finally { reduced.mockRestore(); jest.useRealTimers(); }
  }, 30_000);
});
