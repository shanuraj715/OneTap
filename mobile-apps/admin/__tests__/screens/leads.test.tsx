import { Linking } from "react-native";
import { fireEvent, screen, waitFor, within } from "@testing-library/react-native";
import { Leads, whatsappNumber } from "@/screens/Leads";
import { fakeServer, renderApp } from "../../test/harness";

const lead = (o: Record<string, unknown>) => ({ id: "l1", name: "Ravi Kumar", phone: "98765 43210", email: "ravi@curry.test", businessName: "Curry House", city: "Ludhiana", outlets: "3", plan: "Pro", message: "Please call after 5 pm.", sourcePage: "/pricing", utm: {}, status: "new", notes: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...o });
const LIST = { leads: [lead({}), lead({ id: "l2", name: "Meena Shah", phone: "9000000001", email: "", businessName: "", city: "", outlets: "", plan: "", status: "contacted", message: "", notes: [{ text: "Called, demo on Friday", by: "Sam Sales", at: new Date().toISOString() }] })], counts: { new: 1, contacted: 1, won: 0, lost: 0 } };

const open = (extra: Record<string, any> = {}) => renderApp(<Leads />, { server: fakeServer({ "GET /api/platform/site/leads": (c) => ({ json: c.query.includes("status=contacted") ? { leads: [LIST.leads[1]], counts: LIST.counts } : LIST }), "PATCH /api/platform/site/leads/:id": { json: { lead: lead({}) } }, ...extra }) });

describe("the leads screen", () => {
  afterEach(() => jest.restoreAllMocks());

  it("lists the enquiries with who, where, how many outlets and where each stands, and counts per status", async () => {
    await open();
    const row = within(await screen.findByTestId("lead-98765 43210"));
    expect(row.getByText("Ravi Kumar · Curry House")).toBeOnTheScreen();
    expect(row.getByText(/Ludhiana · 3 outlets · asked about Pro/)).toBeOnTheScreen();
    expect(row.getByText("New")).toBeOnTheScreen();
    expect(within(screen.getByTestId("lead-9000000001")).getByText("Contacted")).toBeOnTheScreen();
    expect(within(screen.getByTestId("leads-filter-contacted")).getByText("1")).toBeOnTheScreen();
  });

  it("a status chip asks the server for just those", async () => {
    const { server } = await open();
    await screen.findByTestId("lead-98765 43210");
    await fireEvent.press(screen.getByTestId("leads-filter-contacted"));
    await waitFor(() => expect(screen.queryByTestId("lead-98765 43210")).toBeNull());
    expect(server.to("GET", "/api/platform/site/leads").some((c) => c.query.includes("status=contacted"))).toBe(true);
  });

  it("opening one shows the message, and Call / WhatsApp / Email open the phone's own apps (10-digit numbers get 91)", async () => {
    const opened = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
    await open();
    await fireEvent.press(await screen.findByTestId("lead-98765 43210"));
    expect(await screen.findByTestId("lead-message")).toHaveTextContent("Please call after 5 pm.");
    await fireEvent.press(screen.getByTestId("lead-call"));
    await fireEvent.press(screen.getByTestId("lead-whatsapp"));
    await fireEvent.press(screen.getByTestId("lead-email"));
    expect(opened.mock.calls.map((c) => c[0])).toEqual(["tel:9876543210", "https://wa.me/919876543210", "mailto:ravi@curry.test"]);
  });

  it("a lead with no email has no Email button", async () => {
    await open();
    await fireEvent.press(await screen.findByTestId("lead-9000000001"));
    await screen.findByTestId("lead-call");
    expect(screen.queryByTestId("lead-email")).toBeNull();
    expect(screen.getByText("Called, demo on Friday")).toBeOnTheScreen();
  });

  it("marking it contacted, and adding a note, send exactly that", async () => {
    const { server } = await open();
    await fireEvent.press(await screen.findByTestId("lead-98765 43210"));
    await fireEvent.press(await screen.findByTestId("lead-status-contacted"));
    await waitFor(() => expect(server.to("PATCH", "/api/platform/site/leads/l1")).toHaveLength(1));
    expect(server.to("PATCH", "/api/platform/site/leads/l1")[0]!.body).toEqual({ status: "contacted" });
    expect(screen.getByTestId("lead-add-note")).toBeDisabled();
    await fireEvent.changeText(screen.getByTestId("lead-note"), "Demo on Friday");
    await fireEvent.press(screen.getByTestId("lead-add-note"));
    await waitFor(() => expect(server.to("PATCH", "/api/platform/site/leads/l1")).toHaveLength(2));
    expect(server.to("PATCH", "/api/platform/site/leads/l1")[1]!.body).toEqual({ note: "Demo on Friday" });
    await waitFor(() => expect(screen.getByTestId("lead-note").props.value).toBe(""));
  });

  it("no enquiries yet says so", async () => {
    await open({ "GET /api/platform/site/leads": { json: { leads: [], counts: { new: 0, contacted: 0, won: 0, lost: 0 } } } });
    expect(await screen.findByText("No enquiries yet")).toBeOnTheScreen();
  });

  it("whatsappNumber: 10 digits get the country code, anything else stays as typed (digits only)", () => {
    expect(whatsappNumber("98765 43210")).toBe("919876543210");
    expect(whatsappNumber("+44 7700 900123")).toBe("447700900123");
    expect(whatsappNumber("")).toBe("");
  });
});
