import { AccessibilityInfo } from "react-native";
import { act, screen } from "@testing-library/react-native";
import { CountUp } from "@/ui/primitives";
import { fakeServer, renderApp } from "../test/harness";

const fmt = (n: number) => `₹${n}`;

describe("reduced motion (the phone asks for less movement)", () => {
  afterEach(() => jest.restoreAllMocks());

  it("a number is shown at its value at once, instead of counting up from 0", async () => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
    await renderApp(<CountUp value={1234} format={fmt} />, { server: fakeServer(), signedInAs: null });
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByText("₹1234")).toBeOnTheScreen();
  });

  it("without it, the number starts at 0 and counts up (the movement is still there for everyone else)", async () => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
    await renderApp(<CountUp value={1234} format={fmt} />, { server: fakeServer(), signedInAs: null });
    expect(screen.queryByText("₹1234")).toBeNull();
  });
});
