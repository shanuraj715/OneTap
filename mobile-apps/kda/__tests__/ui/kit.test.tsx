import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { ApiError } from "@/api/client";
import { Badge, Button, Card, Chip, EmptyState, ErrorState, FoodMark, IconButton, ProgressBar, SegmentedControl, Skeleton, Spinner, TextField, TopProgress } from "@/ui";

describe("Button", () => {
  it("shows its title and presses", async () => {
    const onPress = jest.fn();
    await render(<Button title="Send order" onPress={onPress} />);
    await fireEvent.press(screen.getByRole("button", { name: "Send order" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
  it("ignores taps and says it is busy while loading (no double send)", async () => {
    const onPress = jest.fn();
    await render(<Button title="Send order" loading onPress={onPress} />);
    const button = screen.getByRole("button", { name: "Send order" });
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
    expect(button).toBeBusy();
    expect(button).toBeDisabled();
  });
  it("ignores taps when disabled", async () => {
    const onPress = jest.fn();
    await render(<Button title="Pay" disabled onPress={onPress} />);
    await fireEvent.press(screen.getByRole("button", { name: "Pay" }));
    expect(onPress).not.toHaveBeenCalled();
  });
  it("IconButton needs and exposes its label", async () => {
    const onPress = jest.fn();
    await render(<IconButton icon="trash" label="Remove line" onPress={onPress} />);
    await fireEvent.press(screen.getByRole("button", { name: "Remove line" }));
    expect(onPress).toHaveBeenCalled();
  });
});

describe("TextField", () => {
  it("shows the label and the typed value, and reports changes", async () => {
    const onChangeText = jest.fn();
    await render(<TextField label="Phone" value="98" onChangeText={onChangeText} />);
    const input = screen.getByLabelText("Phone");
    expect(input.props.value).toBe("98");
    await fireEvent.changeText(input, "9876");
    expect(onChangeText).toHaveBeenCalledWith("9876");
  });
  it("shows an error in place of the helper text", async () => {
    await render(<TextField label="Phone" value="" onChangeText={() => undefined} helper="10 digits" error="Enter a phone number" />);
    expect(screen.getByText("Enter a phone number")).toBeOnTheScreen();
    expect(screen.queryByText("10 digits")).toBeNull();
  });
  it("hides a password until the eye is pressed", async () => {
    await render(<TextField label="Password" value="secret" onChangeText={() => undefined} secure />);
    expect(screen.getByLabelText("Password").props.secureTextEntry).toBe(true);
    await fireEvent.press(screen.getByRole("button", { name: "Show password" }));
    expect(screen.getByLabelText("Password").props.secureTextEntry).toBe(false);
    await fireEvent.press(screen.getByRole("button", { name: "Hide password" }));
    expect(screen.getByLabelText("Password").props.secureTextEntry).toBe(true);
  });
});

describe("Chip, SegmentedControl, Badge", () => {
  it("Chip tells screen readers its count and whether it is selected", async () => {
    const onPress = jest.fn();
    await render(<Chip label="Terrace" count={4} selected onPress={onPress} />);
    const chip = screen.getByRole("button", { name: "Terrace, 4" });
    expect(chip).toBeSelected();
    await fireEvent.press(chip);
    expect(onPress).toHaveBeenCalled();
  });
  it("SegmentedControl picks exactly one and reports the change", async () => {
    const onChange = jest.fn();
    await render(<SegmentedControl label="Food type" value="all" onChange={onChange} options={[{ value: "all", label: "All" }, { value: "veg", label: "Veg" }, { value: "non-veg", label: "Non-veg" }]} />);
    expect(screen.getByRole("radio", { name: "All" })).toBeSelected();
    expect(screen.getByRole("radio", { name: "Veg" })).not.toBeSelected();
    await fireEvent.press(screen.getByRole("radio", { name: "Veg" }));
    expect(onChange).toHaveBeenCalledWith("veg");
  });
  it("Badge shows its words (colour is never the only signal)", async () => {
    await render(<Badge label="Ready to serve" tone="ok" icon="check" />);
    expect(screen.getByText("Ready to serve")).toBeOnTheScreen();
  });
});

describe("Card", () => {
  it("is only a button when it has onPress", async () => {
    const onPress = jest.fn();
    const { rerender } = await render(<Card label="Table T3"><></></Card>);
    expect(screen.queryByRole("button")).toBeNull();
    await rerender(<Card label="Table T3" onPress={onPress}><></></Card>);
    await fireEvent.press(screen.getByRole("button", { name: "Table T3" }));
    expect(onPress).toHaveBeenCalled();
  });
});

describe("EmptyState and ErrorState", () => {
  it("EmptyState shows its words and an action", async () => {
    const onPress = jest.fn();
    await render(<EmptyState title="No open orders" message="New orders appear here." action={{ title: "Take an order", onPress }} />);
    expect(screen.getByText("No open orders")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Take an order" }));
    expect(onPress).toHaveBeenCalled();
  });
  it("ErrorState says 'No connection' for a network failure and can retry", async () => {
    const onRetry = jest.fn();
    await render(<ErrorState error={new ApiError(0, "Can't reach the server.")} onRetry={onRetry} />);
    expect(screen.getByText("No connection")).toBeOnTheScreen();
    expect(screen.getByText("Can't reach the server.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalled();
  });
  it("ErrorState shows the server's own message for other errors, with no retry button when none is given", async () => {
    await render(<ErrorState error={new ApiError(409, "Table is taken.", { code: "table_taken" })} />);
    expect(screen.getByText("Something went wrong")).toBeOnTheScreen();
    expect(screen.getByText("Table is taken.")).toBeOnTheScreen();
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("loaders", () => {
  it("ProgressBar reports a clamped percentage", async () => {
    const { rerender } = await render(<ProgressBar value={0.4} label="Sending" />);
    expect(screen.getByRole("progressbar", { name: "Sending" })).toHaveAccessibilityValue({ now: 40, min: 0, max: 100 });
    await rerender(<ProgressBar value={7} label="Sending" />);
    expect(screen.getByRole("progressbar", { name: "Sending" })).toHaveAccessibilityValue({ now: 100 });
    await rerender(<ProgressBar value={-2} label="Sending" />);
    expect(screen.getByRole("progressbar", { name: "Sending" })).toHaveAccessibilityValue({ now: 0 });
  });
  it("ProgressBar without a value is an 'unknown time' bar (no number)", async () => {
    await render(<ProgressBar label="Working" />);
    expect(screen.getByRole("progressbar", { name: "Working" })).not.toHaveAccessibilityValue({ now: 0 });
  });
  it("TopProgress waits before showing, so quick calls do not flicker", async () => {
    jest.useFakeTimers();
    try {
      await render(<TopProgress active delayMs={200} />);
      expect(screen.queryByTestId("top-progress")).toBeNull();
      await act(async () => { await jest.advanceTimersByTimeAsync(250); });
      expect(screen.getByTestId("top-progress")).toBeOnTheScreen();
    } finally { jest.useRealTimers(); }
  });
  it("TopProgress stays hidden when the work finishes inside the wait", async () => {
    jest.useFakeTimers();
    try {
      const { rerender } = await render(<TopProgress active delayMs={200} />);
      await act(async () => { await jest.advanceTimersByTimeAsync(100); });
      await rerender(<TopProgress active={false} delayMs={200} />);
      await act(async () => { await jest.advanceTimersByTimeAsync(400); });
      expect(screen.queryByTestId("top-progress")).toBeNull();
    } finally { jest.useRealTimers(); }
  });
  it("Spinner and Skeleton render", async () => {
    await render(<><Spinner label="Loading tables" /><Skeleton height={20} /></>);
    expect(screen.getByRole("progressbar", { name: "Loading tables" })).toBeOnTheScreen();
  });
});

describe("FoodMark", () => {
  it("names the food type for screen readers", async () => {
    await render(<><FoodMark type="veg" /><FoodMark type="egg" /><FoodMark type="non-veg" /></>);
    expect(screen.getByLabelText("Vegetarian")).toBeOnTheScreen();
    expect(screen.getByLabelText("Contains egg")).toBeOnTheScreen();
    expect(screen.getByLabelText("Non-vegetarian")).toBeOnTheScreen();
  });
});

// keep `within` imported for later suites that scope queries
void within;
