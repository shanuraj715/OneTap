import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Text as RNText } from "react-native";
import { ConfirmDialog, DEFAULT_DURATION, Dropdown, filterOptions, MAX_TOASTS, SEARCH_FROM, Sheet, ToastHost, createToastStore, toasts, type DropdownOption } from "@/ui";

describe("Sheet", () => {
  it("shows its title, content and footer, and closes from the X", async () => {
    const onClose = jest.fn();
    await render(<Sheet visible onClose={onClose} title="Move table" footer={<RNText>Footer here</RNText>}><RNText>Pick a free table</RNText></Sheet>);
    expect(screen.getByRole("header", { name: "Move table" })).toBeOnTheScreen();
    expect(screen.getByText("Pick a free table")).toBeOnTheScreen();
    expect(screen.getByText("Footer here")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalled();
  });
  it("renders nothing while closed, and mounts when opened", async () => {
    const { rerender } = await render(<Sheet visible={false} onClose={() => undefined} title="Move table"><RNText>Body</RNText></Sheet>);
    expect(screen.queryByText("Body")).toBeNull();
    await rerender(<Sheet visible onClose={() => undefined} title="Move table"><RNText>Body</RNText></Sheet>);
    expect(screen.getByText("Body")).toBeOnTheScreen();
  });
  it("unmounts again once the close animation has finished", async () => {
    const { rerender } = await render(<Sheet visible onClose={() => undefined} title="Move table"><RNText>Body</RNText></Sheet>);
    await rerender(<Sheet visible={false} onClose={() => undefined} title="Move table"><RNText>Body</RNText></Sheet>);
    await waitFor(() => expect(screen.queryByText("Body")).toBeNull());
  });
});

describe("Dropdown", () => {
  const three: Array<DropdownOption<string>> = [{ value: "a", label: "Ludhiana" }, { value: "b", label: "Noida", hint: "Sector 18" }, { value: "c", label: "Delhi", disabled: true }];
  const many: Array<DropdownOption<string>> = Array.from({ length: 9 }, (_, i) => ({ value: `t${i}`, label: `Table T${i + 1}` }));

  it("filterOptions matches label or hint, any case, and returns everything for a blank query", () => {
    expect(filterOptions(three, "")).toHaveLength(3);
    expect(filterOptions(three, "  ")).toHaveLength(3);
    expect(filterOptions(three, "NOI").map((o) => o.value)).toEqual(["b"]);
    expect(filterOptions(three, "sector").map((o) => o.value)).toEqual(["b"]);
    expect(filterOptions(three, "zzz")).toEqual([]);
  });
  it("shows the placeholder, then the chosen label", async () => {
    const { rerender } = await render(<Dropdown label="Outlet" value={null} options={three} onChange={() => undefined} placeholder="Choose an outlet" />);
    expect(screen.getByRole("combobox", { name: "Outlet" })).toHaveAccessibilityValue({ text: "Choose an outlet" });
    await rerender(<Dropdown label="Outlet" value="b" options={three} onChange={() => undefined} />);
    expect(screen.getByRole("combobox", { name: "Outlet" })).toHaveAccessibilityValue({ text: "Noida" });
  });
  it("opens the list, picks one, reports it and closes", async () => {
    const onChange = jest.fn();
    await render(<Dropdown label="Outlet" value="a" options={three} onChange={onChange} />);
    await fireEvent.press(screen.getByRole("combobox", { name: "Outlet" }));
    expect(screen.getByRole("menuitem", { name: "Ludhiana" })).toBeSelected();
    await fireEvent.press(screen.getByRole("menuitem", { name: "Noida" }));
    expect(onChange).toHaveBeenCalledWith("b");
    await waitFor(() => expect(screen.queryByRole("menuitem", { name: "Noida" })).toBeNull());
  });
  it("does not let a disabled option be picked", async () => {
    const onChange = jest.fn();
    await render(<Dropdown label="Outlet" value="a" options={three} onChange={onChange} />);
    await fireEvent.press(screen.getByRole("combobox", { name: "Outlet" }));
    await fireEvent.press(screen.getByRole("menuitem", { name: "Delhi" }));
    expect(onChange).not.toHaveBeenCalled();
  });
  it("a disabled dropdown does not open", async () => {
    await render(<Dropdown label="Outlet" value="a" options={three} onChange={() => undefined} disabled />);
    await fireEvent.press(screen.getByRole("combobox", { name: "Outlet" }));
    expect(screen.queryByRole("menuitem")).toBeNull();
  });
  it("has no search box for a short list, and one for a long list that filters", async () => {
    expect(many.length).toBeGreaterThanOrEqual(SEARCH_FROM);
    const { unmount } = await render(<Dropdown label="Outlet" value={null} options={three} onChange={() => undefined} />);
    await fireEvent.press(screen.getByRole("combobox", { name: "Outlet" }));
    expect(screen.queryByTestId("dropdown-search")).toBeNull();
    await unmount();

    await render(<Dropdown label="Table" value={null} options={many} onChange={() => undefined} />);
    await fireEvent.press(screen.getByRole("combobox", { name: "Table" }));
    await fireEvent.changeText(screen.getByTestId("dropdown-search"), "T9");
    expect(screen.getByRole("menuitem", { name: "Table T9" })).toBeOnTheScreen();
    expect(screen.queryByRole("menuitem", { name: "Table T1" })).toBeNull();
    await fireEvent.changeText(screen.getByTestId("dropdown-search"), "nope");
    expect(screen.getByText("Nothing matches “nope”.")).toBeOnTheScreen();
  });
  it("shows an error under the field", async () => {
    await render(<Dropdown label="Table" value={null} options={three} onChange={() => undefined} error="Pick a table" />);
    expect(screen.getByText("Pick a table")).toBeOnTheScreen();
  });
});

describe("ConfirmDialog", () => {
  it("is not shown while closed", async () => {
    await render(<ConfirmDialog visible={false} title="Void order?" message="x" confirmLabel="Void" onConfirm={() => undefined} onCancel={() => undefined} />);
    expect(screen.queryByText("Void order?")).toBeNull();
  });
  it("confirms and cancels", async () => {
    const onConfirm = jest.fn(); const onCancel = jest.fn();
    await render(<ConfirmDialog visible title="Void order?" message="The kitchen will be told." confirmLabel="Void order" destructive onConfirm={onConfirm} onCancel={onCancel} />);
    expect(screen.getByText("The kitchen will be told.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Void order" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
  it("while working: the confirm button is busy and nothing can be cancelled or double-confirmed", async () => {
    const onConfirm = jest.fn(); const onCancel = jest.fn();
    await render(<ConfirmDialog visible loading title="Void order?" message="x" confirmLabel="Void order" onConfirm={onConfirm} onCancel={onCancel} />);
    await fireEvent.press(screen.getByRole("button", { name: "Void order" }));
    await fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Void order" })).toBeBusy();
  });
});

describe("toast store", () => {
  it("adds toasts with the default time for their tone (errors stay longer)", () => {
    const t = createToastStore();
    t.ok("Saved"); t.error("Could not save");
    const [ok, bad] = t.store.getState().toasts;
    expect(ok).toMatchObject({ message: "Saved", tone: "ok", durationMs: DEFAULT_DURATION.ok });
    expect(bad).toMatchObject({ tone: "danger", durationMs: DEFAULT_DURATION.danger });
    expect(DEFAULT_DURATION.danger).toBeGreaterThan(DEFAULT_DURATION.ok);
  });
  it("shows the same message once (a double tap does not stack two)", () => {
    const t = createToastStore();
    const a = t.ok("Order sent"); const b = t.ok("Order sent");
    expect(a).toBe(b);
    expect(t.store.getState().toasts).toHaveLength(1);
    t.error("Order sent"); // same words, other tone = a different message
    expect(t.store.getState().toasts).toHaveLength(2);
  });
  it(`keeps at most ${MAX_TOASTS}, dropping the oldest`, () => {
    const t = createToastStore();
    ["a", "b", "c", "d", "e"].forEach((m) => t.info(m));
    expect(t.store.getState().toasts.map((x) => x.message)).toEqual(["c", "d", "e"]);
  });
  it("dismisses one, or clears all; ids never repeat", () => {
    const t = createToastStore();
    const a = t.info("a"); const b = t.info("b");
    expect(a).not.toBe(b);
    t.dismiss(a);
    expect(t.store.getState().toasts.map((x) => x.id)).toEqual([b]);
    t.clear();
    expect(t.store.getState().toasts).toEqual([]);
  });
});

describe("ToastHost", () => {
  afterEach(async () => { await act(async () => { toasts.clear(); }); });
  it("shows a message and removes it when tapped", async () => {
    await render(<ToastHost />);
    expect(screen.toJSON()).toBeNull();
    await act(async () => { toasts.ok("Order sent"); });
    const toast = screen.getByRole("alert", { name: "Order sent" });
    await fireEvent.press(toast);
    expect(screen.queryByText("Order sent")).toBeNull();
  });
  it("goes away by itself after its time", async () => {
    jest.useFakeTimers();
    try {
      await render(<ToastHost />);
      await act(async () => { toasts.show("Table moved", "ok", 1500); });
      expect(screen.getByText("Table moved")).toBeOnTheScreen();
      await act(async () => { await jest.advanceTimersByTimeAsync(1600); });
      expect(screen.queryByText("Table moved")).toBeNull();
    } finally { jest.useRealTimers(); }
  });
});
