import { act, fireEvent, screen, waitFor, within } from "@testing-library/react-native";
import { TableDetail } from "@/screens/TableDetail";
import { parseOpenAreas } from "@/prefs/areas";
import { TablesScreen } from "@/screens/TablesScreen";
import { keyboardOverlap } from "@/ui";
import { toasts } from "@/ui";
import { areasKey, fakeServer, fx, memoryPrefs, prefsWithOpenAreas, renderApp } from "../../test/harness";

const board = fx("tables-seated").tables as Array<{ id: string; number: string; zone: string; seats: number; status: string }>;
const idOf = (n: string) => board.find((t) => t.number === n)!.id;
const isOpen = (el: { props: { accessibilityState?: { expanded?: boolean } } }) => el.props.accessibilityState?.expanded === true;
/** a floor of `n` tables across three areas */
const floor = (n: number) => ({ tables: Array.from({ length: n }, (_, i) => ({ id: `id${i}`, number: `T${i + 1}`, zone: ["Ground floor", "First floor", "Terrace"][i % 3]!, seats: 2 + (i % 4), status: i % 5 === 0 ? "seated" : "free", isActive: true, activeSessionId: null })) });

beforeEach(() => toasts.clear());

describe("tables under their area: closed to start with, and what a waiter opens is remembered", () => {
  const board_ = () => <TablesScreen onOpenTable={() => undefined} />;

  it("a FIRST run: every area is closed — even on a small floor — each showing its name and what is happening inside", async () => {
    await renderApp(board_());
    const ground = await screen.findByTestId("zone-header-Ground floor");
    expect(isOpen(ground)).toBe(false);
    expect(isOpen(screen.getByTestId("zone-header-Terrace"))).toBe(false);
    expect(screen.queryByTestId("table-T1")).toBeNull(); // no table is drawn
    // T1 (seated) and T2 (free) are in the Ground floor; the order of areas is A–Z
    expect(screen.getByLabelText(/^Ground floor, 2 tables: 1 free, 1 seated/)).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Terrace, 1 table: 1 free, 0 seated/)).toBeOnTheScreen();
  });

  it("a tap opens an area (only that one); another tap closes it again", async () => {
    await renderApp(board_());
    await fireEvent.press(await screen.findByTestId("zone-header-Ground floor"));
    expect(isOpen(screen.getByTestId("zone-header-Ground floor"))).toBe(true);
    expect(screen.getByTestId("table-T1")).toBeOnTheScreen();
    expect(screen.queryByTestId("table-T3")).toBeNull(); // Terrace is still closed
    await fireEvent.press(screen.getByTestId("zone-header-Ground floor"));
    expect(screen.queryByTestId("table-T1")).toBeNull();
    expect(screen.getByLabelText(/^Ground floor, 2 tables: 1 free, 1 seated/)).toBeOnTheScreen(); // the numbers stay
  });

  it("what was opened is REMEMBERED: next time the app opens, that area is open already and the others are still closed", async () => {
    const first = await renderApp(board_());
    await fireEvent.press(await screen.findByTestId("zone-header-Ground floor"));
    await waitFor(() => expect(first.prefs.set).toHaveBeenCalled());
    expect(JSON.parse(first.prefs.data.get(areasKey())!)).toEqual({ v: 1, open: ["Ground floor"] });
    await first.unmount();
    // the app is opened again (a new run of it) with what was kept on the phone
    await renderApp(board_(), { prefs: first.prefs });
    expect(isOpen(await screen.findByTestId("zone-header-Ground floor"))).toBe(true);
    expect(screen.getByTestId("table-T1")).toBeOnTheScreen(); // no tap needed
    expect(isOpen(screen.getByTestId("zone-header-Terrace"))).toBe(false);
  });

  it("closing one is remembered too, and a waiter who works one area keeps just that one open", async () => {
    const prefs = prefsWithOpenAreas("Ground floor", "Terrace");
    const run = await renderApp(board_(), { prefs });
    await fireEvent.press(await screen.findByTestId("zone-header-Terrace")); // close it
    await waitFor(() => expect(JSON.parse(prefs.data.get(areasKey())!).open).toEqual(["Ground floor"]));
    await run.unmount();
    await renderApp(board_(), { prefs });
    expect(isOpen(await screen.findByTestId("zone-header-Ground floor"))).toBe(true);
    expect(isOpen(screen.getByTestId("zone-header-Terrace"))).toBe(false);
  });

  it("the choice belongs to this PERSON and this outlet: what another account opened does not apply", async () => {
    const prefs = memoryPrefs({ "oma.areas.v1:someone-else:another-outlet": JSON.stringify({ v: 1, open: ["Ground floor", "Terrace"] }) });
    await renderApp(board_(), { prefs });
    expect(isOpen(await screen.findByTestId("zone-header-Ground floor"))).toBe(false);
  });

  it("the board waits for the saved choices before drawing, so areas never flash open and then shut", async () => {
    let release: (v: string | null) => void = () => undefined;
    const prefs = prefsWithOpenAreas("Ground floor");
    (prefs.get as jest.Mock).mockImplementation(() => new Promise<string | null>((r) => { release = r; }));
    await renderApp(board_(), { prefs });
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(screen.queryByTestId("zone-header-Ground floor")).toBeNull(); // still waiting: skeletons, no area drawn
    await act(async () => { release(JSON.stringify({ v: 1, open: ["Ground floor"] })); });
    expect(isOpen(await screen.findByTestId("zone-header-Ground floor"))).toBe(true);
  });

  it("a search or filter shows what it found, open — and leaves what is remembered alone", async () => {
    const run = await renderApp(board_());
    await screen.findByTestId("zone-header-Ground floor");
    await fireEvent.press(screen.getByTestId("filter-free"));
    expect(isOpen(screen.getByTestId("zone-header-Ground floor"))).toBe(true);
    expect(screen.getByTestId("table-T2")).toBeOnTheScreen();
    expect(run.prefs.set).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId("filter-free")); // filter off
    expect(isOpen(screen.getByTestId("zone-header-Ground floor"))).toBe(false); // back to what was remembered (nothing)
  });

  it("areas that no longer exist are dropped from what is remembered", async () => {
    const prefs = prefsWithOpenAreas("Ground floor", "Old basement");
    await renderApp(board_(), { prefs });
    await fireEvent.press(await screen.findByTestId("zone-header-Terrace"));
    await waitFor(() => expect(JSON.parse(prefs.data.get(areasKey())!).open).toEqual(["Ground floor", "Terrace"]));
  });

  it("damaged saved data is ignored: every area closed, nothing breaks", async () => {
    for (const bad of ["not json {{", "null", "[]", JSON.stringify({ open: "Ground floor" }), JSON.stringify({ open: [1, null, {}] })]) {
      const run = await renderApp(board_(), { prefs: memoryPrefs({ [areasKey()]: bad }) });
      expect(isOpen(await screen.findByTestId("zone-header-Ground floor"))).toBe(false);
      await run.unmount();
    }
  });

  it("parseOpenAreas keeps only sensible names, once each", () => {
    expect(parseOpenAreas(JSON.stringify({ open: ["A", "A", "B", "", 5, "x".repeat(300)] }))).toEqual(["A", "B"]);
    expect(parseOpenAreas(null)).toEqual([]);
    expect(parseOpenAreas("")).toEqual([]);
  });

  it("signing out does not forget it: the same person signing in again gets their areas back", async () => {
    const prefs = prefsWithOpenAreas("Terrace");
    const run = await renderApp(board_(), { prefs });
    expect(isOpen(await screen.findByTestId("zone-header-Terrace"))).toBe(true);
    await act(async () => { await run.runtime.session.getState().signOut(); });
    expect(prefs.data.get(areasKey())).toBeDefined();
  });

  it("a floor with several areas: the summary of a closed area counts free, seated and bill-asking tables", async () => {
    await renderApp(board_(), { server: fakeServer({ "GET /api/tables": { json: floor(15) } }) });
    expect(await screen.findByLabelText(/^First floor, 5 tables: /)).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Terrace, 5 tables: /)).toBeOnTheScreen();
  });

  it("a table with no area is listed last, under 'Other tables'", async () => {
    const t = floor(3); t.tables[1]!.zone = "";
    await renderApp(board_(), { server: fakeServer({ "GET /api/tables": { json: t } }) });
    expect(await screen.findByTestId("zone-header-Other tables")).toBeOnTheScreen();
  });
});

describe("moving a party: tables as 'Table T2 · 4 seats', grouped by area", () => {
  const T1 = idOf("T1");
  const openMove = async (server = fakeServer(), prefs = prefsWithOpenAreas("Terrace")) => {
    await renderApp(<TableDetail tableId={T1} onTakeOrder={() => undefined} />, { server, prefs });
    await fireEvent.press(await screen.findByTestId("move-table"));
    await screen.findByTestId("move-to-T2");
    return server;
  };

  it("each free table is a tile with 'Table', its number and its seats WRITTEN OUT — never a bare '2 4'", async () => {
    await openMove();
    const t2 = within(screen.getByTestId("move-to-T2"));
    expect(t2.getByText("Table")).toBeOnTheScreen();
    expect(t2.getByText("T2")).toBeOnTheScreen();
    expect(t2.getByText("2 seats")).toBeOnTheScreen();
    expect(within(screen.getByTestId("move-to-T3")).getByText("6 seats")).toBeOnTheScreen();
    expect(screen.getByLabelText("Table T3, 6 seats, Terrace")).toBeOnTheScreen();
  });

  it("the tiles sit under their area, and the table the party is on is not offered", async () => {
    await openMove();
    expect(within(screen.getByTestId("move-zone-Ground floor")).getByTestId("move-to-T2")).toBeOnTheScreen();
    expect(within(screen.getByTestId("move-zone-Terrace")).getByTestId("move-to-T3")).toBeOnTheScreen();
    expect(screen.queryByTestId("move-to-T1")).toBeNull();
    expect(screen.getByLabelText("Ground floor, 1 free")).toBeOnTheScreen();
  });

  it("says who is being moved and from where", async () => {
    await openMove();
    expect(screen.getAllByText("Mehta family").length).toBeGreaterThan(1); // on the page, and again at the top of the pop-up
    expect(screen.getByText(/Now at Table T1 · Ground floor/)).toBeOnTheScreen();
  });

  it("the chosen tile is marked, and the button says exactly where they go", async () => {
    const server = await openMove();
    expect(screen.getByTestId("move-confirm")).toBeDisabled();
    await fireEvent.press(screen.getByTestId("move-to-T3"));
    expect(screen.getByTestId("move-to-T3")).toBeSelected();
    expect(screen.getByTestId("move-to-T2")).not.toBeSelected();
    await fireEvent.press(screen.getByRole("button", { name: "Move to Table T3" }));
    await waitFor(() => expect(server.to("POST", /\/move$/)).toHaveLength(1));
    expect(server.to("POST", /\/move$/)[0]!.body).toEqual({ toTableId: idOf("T3") });
  });

  it("the area the party is in is open; the others follow what the waiter keeps open on the board; taps here are only for this pop-up", async () => {
    const prefs = memoryPrefs(); // nothing kept open on the board
    await openMove(fakeServer(), prefs);
    expect(isOpen(screen.getByTestId("move-zone-toggle-Ground floor"))).toBe(true); // the party's own area
    expect(isOpen(screen.getByTestId("move-zone-toggle-Terrace"))).toBe(false);
    expect(screen.queryByTestId("move-to-T3")).toBeNull();
    await fireEvent.press(screen.getByTestId("move-zone-toggle-Terrace"));
    expect(screen.getByTestId("move-to-T3")).toBeOnTheScreen();
    expect(prefs.set).not.toHaveBeenCalled(); // the board's remembered areas are untouched
    await fireEvent.press(screen.getByTestId("move-to-T3"));
    await fireEvent.press(screen.getByTestId("move-zone-toggle-Terrace"));
    expect(isOpen(screen.getByTestId("move-zone-toggle-Terrace"))).toBe(true); // the chosen table's area can't be closed on it
  });

  it("no free table: says so", async () => {
    const full = fx("tables-seated"); full.tables.forEach((t: { status: string; activeSessionId: string | null }) => { t.status = "seated"; t.activeSessionId = "x"; });
    await renderApp(<TableDetail tableId={T1} onTakeOrder={() => undefined} />, { server: fakeServer({ "GET /api/tables": { json: full } }) });
    await fireEvent.press(await screen.findByTestId("move-table"));
    expect(await screen.findByText("There is no free table to move to right now.")).toBeOnTheScreen();
  });
});

describe("the pop-up and the keyboard", () => {
  it("how much of a panel is under the keyboard (a few pixels of rounding don't count)", () => {
    expect(keyboardOverlap(1000, 600, 1400)).toBe(200); // bottom at 1600, keyboard top at 1400
    expect(keyboardOverlap(700, 700, 1400)).toBe(0); // bottom exactly at the keyboard
    expect(keyboardOverlap(700, 703, 1400)).toBe(0); // 3 px: rounding
    expect(keyboardOverlap(700, 600, 1400)).toBe(0); // clear of it
    expect(keyboardOverlap(1000, 405, 1400)).toBe(5);
  });
});
