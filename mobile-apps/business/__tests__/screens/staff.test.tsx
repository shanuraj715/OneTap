import { act, fireEvent, screen, waitFor, within } from "@testing-library/react-native";
import { Share } from "react-native";
import { Staff } from "@/screens/Staff";
import { MANAGER, renderApp } from "../../test/harness";
import { freshScope, person, reportsServer, staffList } from "../../test/data";

beforeEach(() => freshScope());
const open = async (server = reportsServer(), as?: Parameters<typeof renderApp>[1]) => { const v = await renderApp(<Staff />, { server, ...as }); await screen.findByTestId("staff-u1"); return v; };

describe("Staff — the list", () => {
  it("shows everyone with their role, outlets and when they last signed in", async () => {
    await open();
    const manu = screen.getByTestId("staff-u1");
    expect(manu).toHaveTextContent(/Manu Manager/); expect(manu).toHaveTextContent(/boss@acme.test/); expect(manu).toHaveTextContent(/Noida/); expect(manu).toHaveTextContent(/Manager/);
    expect(screen.getByTestId("staff-u2")).toHaveTextContent(/All outlets/);
    expect(screen.getByTestId("staff-u2")).toHaveTextContent(/Cashier \/ Staff/);
    expect(screen.getByTestId("staff-u3")).toHaveTextContent(/signed in never/);
    expect(screen.getByTestId("staff-u3")).toHaveTextContent(/Switched off/);
  });
  it("counts the people, who can sign in and who is switched off", async () => {
    await open();
    expect(within(screen.getByTestId("staff-total")).getByText("5")).toBeOnTheScreen();
    expect(within(screen.getByTestId("staff-active")).getByText("4")).toBeOnTheScreen();
    expect(within(screen.getByTestId("staff-off")).getByText("1")).toBeOnTheScreen();
  });
  it("search narrows by name or email, and a role chip by role", async () => {
    await open();
    await fireEvent.changeText(screen.getByTestId("staff-search"), "kabir");
    expect(screen.queryByTestId("staff-u1")).toBeNull();
    expect(screen.getByTestId("staff-u3")).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByTestId("staff-search"), "nobody here");
    expect(await screen.findByText("Nobody matches")).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByTestId("staff-search"), "");
    await fireEvent.press(screen.getByTestId("staff-role-accountant"));
    expect(screen.queryByTestId("staff-u1")).toBeNull();
    expect(screen.getByTestId("staff-u4")).toBeOnTheScreen();
  });
  it("a role without access is told so", async () => {
    await renderApp(<Staff />, { server: reportsServer({ "GET /api/users": { status: 403, json: { error: "Forbidden" } } }) });
    expect(await screen.findByText("Not allowed")).toBeOnTheScreen();
  });
});

describe("Staff — adding", () => {
  const server = () => reportsServer({ "POST /api/users": { status: 201, json: { user: person({ id: "u7", name: "Nina New", email: "nina@acme.test", role: "kitchen" }) } } });

  it("won't save until the name, a real email and a password of 8+ characters are there", async () => {
    await open(server());
    await fireEvent.press(screen.getByTestId("staff-add"));
    expect(screen.getByTestId("staff-save")).toBeDisabled();
    await fireEvent.changeText(screen.getByTestId("staff-name"), "Nina New");
    await fireEvent.changeText(screen.getByTestId("staff-email"), "nina@");
    expect(await screen.findByText("That doesn't look like an email address.")).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByTestId("staff-email"), "nina@acme.test");
    await fireEvent.changeText(screen.getByTestId("staff-password"), "short");
    expect(await screen.findByText("Use at least 8 characters.")).toBeOnTheScreen();
    expect(screen.getByTestId("staff-save")).toBeDisabled();
    await fireEvent.changeText(screen.getByTestId("staff-password"), "longenough1");
    expect(screen.getByTestId("staff-save")).toBeEnabled();
  });

  it("sends the person with the role and outlets chosen, then shows the sign-in details once", async () => {
    const s = server();
    await open(s);
    await fireEvent.press(screen.getByTestId("staff-add"));
    await fireEvent.changeText(screen.getByTestId("staff-name"), "  Nina New ");
    await fireEvent.changeText(screen.getByTestId("staff-email"), "Nina@Acme.test");
    await fireEvent.press(screen.getByTestId("staff-generate"));
    await fireEvent.press(screen.getByTestId("staff-role-select"));
    await fireEvent.press(await screen.findByTestId("staff-role-select-option-kitchen"));
    await fireEvent.press(screen.getByTestId("staff-outlet-o2"));
    await act(async () => { await fireEvent.press(screen.getByTestId("staff-save")); });
    await waitFor(() => expect(s.to("POST", "/api/users")).toHaveLength(1));
    const body = s.to("POST", "/api/users")[0]!.body;
    expect(body).toMatchObject({ name: "Nina New", email: "nina@acme.test", role: "kitchen", outletIds: ["o2"] });
    expect(body.password).toMatch(/^[A-HJ-NP-Za-km-z2-9]{10}$/);
    expect(await screen.findByTestId("staff-added")).toBeOnTheScreen();
    expect(screen.getByTestId("staff-added-email")).toHaveTextContent("nina@acme.test");
    expect(screen.getByTestId("staff-added-password")).toHaveTextContent(body.password);
  });

  it("the details can be sent on with the phone's share sheet", async () => {
    const share = jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction", activityType: undefined });
    await open(server());
    await fireEvent.press(screen.getByTestId("staff-add"));
    await fireEvent.changeText(screen.getByTestId("staff-name"), "Nina");
    await fireEvent.changeText(screen.getByTestId("staff-email"), "nina@acme.test");
    await fireEvent.changeText(screen.getByTestId("staff-password"), "Secret12345");
    await act(async () => { await fireEvent.press(screen.getByTestId("staff-save")); });
    await fireEvent.press(await screen.findByTestId("staff-added-send"));
    expect(share).toHaveBeenCalledWith({ message: expect.stringContaining("Secret12345") });
    expect(share.mock.calls[0]![0].message).toContain("nina@acme.test");
    share.mockRestore();
  });

  it("the server's reason is shown when it says no (an email already in use)", async () => {
    await open(reportsServer({ "POST /api/users": { status: 409, json: { error: "That email is already in use" } } }));
    await fireEvent.press(screen.getByTestId("staff-add"));
    await fireEvent.changeText(screen.getByTestId("staff-name"), "Nina");
    await fireEvent.changeText(screen.getByTestId("staff-email"), "asha@acme.test");
    await fireEvent.changeText(screen.getByTestId("staff-password"), "Secret12345");
    await act(async () => { await fireEvent.press(screen.getByTestId("staff-save")); });
    expect(await screen.findByText("That email is already in use")).toBeOnTheScreen();
    expect(screen.getByTestId("staff-name")).toBeOnTheScreen(); // still open
    expect(screen.queryByTestId("staff-added")).toBeNull();
  });

  it("the owner role can't be given from the app", async () => {
    await open(server());
    await fireEvent.press(screen.getByTestId("staff-add"));
    await fireEvent.press(screen.getByTestId("staff-role-select"));
    await screen.findByTestId("staff-role-select-option-manager");
    expect(screen.queryByTestId("staff-role-select-option-owner")).toBeNull();
  });
});

describe("Staff — changing and removing", () => {
  const patch = () => reportsServer({ "PATCH /api/users/:id": { json: { user: person() } } });

  it("sends only what changed", async () => {
    const s = patch();
    await open(s);
    await fireEvent.press(screen.getByTestId("staff-u1")); // Manu: manager at Noida
    await fireEvent.press(screen.getByTestId("staff-role-select"));
    await fireEvent.press(await screen.findByTestId("staff-role-select-option-accountant"));
    await act(async () => { await fireEvent.press(screen.getByTestId("staff-save")); });
    await waitFor(() => expect(s.to("PATCH", "/api/users/u1")).toHaveLength(1));
    expect(s.to("PATCH", "/api/users/u1")[0]!.body).toEqual({ role: "accountant" });
    expect(await screen.findByText("Saved.")).toBeOnTheScreen();
  });

  it("changes outlets, sends a new password, and can switch someone off", async () => {
    const s = patch();
    await open(s);
    await fireEvent.press(screen.getByTestId("staff-u2")); // Asha: every outlet
    await fireEvent.press(screen.getByTestId("staff-outlet-o1"));
    await fireEvent.changeText(screen.getByTestId("staff-password"), "BrandNew123");
    await fireEvent(screen.getByTestId("staff-active-switch"), "valueChange", false);
    await act(async () => { await fireEvent.press(screen.getByTestId("staff-save")); });
    await waitFor(() => expect(s.to("PATCH", "/api/users/u2")).toHaveLength(1));
    expect(s.to("PATCH", "/api/users/u2")[0]!.body).toEqual({ isActive: false, password: "BrandNew123", outletIds: ["o1"] });
  });

  it("a new password under 8 characters is refused before anything is sent", async () => {
    const s = patch();
    await open(s);
    await fireEvent.press(screen.getByTestId("staff-u2"));
    await fireEvent.changeText(screen.getByTestId("staff-password"), "abc");
    expect(await screen.findByText("Use at least 8 characters.")).toBeOnTheScreen();
    expect(screen.getByTestId("staff-save")).toBeDisabled();
  });

  it("removing asks first and only then deletes", async () => {
    const s = reportsServer({ "DELETE /api/users/:id": { status: 204 } });
    await open(s);
    await fireEvent.press(screen.getByTestId("staff-u3"));
    await fireEvent.press(screen.getByTestId("staff-remove"));
    expect(await screen.findByText("Remove Kabir Kitchen?")).toBeOnTheScreen();
    expect(s.to("DELETE", "/api/users/u3")).toHaveLength(0);
    await act(async () => { await fireEvent.press(screen.getByTestId("confirm-yes")); });
    await waitFor(() => expect(s.to("DELETE", "/api/users/u3")).toHaveLength(1));
    expect(await screen.findByText("Person removed.")).toBeOnTheScreen();
  });

  it("an owner account is read-only: Rasoi Pulse manages it", async () => {
    await open(reportsServer(), { signedInAs: { ...MANAGER, role: "owner", permissions: [...MANAGER.permissions, "user:manage", "user:read"] } });
    await fireEvent.press(screen.getByTestId("staff-u0"));
    expect(await screen.findByTestId("staff-owner-note")).toBeOnTheScreen();
    expect(screen.queryByTestId("staff-save")).toBeNull();
    expect(screen.queryByTestId("staff-remove")).toBeNull();
  });

  it("you can't remove yourself or change your own role", async () => {
    // the signed-in person is "u1" here, a manager who is allowed to manage people in this test
    await open(reportsServer(), { signedInAs: { ...MANAGER, permissions: [...MANAGER.permissions, "user:manage", "user:read"] } });
    await fireEvent.press(screen.getByTestId("staff-u1"));
    expect(await screen.findByText(/can't change your own role/)).toBeOnTheScreen();
    expect(screen.queryByTestId("staff-remove")).toBeNull();
    expect(screen.getByTestId("staff-role-select")).toBeDisabled();
  });

  it("someone who may look but not manage sees the people and no buttons to change them", async () => {
    await open(reportsServer(), { signedInAs: { ...MANAGER, permissions: [...MANAGER.permissions, "user:read"] } });
    expect(screen.queryByTestId("staff-add")).toBeNull();
    await fireEvent.press(screen.getByTestId("staff-u2"));
    expect(await screen.findByText("Only the owner can change people.")).toBeOnTheScreen();
    expect(screen.queryByTestId("staff-save")).toBeNull();
  });
});

test("the made-up team is what the tests think it is", () => { expect(staffList().map((p) => p.id)).toEqual(["u0", "u1", "u2", "u3", "u4"]); });
