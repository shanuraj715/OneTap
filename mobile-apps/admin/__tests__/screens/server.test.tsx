import { screen, within } from "@testing-library/react-native";
import { Server } from "@/screens/Server";
import { fakeServer, renderApp } from "../../test/harness";

const GB = 1024 ** 3;
const part = (o: Record<string, unknown>) => ({ id: "cpu", label: "CPU", score: 9, boxes: 9, level: "good", value: "12%", detail: "Plenty of room.", reason: null, ...o });
const snap = (o: Record<string, unknown> = {}) => ({
  at: Date.now(), ready: true,
  machine: { hostname: "rp-prod-1", osName: "Ubuntu 24.04", cpuModel: "AMD EPYC", cores: 4, arch: "x64", uptimeSec: 3 * 86400 + 4 * 3600 },
  cpu: { used: 12, user: 8, system: 4, load: [0.4, 0.5, 0.6], loadPerCore: 0.1, cores: 4 },
  memory: { totalB: 8 * GB, usedB: 3 * GB, availableB: 5 * GB, usedPct: 37.5, swapTotalB: 2 * GB, swapUsedB: 0, swapUsedPct: 0 },
  disk: { mounts: [{ mount: "/", sizeB: 100 * GB, usedB: 95 * GB, availB: 5 * GB, usedPct: 95, availPct: 5 }] },
  network: { rxBps: 2048, txBps: 1024, rxTotalB: 5 * GB, txTotalB: GB, errors: 0 },
  api: { uptimeSec: 7200, rssB: 150 * 1024 ** 2, db: { ok: true, ms: 4 }, cache: { entries: 10, hitRate: 0.9, bytes: 1000 }, requests: { last5min: { requests: 300, errorPct: 0, perMinute: 60, p95Ms: 40 }, lastHour: { requests: 3000, errorPct: 0 } } },
  health: { ready: true, score: 8.4, boxes: 8, level: "good", label: "Healthy", parts: [part({}), part({ id: "disk", label: "Disk space", score: 2, boxes: 2, level: "critical", value: "5% free", reason: "The disk is almost full." })], reasons: [] },
  ...o,
});
const open = (s = snap()) => renderApp(<Server />, { server: fakeServer({ "GET /api/platform/server": { json: s } }) });

describe("the server screen", () => {
  it("shows the machine, a word for the health, and as many lit boxes as the score says", async () => {
    await open();
    expect(await screen.findByTestId("server-health-label")).toHaveTextContent("Healthy");
    expect(screen.getByText(/rp-prod-1 · up 3 d 4 h/)).toBeOnTheScreen();
    expect(screen.getByTestId("server-boxes").props.accessibilityLabel).toBe("8 of 10");
    expect(screen.getByText("Nothing needs attention.")).toBeOnTheScreen();
  });

  it("when something is wrong it says what, in words, and the part shows its own reason", async () => {
    await open(snap({ health: { ready: true, score: 3.9, boxes: 3, level: "critical", label: "Trouble", parts: [part({ id: "disk", label: "Disk space", score: 2, boxes: 2, level: "critical", value: "5% free", reason: "The disk is almost full." })], reasons: [{ id: "disk", label: "Disk space", level: "critical", text: "The disk is almost full." }] } }));
    expect(await screen.findByTestId("server-health-label")).toHaveTextContent("Trouble");
    expect(within(screen.getByTestId("server-reasons")).getByText(/almost full/)).toBeOnTheScreen();
    expect(within(screen.getByTestId("part-disk")).getByText("5% free")).toBeOnTheScreen();
  });

  it("shows processor, memory, each disk and the network with real units", async () => {
    await open();
    await screen.findByTestId("server-cpu");
    expect(within(screen.getByTestId("server-cpu")).getByText("12%")).toBeOnTheScreen();
    expect(within(screen.getByTestId("server-memory")).getByText(/3.0 GB of 8.0 GB used/)).toBeOnTheScreen();
    expect(within(screen.getByTestId("server-disk-/")).getByText("95%")).toBeOnTheScreen();
    expect(within(screen.getByTestId("server-network")).getByText(/2 KB\/s/)).toBeOnTheScreen();
  });

  it("the database being down is shown plainly", async () => {
    const s = snap();
    await open(snap({ api: { ...s.api, db: { ok: false, ms: null, error: "not connected" } } }));
    expect(await screen.findByText("Down")).toBeOnTheScreen();
  });

  it("before the first reading it says it is measuring instead of showing a score", async () => {
    await open(snap({ ready: false, health: { ready: false, score: null, boxes: 0, level: null, label: "Measuring…", parts: [], reasons: [] } }));
    expect(await screen.findByTestId("server-health-label")).toHaveTextContent("Measuring…");
    expect(screen.queryByTestId("server-boxes")).toBeNull();
  });
});
