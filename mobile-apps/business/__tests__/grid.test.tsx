import { Text } from "react-native";
import { screen } from "@testing-library/react-native";
import { Grid } from "@/ui";
import { renderApp } from "../test/harness";

/** A phone screen run found the Sales tiles stacked in ONE column: `{LIST.map(...)}` beside one more tile gave a list inside a list, and the grid treated the whole inner list as a single cell. */
describe("Grid", () => {
  it("lays out every tile as its own cell, even when the children are a list plus one more tile", async () => {
    await renderApp(
      <Grid min={160}>
        {["a", "b", "c"].map((k) => <Text key={k} testID={`cell-${k}`}>{k}</Text>)}
        <Text testID="cell-d">d</Text>
      </Grid>, { signedInAs: null });
    for (const k of ["a", "b", "c", "d"]) expect(screen.getByTestId(`cell-${k}`)).toBeOnTheScreen();
    // each tile sits in its own wrapper cell (four cells), not three tiles squeezed into one
    const cells = new Set(["a", "b", "c", "d"].map((k) => screen.getByTestId(`cell-${k}`).parent));
    expect(cells.size).toBe(4);
  });
  it("skips things that draw nothing (null, false)", async () => {
    await renderApp(<Grid min={160}>{[<Text key="x" testID="only">x</Text>, null, false]}</Grid>, { signedInAs: null });
    expect(screen.getByTestId("only")).toBeOnTheScreen();
  });
});
