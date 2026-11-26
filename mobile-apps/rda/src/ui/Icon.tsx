import Svg, { Path } from "react-native-svg";
import { useTheme } from "./theme";

/** A small set of line icons (24×24, drawn as paths — no icon font to load, nothing to go missing). */
const circle = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
export const ICONS = {
  check: ["M5 12.5l4.5 4.5L19 7.5"],
  close: ["M6 6l12 12M18 6L6 18"],
  plus: ["M12 5v14M5 12h14"],
  minus: ["M5 12h14"],
  search: [circle(11, 11, 6.5), "M16 16l4.5 4.5"],
  "chevron-down": ["M6 9l6 6 6-6"],
  "chevron-up": ["M6 15l6-6 6 6"],
  "chevron-right": ["M9 6l6 6-6 6"],
  "chevron-left": ["M15 6l-6 6 6 6"],
  user: [circle(12, 8, 4), "M4.5 20c1-4 4-6 7.5-6s6.5 2 7.5 6"],
  logout: ["M9 4H5v16h4M15 8l4 4-4 4M19 12H9"],
  table: ["M3 9h18M6 9v9M18 9v9M5 9V6h14v3"],
  receipt: ["M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6"],
  refresh: ["M20 11a8 8 0 10-2.3 5.7M20 5v6h-6"],
  alert: [circle(12, 12, 9), "M12 8v5M12 16.5v.01"],
  info: [circle(12, 12, 9), "M12 11v5M12 8v.01"],
  clock: [circle(12, 12, 9), "M12 7v5l3 2"],
  navigation: ["M3 11l18-8-8 18-2-8z"],
  message: ["M4 5h16v11H9l-5 4z", "M8 9h8M8 12h5"],
  bike: [circle(6, 17, 3), circle(18, 17, 3), "M6 17l4-8h5l3 8M10 9L8 6H6M14 9l1.5-3H18"],
  phone: ["M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"],
  move: ["M7 7h12l-3-3M17 17H5l3 3"],
  trash: ["M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"],
  "wifi-off": ["M3 3l18 18M8.5 16a5 5 0 017 0M5 12.5a10 10 0 015-2.7M12 20h.01"],
  store: ["M4 9l1.5-5h13L20 9M4 9v11h16V9M4 9a3 3 0 006 0 3 3 0 006 0 3 3 0 004 0"],
  eye: ["M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z", circle(12, 12, 2.5)],
  "eye-off": ["M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z", "M3 3l18 18"],
  list: ["M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"],
  filter: ["M4 5h16l-6 8v6l-4-2v-4z"],
  bag: ["M6 7h12l-1 13H7zM9 7a3 3 0 016 0"],
  note: ["M5 4h14v16H5zM8 9h8M8 13h5"],
  pin: ["M12 21s-6-5.6-6-10.5a6 6 0 0112 0C18 15.4 12 21 12 21z", circle(12, 10.5, 2.2)],
  mail: ["M4 6h16v12H4z", "M4.5 7l7.5 6 7.5-6"],
  lock: ["M6 11h12v9H6z", "M8.5 11V8a3.5 3.5 0 017 0v3", "M12 15v2"],
  shield: ["M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z", "M9 12l2 2 4-4"],
  bell: ["M6 16v-5a6 6 0 0112 0v5l1.5 2h-15z", "M10 20.5a2 2 0 004 0"],
  wallet: ["M3 7.5A2.5 2.5 0 015.5 5H18v3", "M3 7.5V18a2 2 0 002 2h14a1 1 0 001-1V9a1 1 0 00-1-1H5.5A2.5 2.5 0 013 7.5z", "M16 14h.01"],
  rupee: ["M7 5h10M7 9.5h10M8 5c4.5 0 6.5 1.8 6.5 4.5S12 14 8 14l7 6"],
  "check-circle": [circle(12, 12, 9), "M8 12.5l2.7 2.7 5.3-5.7"],
  "x-circle": [circle(12, 12, 9), "M9 9l6 6M15 9l-6 6"],
  flame: ["M12 3c.5 3 4.5 4.8 4.5 9a4.5 4.5 0 01-9 0c0-1.6.7-2.9 1.8-3.9.2 1.2.9 1.9 1.7 2.2C11 8.3 10.7 5.3 12 3z"],
  pot: ["M5 11h14v5.5a3.5 3.5 0 01-3.5 3.5h-7A3.5 3.5 0 015 16.5z", "M3 11h18", "M8.5 8V5.5M12 8V4M15.5 8V5.5"],
  calendar: ["M4 6h16v14H4z", "M4 10.5h16", "M8 3.5v4M16 3.5v4"],
  tag: ["M4 4h8l8 8-8 8-8-8z", "M8.5 8.5h.01"],
  star: ["M12 3.5l2.6 5.4 5.9.8-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.7l5.9-.8z"],
  sliders: ["M4 7h9M17 7h3M4 17h3M11 17h9", circle(15, 7, 2), circle(9, 17, 2)],
  grid: ["M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"],
  layers: ["M12 4l9 5-9 5-9-5z", "M3 14l9 5 9-5"],
  "arrow-right": ["M5 12h14M13.5 6L19.5 12 13.5 18"],
  chair: ["M7.5 11V6.5A2.5 2.5 0 0110 4h4a2.5 2.5 0 012.5 2.5V11", "M5 11h14v4H5z", "M7 15v5M17 15v5"],
  hash: ["M5 9h14M5 15h14M10 4L8 20M16 4l-2 16"],
  wifi: ["M3 9a14 14 0 0118 0", "M6 12.5a10 10 0 0112 0", "M9 16a5 5 0 016 0", "M12 19.5h.01"],
  server: ["M4 5h16v6H4zM4 13h16v6H4z", "M8 8h.01M8 16h.01"],
  pencil: ["M4 20l1-4L16.5 4.5a2.1 2.1 0 013 3L8 19z", "M14.5 6.5l3 3"],
  history: ["M4 12a8 8 0 108-8 8 8 0 00-6 2.7", "M4 4v4h4", "M12 8v4l3 2"],
  sparkle: ["M12 4l1.8 5.2L19 11l-5.2 1.8L12 18l-1.8-5.2L5 11l5.2-1.8z"],
  utensils: ["M7 3v7a2 2 0 002 2v9M11 3v7a2 2 0 01-2 2M9 3v6", "M17 3c-2 1.5-3 4-3 7h3v11"],
  download: ["M12 4v11M7.5 11L12 15.5 16.5 11", "M5 19.5h14"],
  external: ["M14 4h6v6M20 4l-9 9", "M18 14v5.5H4.5V6H10"],
  swap: ["M16 3l4 4-4 4M20 7H8", "M8 21l-4-4 4-4M4 17h12"],
  users: [circle(9, 8, 3.5), "M2.5 20c.8-3.5 3.5-5.5 6.5-5.5s5.7 2 6.5 5.5", "M16 4.8a3.5 3.5 0 010 6.4M18.5 14.8c1.6.7 2.6 2.4 3 4.7"],
} as const;
export type IconName = keyof typeof ICONS;

export interface IconProps { name: IconName; size?: number; color?: string; strokeWidth?: number }

export function Icon({ name, size = 22, color, strokeWidth = 2 }: IconProps) {
  const { c } = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {ICONS[name].map((d, i) => (
        <Path key={i} d={d} stroke={color ?? c.text} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      ))}
    </Svg>
  );
}
