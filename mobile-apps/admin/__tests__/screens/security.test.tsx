import { fireEvent, screen, waitFor, within } from "@testing-library/react-native";
import { Security } from "@/screens/Security";
import { fakeServer, renderApp } from "../../test/harness";

const SETTINGS = { maxFailures: 5, windowSeconds: 600, steps: [900, 3600, 21600], forgetSeconds: 86400, floodPerMinute: 30 };
const BLOCKS = [
  { id: "b1", ip: "203.0.113.9", scope: "staff", blocked: true, blockedUntil: new Date(Date.now() + 600_000).toISOString(), failures: 5, strikes: 2, lastAttemptAt: "2026-11-27T10:00:00Z" },
  { id: "b2", ip: "198.51.100.4", scope: "customer", blocked: false, blockedUntil: null, failures: 2, strikes: 0, lastAttemptAt: "2026-11-27T09:00:00Z" },
];
const open = (blocks = BLOCKS) => renderApp(<Security />, { server: fakeServer({ "GET /api/platform/security/blocks": { json: { blocks, enabled: true, settings: SETTINGS } }, "DELETE /api/platform/security/blocks/:id": { status: 204 }, "DELETE /api/platform/security/blocks": { status: 204 } }) });

describe("the security screen", () => {
  it("lists blocked and watched networks, what each is for, and how long a block has left", async () => {
    await open();
    const b = within(await screen.findByTestId("block-203.0.113.9"));
    expect(b.getByText(/Dashboards · 5 wrong · blocked 2×/)).toBeOnTheScreen();
    expect(b.getByText(/Blocked · 10 min left/)).toBeOnTheScreen();
    expect(within(screen.getByTestId("block-198.51.100.4")).getByText("Watching")).toBeOnTheScreen();
    expect(screen.getByText(/Customer codes/)).toBeOnTheScreen();
  });

  it("explains the rules with the server's real numbers", async () => {
    await open();
    expect(await screen.findByTestId("guard-rules")).toHaveTextContent(/After 5 wrong passwords or codes within 10 min, that network is blocked for 15 min\. Each further block lasts longer \(15 min → 60 min → 6 h\)/);
  });

  it("Unblock frees that one network only", async () => {
    const { server } = await open();
    await fireEvent.press(await screen.findByTestId("unblock-203.0.113.9"));
    await waitFor(() => expect(server.to("DELETE", "/api/platform/security/blocks/b1")).toHaveLength(1));
    expect(server.to("DELETE", "/api/platform/security/blocks/b2")).toHaveLength(0);
  });

  it("Unblock all asks first, then frees everyone", async () => {
    const { server } = await open();
    await fireEvent.press(await screen.findByTestId("unblock-all"));
    expect(server.to("DELETE", "/api/platform/security/blocks")).toHaveLength(0);
    await fireEvent.press(await screen.findByTestId("confirm-yes"));
    await waitFor(() => expect(server.to("DELETE", "/api/platform/security/blocks")).toHaveLength(1));
  });

  it("nobody blocked says so, and there is no Unblock all", async () => {
    await open([]);
    expect(await screen.findByText("Nothing to show")).toBeOnTheScreen();
    expect(screen.queryByTestId("unblock-all")).toBeNull();
  });
});
