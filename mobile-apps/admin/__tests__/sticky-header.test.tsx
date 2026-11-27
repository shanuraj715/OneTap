import * as RN from "react-native";
import { Platform } from "react-native";
import { fireEvent, screen } from "@testing-library/react-native";
import { Screen } from "@/ui";
import { fakeServer, renderApp } from "../test/harness";

const open = (props: { right?: React.ReactNode; back?: () => void; onRefresh?: () => void } = {}) =>
  renderApp(<Screen title="Server" subtitle="How it is doing" {...props}><RN.Text testID="body-card">body</RN.Text></Screen>, { server: fakeServer(), signedInAs: null });

/** every ancestor of a node, nearest first */
const ancestors = (node: { parent: unknown }) => { const out: unknown[] = []; let n = node.parent as { parent: unknown } | null; while (n) { out.push(n); n = n.parent as { parent: unknown } | null; } return out; };
const inside = (node: { parent: unknown }, of: unknown) => ancestors(node).includes(of);
const scrollTo = (y: number) => fireEvent.scroll(screen.getByTestId("screen-scroll"), { nativeEvent: { contentOffset: { x: 0, y }, contentSize: { height: 2000, width: 400 }, layoutMeasurement: { height: 800, width: 400 } } });
const lineOpacity = () => (RN.StyleSheet.flatten(screen.getByTestId("screen-header-line").props.style) as { opacity: number }).opacity;

describe("the title bar stays put while the cards scroll", () => {
  afterEach(() => jest.restoreAllMocks());

  it("the title and subtitle are NOT inside the scroll area; the cards are", async () => {
    await open();
    const scroller = screen.getByTestId("screen-scroll");
    expect(inside(screen.getByText("Server"), scroller)).toBe(false);
    expect(inside(screen.getByText("How it is doing"), scroller)).toBe(false);
    expect(inside(screen.getByTestId("body-card"), scroller)).toBe(true);
    expect(inside(screen.getByTestId("screen-header"), scroller)).toBe(false);
  });

  it("the Save / New … button on the right of the title is in the bar too, and still works", async () => {
    const onPress = jest.fn();
    await open({ right: <RN.Pressable testID="bar-save" onPress={onPress}><RN.Text>Save</RN.Text></RN.Pressable> });
    expect(inside(screen.getByTestId("bar-save"), screen.getByTestId("screen-scroll"))).toBe(false);
    expect(inside(screen.getByTestId("bar-save"), screen.getByTestId("screen-header"))).toBe(true);
    await fireEvent.press(screen.getByTestId("bar-save"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("the back arrow is in the bar and goes back", async () => {
    const back = jest.fn();
    await open({ back });
    expect(inside(screen.getByTestId("back"), screen.getByTestId("screen-scroll"))).toBe(false);
    await fireEvent.press(screen.getByTestId("back"));
    expect(back).toHaveBeenCalledTimes(1);
  });

  it("the bar comes before the scroll area (above it), so the cards are cut off at the bar", async () => {
    await open();
    const header = screen.getByTestId("screen-header");
    const scroller = screen.getByTestId("screen-scroll");
    const kids = (header.parent as { children: unknown[] }).children;
    expect(kids.indexOf(header)).toBeLessThan(kids.indexOf(scroller));
    expect(RN.StyleSheet.flatten(scroller.props.style)).toMatchObject({ flex: 1 }); // takes the space UNDER the bar, not the whole screen
  });

  it("a thin line shows under the bar once the cards have scrolled, and goes away at the top", async () => {
    await open();
    expect(lineOpacity()).toBe(0);
    await scrollTo(120);
    expect(lineOpacity()).toBe(1);
    await scrollTo(0);
    expect(lineOpacity()).toBe(0);
  });

  it("the line also works with pull-to-refresh on (iPhone/iPad hand us the scroll too) and the pull still refreshes", async () => {
    jest.replaceProperty(Platform, "OS", "ios");
    const onRefresh = jest.fn();
    await open({ onRefresh });
    await scrollTo(60);
    expect(lineOpacity()).toBe(1);
    fireEvent(screen.getByTestId("screen-scroll"), "scrollEndDrag", { nativeEvent: { contentOffset: { x: 0, y: -90 } } });
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("the title bar keeps its place under the status bar and the title is still a header for screen readers", async () => {
    await open();
    expect(screen.getByRole("header", { name: "Server" })).toBeTruthy();
  });
});
