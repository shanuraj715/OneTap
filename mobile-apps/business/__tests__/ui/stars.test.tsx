import { screen } from "@testing-library/react-native";
import { Stars } from "@/ui";
import { darkColors, lightColors } from "@/ui/theme";
import { renderApp } from "../../test/harness";

type Node = { type: string; props: Record<string, unknown>; children?: (Node | string)[] | null };
/** every node of the drawn tree whose type matches */
const find = (node: Node | string | (Node | string)[] | null, type: string, out: Node[] = []): Node[] => {
  if (!node || typeof node === "string") return out;
  if (Array.isArray(node)) { node.forEach((n) => find(n, type, out)); return out; }
  if (node.type === type) out.push(node);
  (node.children ?? []).forEach((c) => find(c, type, out));
  return out;
};
const tree = () => screen.toJSON() as unknown as Node | Node[];
/** one clip box per star: 24 wide = full, 0 = empty, in between = partly filled from the left */
const widths = () => find(tree(), "RNSVGRect").map((r) => Math.round(Number(r.props.width) * 10) / 10);
// the drawing library hands colours to the phone as numbers (alpha, red, green, blue packed in one)
const argb = (hex: string) => 0xff000000 + parseInt(hex.slice(1), 16);
const used = () => new Set<number>([...find(tree(), "RNSVGPath").map((p) => (p.props.fill as { payload?: number } | undefined)?.payload), ...find(tree(), "RNSVGStop").map((p) => (p.props.stopColor as { payload?: number } | number | undefined) as number)].map((v) => (typeof v === "object" && v ? (v as { payload: number }).payload : v)).filter((v): v is number => typeof v === "number"));

describe("Stars (modern, in the app's colour)", () => {
  it("says the value in words for a screen reader", async () => {
    await renderApp(<Stars value={4.3} />, { signedInAs: null });
    expect(screen.getByLabelText("4.3 out of 5 stars")).toBeOnTheScreen();
  });
  it("whole values fill whole stars, a decimal fills part of the next one, the rest stay empty", async () => {
    await renderApp(<Stars value={3.4} />, { signedInAs: null });
    expect(widths()).toEqual([24, 24, 24, 9.6, 0]);
  });
  it("0 is all empty and 5 is all full", async () => {
    const a = await renderApp(<Stars value={0} />, { signedInAs: null });
    expect(widths()).toEqual([0, 0, 0, 0, 0]);
    await a.unmount();
    await renderApp(<Stars value={5} />, { signedInAs: null });
    expect(widths()).toEqual([24, 24, 24, 24, 24]);
  });
  it("nonsense is kept in range: -2 → 0 stars, 9 → 5 stars, NaN → 0", async () => {
    let v = await renderApp(<Stars value={-2} />, { signedInAs: null });
    expect(widths()).toEqual([0, 0, 0, 0, 0]);
    await v.unmount();
    v = await renderApp(<Stars value={9} />, { signedInAs: null });
    expect(widths()).toEqual([24, 24, 24, 24, 24]);
    expect(screen.getByLabelText("5 out of 5 stars")).toBeOnTheScreen();
    await v.unmount();
    await renderApp(<Stars value={Number.NaN} />, { signedInAs: null });
    expect(widths()).toEqual([0, 0, 0, 0, 0]);
  });
  it("is drawn in the app's own colour (the rose primary), never the stock yellow", async () => {
    await renderApp(<Stars value={5} />, { signedInAs: null });
    const all = used();
    expect([lightColors.primary, darkColors.primary].some((p) => all.has(argb(p)))).toBe(true); // the empty tint and the gradient's lower stop
    for (const yellow of ["#F5A524", "#FFC145", "#FBBF24", "#FFD700", "#FFFF00"]) expect(all.has(argb(yellow))).toBe(false);
  });
  it("a colour can be given (a store's own)", async () => {
    await renderApp(<Stars value={5} color="#0D9488" />, { signedInAs: null });
    expect(used().has(argb("#0D9488"))).toBe(true);
    expect([lightColors.primary, darkColors.primary].some((p) => used().has(argb(p)))).toBe(false); // and not the app's own
  });
  it("can show the number beside the stars", async () => {
    await renderApp(<Stars value={4.25} showValue />, { signedInAs: null });
    expect(screen.getByText("4.3")).toBeOnTheScreen();
  });
});
