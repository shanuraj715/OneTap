import { useWindowDimensions } from "react-native";

/**
 * The app runs on phones AND tablets, in portrait and landscape. Everything that adapts asks this one function, so a screen never
 * makes up its own breakpoints (all sizes in dp, Android's device-independent pixels).
 *
 *   phone   narrower than 600   one panel at a time (a list, then its detail on a new screen)
 *   tablet  600 – 839           roomier grids, still one panel at a time (a tablet held upright)
 *   wide    840 and up          two panels side by side: the list on the left, what you picked on the right
 */
export type LayoutKind = "phone" | "tablet" | "wide";

export interface Layout {
  kind: LayoutKind;
  width: number;
  height: number;
  landscape: boolean;
  /** show the list and the detail side by side */
  split: boolean;
  /** how many table cards fit in a row */
  tableColumns: number;
  /** how many dish cards fit in a row of the menu (without the cart beside it counted) */
  menuColumns: number;
  /** the widest a single-column page (a form, the sign-in) is allowed to be, so it never stretches across a tablet */
  contentMaxWidth: number;
  /** the side panel's width when `split` */
  sidePanelWidth: number;
}

export const BREAKPOINTS = { tablet: 600, wide: 840 } as const;

/** The narrowest a table card is allowed to be (dp). */
export const TABLE_CARD_MIN = 132;
/**
 * How many table cards fit in a row, from the width the LIST actually has (not the window: a side panel and a navigation bar may
 * take a lot of it). At least two, at most eight.
 */
export const columnsForWidth = (width: number): number => Math.max(2, Math.min(8, Math.floor((width - 24) / TABLE_CARD_MIN)));

export function layoutFor(width: number, height: number): Layout {
  const kind: LayoutKind = width >= BREAKPOINTS.wide ? "wide" : width >= BREAKPOINTS.tablet ? "tablet" : "phone";
  const split = kind === "wide";
  const sidePanelWidth = split ? Math.min(440, Math.max(340, Math.round(width * 0.36))) : 0;
  const listWidth = width - sidePanelWidth;
  const cols = (room: number, min: number, max: number) => Math.max(2, Math.min(max, Math.floor(room / min)));
  return {
    kind,
    width,
    height,
    landscape: width > height,
    split,
    tableColumns: cols(listWidth - 24, 132, 8),
    menuColumns: kind === "phone" ? 1 : cols(listWidth - 24, 260, 4),
    contentMaxWidth: kind === "phone" ? width : 560,
    sidePanelWidth,
  };
}

export function useLayout(): Layout {
  const { width, height } = useWindowDimensions();
  return layoutFor(width, height);
}
