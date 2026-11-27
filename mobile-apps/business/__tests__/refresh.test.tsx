import * as RN from "react-native";
import { Platform } from "react-native";
import { fireEvent, screen } from "@testing-library/react-native";
import { PULL_AT, Screen } from "@/ui";
import { darkColors, lightColors } from "@/ui/theme";
import { fakeServer, renderApp } from "../test/harness";

const open = (props: { onRefresh?: () => void; refreshing?: boolean } = {}) => renderApp(<Screen title="T" {...props}><RN.Text>body</RN.Text></Screen>, { server: fakeServer(), signedInAs: null });
const scroller = () => screen.getByTestId("screen-scroll");
const drag = (y: number) => fireEvent(scroller(), "scrollEndDrag", { nativeEvent: { contentOffset: { x: 0, y } } });
/** react-native-svg turns a colour into a number; this reads it back as "#RRGGBB" */
const hexOf = (c: { payload: number }) => `#${(c.payload >>> 0).toString(16).padStart(8, "0").slice(2).toUpperCase()}`;

describe("pull down to refresh (iPhone and iPad: we read the pull ourselves)", () => {
  beforeEach(() => jest.replaceProperty(Platform, "OS", "ios"));
  afterEach(() => jest.restoreAllMocks());

  it("letting go after pulling far enough refreshes, once", async () => {
    const onRefresh = jest.fn();
    await open({ onRefresh });
    drag(-(PULL_AT + 10));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
  it("a short pull does nothing", async () => {
    const onRefresh = jest.fn();
    await open({ onRefresh });
    drag(-(PULL_AT - 20));
    expect(onRefresh).not.toHaveBeenCalled();
  });
  it("pulling while it is already refreshing does not start another", async () => {
    const onRefresh = jest.fn();
    await open({ onRefresh, refreshing: true });
    drag(-(PULL_AT + 40));
    expect(onRefresh).not.toHaveBeenCalled();
  });
  it("the phone's own spinner is not used (ours is)", async () => {
    await open({ onRefresh: jest.fn() });
    expect(scroller().props.refreshControl).toBeUndefined();
  });
  it("a screen with nothing to refresh has no loader and no pull handling", async () => {
    await open();
    expect(screen.queryByTestId("refresh-indicator")).toBeNull();
    expect(scroller().props.onScrollEndDrag).toBeUndefined();
    expect(scroller().props.refreshControl).toBeUndefined();
  });
});

describe("pull down to refresh (Android: the system does the gesture, we draw the loader)", () => {
  beforeEach(() => jest.replaceProperty(Platform, "OS", "android"));
  afterEach(() => jest.restoreAllMocks());

  it("the system's spinner is there for the gesture but invisible and pushed out of sight", async () => {
    const onRefresh = jest.fn();
    await open({ onRefresh });
    const control = scroller().props.refreshControl;
    expect(control.props).toMatchObject({ colors: ["transparent"], tintColor: "transparent", progressBackgroundColor: "transparent" });
    expect(control.props.progressViewOffset).toBeLessThan(0);
    control.props.onRefresh();
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
  it("the loader appears while it refreshes and is gone when not", async () => {
    const view = await open({ onRefresh: jest.fn(), refreshing: false });
    expect(screen.queryByTestId("refresh-indicator")).toBeNull();
    await view.rerender(<Screen title="T" onRefresh={jest.fn()} refreshing><RN.Text>body</RN.Text></Screen>);
    expect(await screen.findByTestId("refresh-indicator")).toHaveProp("accessibilityLabel", "Refreshing");
  });
});

describe("the loader's colour: dark on light, light on dark", () => {
  afterEach(() => jest.restoreAllMocks());
  it.each([["light", lightColors.text], ["dark", darkColors.text]] as const)("in %s mode the spinning arc is %s", async (mode, colour) => {
    jest.spyOn(RN, "useColorScheme").mockReturnValue(mode);
    jest.replaceProperty(Platform, "OS", "android");
    await open({ onRefresh: jest.fn(), refreshing: true });
    expect(hexOf((await screen.findByTestId("refresh-arc")).props.stroke)).toBe(colour.toUpperCase());
  });
  it("…and those really are a dark colour for light mode and a light colour for dark mode", () => {
    const lum = (hex: string) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    expect(lum(lightColors.text)).toBeLessThan(80);
    expect(lum(darkColors.text)).toBeGreaterThan(200);
  });
});
