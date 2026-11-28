import { Text } from "react-native";
import { screen, waitFor } from "@testing-library/react-native";
import { useOptions, useOutlets } from "@/data/queries";
import { useScope } from "@/data/scope";
import { Async } from "@/ui";
import { renderApp } from "../test/harness";
import { reportsServer } from "../test/data";

const q = (over: Partial<Parameters<typeof Async>[0]["q"]>) => ({ isLoading: false, isError: false, error: null, data: undefined, refetch: jest.fn(), ...over }) as Parameters<typeof Async<string>>[0]["q"];

describe("Async (loading, failed, ready)", () => {
  it("shows the data when there is some", async () => {
    await renderApp(<Async q={q({ data: "hello" })}>{(d) => <Text>{d} world</Text>}</Async>, { signedInAs: null });
    expect(screen.getByText("hello world")).toBeOnTheScreen();
  });
  it("a report that has not started yet (waiting for the outlet) is LOADING, not an error", async () => {
    await renderApp(<Async q={q({ isLoading: false, data: undefined })}>{() => <Text>ready</Text>}</Async>, { signedInAs: null });
    expect(screen.getByLabelText("Loading")).toBeOnTheScreen();
    expect(screen.queryByText("Couldn't load this")).toBeNull();
    expect(screen.queryByText("ready")).toBeNull();
  });
  it("a report that is loading shows the grey cards", async () => {
    await renderApp(<Async q={q({ isLoading: true })}>{() => <Text>ready</Text>}</Async>, { signedInAs: null });
    expect(screen.getByLabelText("Loading")).toBeOnTheScreen();
  });
  it("a failed report says so, in the server's words, and offers another try", async () => {
    const refetch = jest.fn();
    await renderApp(<Async q={q({ isError: true, error: new Error("The server had a problem."), refetch })}>{() => <Text>ready</Text>}</Async>, { signedInAs: null });
    expect(screen.getByText("Couldn't load this")).toBeOnTheScreen();
    expect(screen.getByText("The server had a problem.")).toBeOnTheScreen();
    expect(screen.getByText("Try again")).toBeOnTheScreen();
  });
});

describe("the outlet the app sends with every report", () => {
  // the real /api/outlets answers with `_id` (not `id`): a screenshot run on a phone caught the app reading the wrong name and never loading a report
  function Probe() { useOutlets(); const o = useOptions(); return <Text testID="probe">{o.data ? "options loaded" : "waiting"}</Text>; }
  it("picks the first outlet's _id and sends it in the header of the very next requests", async () => {
    useScope.getState().reset();
    const server = reportsServer();
    await renderApp(<Probe />, { server });
    await waitFor(() => expect(screen.getByTestId("probe")).toHaveTextContent("options loaded"));
    expect(useScope.getState().home).toBe("o1");
    const call = server.to("GET", "/api/analytics/options")[0]!;
    expect(call.headers["x-rasoipulse-outlet"]).toBe("o1");
  });
  it("without an outlet nothing asks the server yet (and nothing says 'failed')", async () => {
    useScope.getState().reset();
    const server = reportsServer({ "GET /api/outlets": { json: { outlets: [] } } });
    await renderApp(<Probe />, { server });
    await screen.findByTestId("probe");
    expect(server.to("GET", "/api/analytics/options")).toHaveLength(0);
    expect(useScope.getState().home).toBeNull();
  });
});
