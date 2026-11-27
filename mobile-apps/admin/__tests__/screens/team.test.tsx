import { fireEvent, screen, waitFor, within } from "@testing-library/react-native";
import { Team } from "@/screens/Team";
import { AreaScreen } from "@/screens/AreaScreen";
import { makePassword, strongEnough } from "@/lib/password";
import { fakeServer, SALES, renderApp } from "../../test/harness";

const FEATURES = [
  { key: "stores:read", group: "Stores", label: "Stores — view", hint: "See every store." },
  { key: "stores:manage", group: "Stores", label: "Stores — create and change", hint: "Change a store." },
  { key: "onboarding:manage", group: "Sales", label: "Onboarding", hint: "Take a new client's requirements." },
];
const ROLES = { roles: [{ id: "r1", name: "Sales", description: "Gets clients", features: ["onboarding:manage"], effective: ["onboarding:manage"], members: 1 }, { id: "r2", name: "Support", description: "", features: ["stores:read"], effective: ["stores:read"], members: 0 }], features: FEATURES, groups: ["Stores", "Sales"] };
const TEAM = { members: [{ id: "m1", name: "Sam Sales", email: "sam@rasoipulse.test", isActive: true, roleId: "r1", roleName: "Sales", lastLoginAt: "2026-11-26T10:00:00Z" }, { id: "m2", name: "Old Hand", email: "old@rasoipulse.test", isActive: false, roleId: "r2", roleName: "Support", lastLoginAt: null }] };
const server = () => fakeServer({ "GET /api/platform/roles": { json: ROLES }, "GET /api/platform/team": { json: TEAM }, "GET /api/platform/audit": { json: { entries: [{ id: "a1", at: "2026-11-27T10:00:00Z", actor: "Platform Owner", action: "role.update", target: "Sales", detail: "added: leads:manage; removed: none" }] } } });

describe("passwords the owner hands out", () => {
  it("are 14 characters of letters and digits (no look-alikes) and always strong enough", () => {
    for (let i = 0; i < 50; i++) {
      const p = makePassword();
      expect(p).toHaveLength(14);
      expect(p).toMatch(/^[A-Za-z2-9]+$/);
      expect(p).not.toMatch(/[lIO01]/);
      expect(strongEnough(p)).toBe(true);
    }
    expect(new Set(Array.from({ length: 30 }, () => makePassword())).size).toBe(30);
  });
  it("the rule is the server's: 10+ characters with a letter and a number", () => {
    expect(strongEnough("short1")).toBe(false);
    expect(strongEnough("onlyletterspassword")).toBe(false);
    expect(strongEnough("1234567890123")).toBe(false);
    expect(strongEnough("Sales2026Pass")).toBe(true);
  });
});

describe("Team & roles", () => {
  it("lists the people with their role and whether they are switched on", async () => {
    await renderApp(<Team />, { server: server() });
    expect(await screen.findByTestId("member-sam@rasoipulse.test")).toBeOnTheScreen();
    expect(within(screen.getByTestId("member-sam@rasoipulse.test")).getByText("Active")).toBeOnTheScreen();
    expect(within(screen.getByTestId("member-old@rasoipulse.test")).getByText("Switched off")).toBeOnTheScreen();
    expect(within(screen.getByTestId("member-old@rasoipulse.test")).getByText("Support")).toBeOnTheScreen();
  });

  it("adds a person: a strong password is already made, and shown once after saving", async () => {
    const s = server();
    s.set("POST /api/platform/team", { status: 201, json: { member: { id: "m3", name: "New Person", email: "new@rasoipulse.test", isActive: true, roleId: "r1", roleName: "Sales", lastLoginAt: null } } });
    await renderApp(<Team />, { server: s });
    await screen.findByTestId("member-sam@rasoipulse.test");
    await fireEvent.press(screen.getByTestId("new-member"));
    const made = (await screen.findByTestId("member-password")).props.value as string;
    expect(strongEnough(made)).toBe(true);
    expect(screen.getByTestId("member-save")).toBeDisabled(); // needs a name and an email
    await fireEvent.changeText(screen.getByTestId("member-name"), "New Person");
    await fireEvent.changeText(screen.getByTestId("member-email"), " new@rasoipulse.test ");
    await fireEvent.press(screen.getByTestId("member-save"));
    await waitFor(() => expect(s.to("POST", "/api/platform/team")).toHaveLength(1));
    expect(s.to("POST", "/api/platform/team")[0]!.body).toEqual({ name: "New Person", email: "new@rasoipulse.test", roleId: "r1", password: made });
    expect(await screen.findByTestId("password-shown")).toHaveTextContent(made);
  });

  it("a weak password is not accepted", async () => {
    await renderApp(<Team />, { server: server() });
    await screen.findByTestId("member-sam@rasoipulse.test");
    await fireEvent.press(screen.getByTestId("new-member"));
    await fireEvent.changeText(await screen.findByTestId("member-name"), "Weak Person");
    await fireEvent.changeText(screen.getByTestId("member-email"), "weak@rasoipulse.test");
    await fireEvent.changeText(screen.getByTestId("member-password"), "short1");
    expect(screen.getByTestId("member-save")).toBeDisabled();
  });

  it("sets a new password (shown once) and switches a person off", async () => {
    const s = server();
    s.set("PATCH /api/platform/team/m1", (call) => ({ json: { member: { ...TEAM.members[0], ...call.body } } }));
    await renderApp(<Team />, { server: s });
    await fireEvent.press(await screen.findByTestId("pw-sam@rasoipulse.test"));
    const pw = (await screen.findByTestId("password-new")).props.value as string;
    await fireEvent.press(screen.getByTestId("password-save"));
    await waitFor(() => expect(s.to("PATCH", "/api/platform/team/m1")[0]?.body).toEqual({ password: pw }));
    expect(await screen.findByTestId("password-shown")).toHaveTextContent(pw);
    await fireEvent.press(screen.getByTestId("password-done"));
    await fireEvent.press(screen.getByTestId("toggle-sam@rasoipulse.test"));
    await waitFor(() => expect(s.to("PATCH", "/api/platform/team/m1")[1]?.body).toEqual({ isActive: false }));
  });

  it("removing a person asks first", async () => {
    const s = server();
    s.set("DELETE /api/platform/team/m2", { status: 204 });
    await renderApp(<Team />, { server: s });
    await fireEvent.press(await screen.findByTestId("remove-old@rasoipulse.test"));
    expect(s.to("DELETE", "/api/platform/team/m2")).toHaveLength(0);
    await fireEvent.press(await screen.findByTestId("confirm-yes"));
    await waitFor(() => expect(s.to("DELETE", "/api/platform/team/m2")).toHaveLength(1));
  });

  it("the Roles tab shows each role's features; a role someone holds can't be deleted", async () => {
    await renderApp(<Team />, { server: server() });
    await fireEvent.press(await screen.findByTestId("team-tab-roles"));
    const sales = await screen.findByTestId("role-Sales");
    expect(within(sales).getByText("Onboarding")).toBeOnTheScreen();
    expect(screen.getByTestId("delete-role-Sales")).toBeDisabled();
    expect(screen.getByTestId("delete-role-Support")).toBeEnabled();
    expect(within(sales).getByText(/1 person has this role/)).toBeOnTheScreen();
  });

  it("makes a role from switches, grouped, each with its line", async () => {
    const s = server();
    s.set("POST /api/platform/roles", { status: 201, json: { role: ROLES.roles[0] } });
    await renderApp(<Team />, { server: s });
    await fireEvent.press(await screen.findByTestId("team-tab-roles"));
    await fireEvent.press(await screen.findByTestId("new-role"));
    expect(await screen.findByText("Change a store.")).toBeOnTheScreen();
    expect(within(screen.getByTestId("role-sheet")).queryByText(/^Team & roles$/)).toBeNull();
    expect(screen.getByTestId("role-save")).toBeDisabled();
    await fireEvent.changeText(screen.getByTestId("role-name"), "Closer");
    await fireEvent(screen.getByTestId("feature-onboarding:manage"), "valueChange", true);
    await fireEvent(screen.getByTestId("feature-stores:read"), "valueChange", true);
    await fireEvent.press(screen.getByTestId("role-save"));
    await waitFor(() => expect(s.to("POST", "/api/platform/roles")[0]?.body).toEqual({ name: "Closer", description: "", features: ["onboarding:manage", "stores:read"] }));
  });

  it("edits a role: the features it has are already on", async () => {
    const s = server();
    s.set("PATCH /api/platform/roles/r2", { json: { role: ROLES.roles[1] } });
    await renderApp(<Team />, { server: s });
    await fireEvent.press(await screen.findByTestId("team-tab-roles"));
    await fireEvent.press(await screen.findByTestId("edit-role-Support"));
    expect((await screen.findByTestId("feature-stores:read")).props.value).toBe(true);
    expect(screen.getByTestId("feature-onboarding:manage").props.value).toBe(false);
    await fireEvent(screen.getByTestId("feature-stores:manage"), "valueChange", true);
    await fireEvent.press(screen.getByTestId("role-save"));
    await waitFor(() => expect(s.to("PATCH", "/api/platform/roles/r2")[0]?.body.features).toEqual(["stores:read", "stores:manage"]));
  });

  it("the Activity tab says who did what", async () => {
    await renderApp(<Team />, { server: server() });
    await fireEvent.press(await screen.findByTestId("team-tab-activity"));
    expect(await screen.findByText("Platform Owner changed the role Sales")).toBeOnTheScreen();
    expect(screen.getByText(/added: leads:manage/)).toBeOnTheScreen();
  });

  it("only the owner gets this screen: a team member who opens it is told their role doesn't include it", async () => {
    await renderApp(<AreaScreen id="team" />, { signedInAs: SALES });
    expect(await screen.findByTestId("no-access")).toBeOnTheScreen();
    expect(screen.queryByTestId("screen-team")).toBeNull();
  });
});
