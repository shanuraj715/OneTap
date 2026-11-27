import { fireEvent, screen, within } from "@testing-library/react-native";
import { Text } from "react-native";
import { Background, Button, Glass, Segmented, Sheet } from "@/ui";
import { fakeServer, renderApp } from "../test/harness";

const frosts = (id: string) => within(screen.getByTestId(id)).queryAllByTestId("frost");
const open = (ui: React.ReactElement) => renderApp(<><Background />{ui}</>, { server: fakeServer(), signedInAs: null });

describe("every panel blurs what is behind it", () => {
  it("a panel is frosted by default — the form's cards, the list rows, the stat tiles (nobody has to ask for it)", async () => {
    await open(<Glass testID="card"><Text>hello</Text></Glass>);
    expect(frosts("card")).toHaveLength(1);
  });

  it("a panel can still be made plain on purpose", async () => {
    await open(<Glass testID="plain" blur={false}><Text>hello</Text></Glass>);
    expect(frosts("plain")).toHaveLength(0);
  });

  it("a glass button and the chips that are not selected are frosted; a selected chip and a solid button are not", async () => {
    await open(<><Button title="Glass" variant="glass" testID="b-glass" /><Button title="Solid" testID="b-solid" /><Segmented testID="seg" value="a" onChange={() => undefined} options={[{ value: "a", label: "A" }, { value: "b", label: "B" }]} /></>);
    expect(frosts("b-glass")).toHaveLength(1);
    expect(frosts("b-solid")).toHaveLength(0);
    expect(frosts("seg-a")).toHaveLength(0); // the chosen one is solid colour
    expect(frosts("seg-b")).toHaveLength(1);
  });

  it("inside a pop-up sheet nothing is blurred (a sheet is its own window on a solid fill: a blur there would smear the app's background through it)", async () => {
    await open(<Sheet visible onClose={() => undefined} title="T" testID="sheet"><Glass testID="in-sheet"><Text>x</Text></Glass><Button title="g" variant="glass" testID="btn-in-sheet" /></Sheet>);
    expect(await screen.findByTestId("in-sheet")).toBeOnTheScreen();
    expect(frosts("in-sheet")).toHaveLength(0);
    expect(frosts("btn-in-sheet")).toHaveLength(0);
  });

  it("without the app's background there is nothing to blur, so nothing is drawn (no half-drawn tint)", async () => {
    await renderApp(<Glass testID="alone"><Text>x</Text></Glass>, { server: fakeServer(), signedInAs: null });
    expect(frosts("alone")).toHaveLength(0);
    fireEvent.press(screen.getByTestId("alone")); // (pressing a plain panel does nothing and must not throw)
  });
});
