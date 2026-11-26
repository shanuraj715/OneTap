import { render, screen } from "@testing-library/react-native";
import { Text as RNText } from "react-native";
import { OfflineBanner, Screen } from "@/ui";

let mockNet: { isConnected: boolean | null } = { isConnected: true };
jest.mock("@react-native-community/netinfo", () => ({ __esModule: true, default: {}, useNetInfo: () => mockNet }));

describe("OfflineBanner", () => {
  it("is hidden while online, and while the phone has not yet checked", async () => {
    mockNet = { isConnected: true };
    const { rerender } = await render(<OfflineBanner />);
    expect(screen.queryByTestId("offline-banner")).toBeNull();
    mockNet = { isConnected: null };
    await rerender(<OfflineBanner />);
    expect(screen.queryByTestId("offline-banner")).toBeNull();
  });
  it("tells the cook that the board cannot refresh while offline", async () => {
    mockNet = { isConnected: false };
    await render(<OfflineBanner />);
    expect(screen.getByTestId("offline-banner")).toBeOnTheScreen();
    expect(screen.getByText(/the board can't refresh/i)).toBeOnTheScreen();
  });
});

describe("Screen", () => {
  it("shows its content, and the offline banner above it when offline", async () => {
    mockNet = { isConnected: false };
    await render(<Screen><RNText>Tables</RNText></Screen>);
    expect(screen.getByText("Tables")).toBeOnTheScreen();
    expect(screen.getByTestId("offline-banner")).toBeOnTheScreen();
  });
  it("scrolling pages render their content too", async () => {
    mockNet = { isConnected: true };
    await render(<Screen scroll narrow><RNText>Sign in</RNText></Screen>);
    expect(screen.getByText("Sign in")).toBeOnTheScreen();
    expect(screen.queryByTestId("offline-banner")).toBeNull();
  });
});
