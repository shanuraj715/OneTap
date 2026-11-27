import { act, fireEvent, screen, waitFor, within } from "@testing-library/react-native";
import { Reports, buildExportRequest } from "@/screens/Reports";
import { safeFileName } from "@/lib/files";
import { usePnlPlan } from "@/data/pnlPlan";
import { useReportHistory } from "@/data/reportHistory";
import { renderApp } from "../../test/harness";
import { freshScope, options, reportsServer } from "../../test/data";

const sharing = jest.requireMock("expo-sharing") as { isAvailableAsync: jest.Mock; shareAsync: jest.Mock };
const written = (jest.requireMock("expo-file-system") as { __written: Map<string, Uint8Array | string> }).__written;

const XLSX = { bytes: Uint8Array.from([0x50, 0x4b, 3, 4, 1, 2, 3]), headers: { "content-disposition": 'attachment; filename="rasoipulse-acme-2026-10-30_to_2026-11-28.xlsx"', "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" } };
const withExport = (extra: Parameters<typeof reportsServer>[0] = {}) => reportsServer({ "POST /api/analytics/export": XLSX, ...extra });

beforeEach(() => {
  freshScope(); usePnlPlan.getState().reset(); useReportHistory.getState().reset(); written.clear();
  sharing.isAvailableAsync.mockResolvedValue(true); sharing.shareAsync.mockClear();
});

const scope = { period: "custom" as const, custom: { from: "2026-10-01", to: "2026-10-31" }, outlets: ["o2"] };
const base = { format: "xlsx" as const, scope, sections: ["summary", "daily"], csvSection: "daily", foodCostPct: 35, mode: "recorded" as const, lines: [{ label: "Rent", monthly: 30_000 }] };

describe("buildExportRequest", () => {
  it("asks for the chosen dates, outlets, format and sections", () => {
    expect(buildExportRequest(base)).toEqual({ format: "xlsx", from: "2026-10-01", to: "2026-10-31", outletIds: ["o2"], sections: ["summary", "daily"], section: "daily", pnl: null });
  });
  it("sends the profit inputs only when the profit and loss section is in the file", () => {
    expect(buildExportRequest({ ...base, sections: ["summary"] }).pnl).toBeNull();
    expect(buildExportRequest({ ...base, sections: ["summary", "pnl"] }).pnl).toEqual({ foodCostPct: 35, mode: "recorded", expenses: [] });
    expect(buildExportRequest({ ...base, sections: ["pnl"], mode: "monthly" }).pnl).toEqual({ foodCostPct: 35, mode: "monthly", expenses: [{ label: "Rent", monthly: 30_000 }] });
  });
  it("a CSV names its one table in `section` and sends no section list", () => {
    const r = buildExportRequest({ ...base, format: "csv", csvSection: "items", sections: ["summary", "daily"] });
    expect(r).toMatchObject({ format: "csv", section: "items", sections: [], pnl: null });
    expect(buildExportRequest({ ...base, format: "csv", csvSection: "pnl" }).pnl).not.toBeNull();
  });
  it("no outlet chosen means every outlet", () => {
    expect(buildExportRequest({ ...base, scope: { ...scope, outlets: [] } }).outletIds).toEqual([]);
  });
});

describe("safeFileName", () => {
  it("keeps letters, digits, dot, dash and underscore only, and never starts with a dot", () => {
    expect(safeFileName("rasoipulse-acme-2026-10-30_to_2026-11-28.xlsx")).toBe("rasoipulse-acme-2026-10-30_to_2026-11-28.xlsx");
    expect(safeFileName("../../etc/passwd")).not.toMatch(/\.\.|\//);
    expect(safeFileName("my report (final).pdf")).toBe("my_report_final_.pdf");
    expect(safeFileName("")).toBe("report");
    expect(safeFileName(".hidden")).toBe("hidden");
  });
});

/** The Download button is off until the store's options are known, so wait for the sections to show before pressing it. */
const download = async () => { await screen.findByTestId("report-section-summary"); await fireEvent.press(screen.getByTestId("report-make")); };

describe("Reports", () => {
  it("offers the four file kinds with a plain line about each, Excel first", async () => {
    await renderApp(<Reports />, { server: withExport() });
    expect(await screen.findByTestId("report-format-xlsx")).toBeOnTheScreen();
    for (const f of ["xlsx", "csv", "pdf", "json"]) expect(screen.getByTestId(`report-format-${f}`)).toBeOnTheScreen();
    expect(screen.getByTestId("report-format-help")).toHaveTextContent("Every section as its own sheet.");
    await fireEvent.press(screen.getByTestId("report-format-pdf"));
    expect(screen.getByTestId("report-format-help")).toHaveTextContent("A printable summary report.");
    expect(screen.getByText("Download PDF")).toBeOnTheScreen();
  });

  it("starts with the usual sections ticked and the rest left out", async () => {
    await renderApp(<Reports />, { server: withExport() });
    await screen.findByTestId("report-section-summary");
    const on = (id: string) => screen.getByTestId(`report-section-${id}`).props.accessibilityState.checked;
    expect(on("summary")).toBe(true); expect(on("daily")).toBe(true); expect(on("items")).toBe(true); expect(on("gst")).toBe(true);
    expect(on("pnl")).toBe(false); expect(on("coupons")).toBe(false);
  });

  it("All and None change every section, and with none the Download button is off", async () => {
    await renderApp(<Reports />, { server: withExport() });
    await fireEvent.press(await screen.findByTestId("report-none"));
    expect(screen.getByTestId("report-make")).toBeDisabled();
    expect(screen.getByTestId("report-section-daily").props.accessibilityState.checked).toBe(false);
    await fireEvent.press(screen.getByTestId("report-all"));
    expect(screen.getByTestId("report-section-pnl").props.accessibilityState.checked).toBe(true);
    expect(screen.getByTestId("report-make")).toBeEnabled();
  });

  it("someone who may not see the money gets no money sections", async () => {
    await renderApp(<Reports />, { server: withExport({ "GET /api/analytics/options": { json: options({ canFinance: false, sections: options().sections.filter((s) => true) }) } }) });
    await screen.findByTestId("report-section-summary");
    expect(screen.queryByTestId("report-section-pnl")).toBeNull();
    expect(screen.queryByTestId("report-section-expenses")).toBeNull();
    expect(screen.getByText(/your role doesn't include them/)).toBeOnTheScreen();
  });

  it("a CSV asks for one table", async () => {
    await renderApp(<Reports />, { server: withExport() });
    await fireEvent.press(await screen.findByTestId("report-format-csv"));
    expect(await screen.findByTestId("report-csv-daily")).toBeOnTheScreen();
    expect(screen.queryByTestId("report-section-summary")).toBeNull();
  });

  describe("downloading", () => {
    it("asks the server, keeps the file on the phone under the server's name, and opens the share sheet", async () => {
      const server = withExport();
      await renderApp(<Reports />, { server });
      await download();
      await waitFor(() => expect(sharing.shareAsync).toHaveBeenCalledTimes(1));
      const sent = server.to("POST", "/api/analytics/export")[0]!.body;
      expect(sent).toMatchObject({ format: "xlsx", sections: ["summary", "daily", "items", "channels", "payments", "gst"].filter((id) => ["summary", "daily", "items", "gst"].includes(id)), outletIds: [] });
      expect(sent.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const [uri, shareOptions] = sharing.shareAsync.mock.calls[0]!;
      expect(uri).toMatch(/documents\/\d+-rasoipulse-acme-2026-10-30_to_2026-11-28\.xlsx$/);
      expect(shareOptions.mimeType).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      expect(Array.from(written.get(uri) as Uint8Array)).toEqual(Array.from(XLSX.bytes)); // the very bytes the server sent
      expect(await screen.findByText("Report ready.")).toBeOnTheScreen();
    });

    it("lists it under Recent reports, and remembers it on the phone", async () => {
      await renderApp(<Reports />, { server: withExport() });
      await download();
      await waitFor(() => expect(useReportHistory.getState().items).toHaveLength(1));
      const item = useReportHistory.getState().items[0]!;
      expect(item).toMatchObject({ name: "rasoipulse-acme-2026-10-30_to_2026-11-28.xlsx", format: "xlsx", size: 7 });
      expect(await screen.findByTestId(`report-${item.id}`)).toHaveTextContent(/rasoipulse-acme/);
      expect(await jest.requireMock("@react-native-async-storage/async-storage").getItem("business.reports")).toContain("rasoipulse-acme");
    });

    it("a PDF is asked for as a PDF, with the money sections only when chosen", async () => {
      const server = withExport({ "POST /api/analytics/export": { bytes: Uint8Array.from([0x25, 0x50, 0x44, 0x46]), headers: { "content-disposition": 'attachment; filename="report.pdf"', "content-type": "application/pdf" } } });
      await renderApp(<Reports />, { server });
      await fireEvent.press(await screen.findByTestId("report-format-pdf"));
      await fireEvent.press(await screen.findByTestId("report-section-pnl"));
      await fireEvent.press(screen.getByTestId("report-make"));
      await waitFor(() => expect(server.to("POST", "/api/analytics/export")).toHaveLength(1));
      const sent = server.to("POST", "/api/analytics/export")[0]!.body;
      expect(sent.format).toBe("pdf");
      expect(sent.sections).toContain("pnl");
      expect(sent.pnl).toEqual({ foodCostPct: 35, mode: "recorded", expenses: [] });
      await waitFor(() => expect(sharing.shareAsync).toHaveBeenCalled());
      expect(sharing.shareAsync.mock.calls[0]![1].mimeType).toBe("application/pdf");
    });

    it("a refusal from the server is said in its words and nothing is saved", async () => {
      await renderApp(<Reports />, { server: withExport({ "POST /api/analytics/export": { status: 403, json: { error: "Your role can't download reports." } } }) });
      await download();
      expect(await screen.findByText("Your role can't do this.")).toBeOnTheScreen();
      expect(written.size).toBe(0);
      expect(sharing.shareAsync).not.toHaveBeenCalled();
      expect(useReportHistory.getState().items).toHaveLength(0);
    });

    it("a phone with no share sheet still keeps the file and says where it is", async () => {
      sharing.isAvailableAsync.mockResolvedValue(false);
      await renderApp(<Reports />, { server: withExport() });
      await download();
      expect(await screen.findByText(/This phone can't open a share sheet/)).toBeOnTheScreen();
      expect(useReportHistory.getState().items).toHaveLength(1);
    });
  });

  describe("recent reports", () => {
    const make = async () => { await renderApp(<Reports />, { server: withExport() }); await download(); await waitFor(() => expect(useReportHistory.getState().items).toHaveLength(1)); return useReportHistory.getState().items[0]!; };

    it("one can be sent again without asking the server", async () => {
      const item = await make();
      sharing.shareAsync.mockClear();
      await fireEvent.press(await screen.findByTestId(`report-share-${item.id}`));
      await waitFor(() => expect(sharing.shareAsync).toHaveBeenCalledWith(item.uri, expect.objectContaining({ mimeType: item.mime })));
    });
    it("one can be removed: it leaves the list and its file is deleted", async () => {
      const item = await make();
      expect(written.has(item.uri)).toBe(true);
      await fireEvent.press(await screen.findByTestId(`report-remove-${item.id}`));
      expect(useReportHistory.getState().items).toHaveLength(0);
      expect(written.has(item.uri)).toBe(false);
      expect(await screen.findByText("No reports yet")).toBeOnTheScreen();
    });
    it("only the last 15 are kept; older ones are pushed out and their files go", () => {
      const add = (i: number) => useReportHistory.getState().add({ id: `r${i}`, name: `r${i}.xlsx`, uri: `file:///documents/r${i}`, mime: "x", format: "xlsx", period: "p", at: "2026-11-28T00:00:00Z", size: 1 });
      for (let i = 1; i <= 15; i++) add(i);
      expect(add(16).map((r) => r.id)).toEqual(["r1"]);
      expect(useReportHistory.getState().items).toHaveLength(15);
      expect(useReportHistory.getState().items[0]!.id).toBe("r16");
    });
    it("they come back after the app is closed and opened again", async () => {
      await make();
      useReportHistory.setState({ items: [], hydrated: false });
      await act(async () => { await useReportHistory.getState().hydrate(); });
      expect(useReportHistory.getState().items).toHaveLength(1);
    });
  });

  it("the Download button is off until the options are known", async () => {
    await renderApp(<Reports />, { server: withExport({ "GET /api/analytics/options": { status: 500, json: { error: "x" } } }) });
    await screen.findByText("Recent reports");
    expect(within(screen.getByTestId("report-make")).getByText(/Download/)).toBeOnTheScreen();
    expect(screen.getByTestId("report-make")).toBeDisabled();
  });
});
