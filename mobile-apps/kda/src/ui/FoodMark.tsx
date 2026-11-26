import Svg, { Circle, Rect } from "react-native-svg";
import type { FoodType } from "@/api/schemas";

/**
 * The veg / non-veg / egg symbol. Like on the storefront it is a standard symbol with fixed colours (it does not follow the theme):
 * a white tile with a coloured frame and a dot of the same colour.
 */
const COLORS: Record<FoodType, string> = { veg: "#0E8A3E", egg: "#C79A20", "non-veg": "#B23B3B" };
export const FOOD_LABEL: Record<FoodType, string> = { veg: "Vegetarian", egg: "Contains egg", "non-veg": "Non-vegetarian" };

export function FoodMark({ type, size = 14 }: { type: FoodType; size?: number }) {
  const color = COLORS[type];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityRole="image" accessibilityLabel={FOOD_LABEL[type]}>
      {type === "veg" ? (
        <>
          <Rect x={1.5} y={1.5} width={21} height={21} rx={4} fill="#FFFFFF" stroke={color} strokeWidth={3} />
          <Rect x={7} y={7} width={10} height={10} rx={1.5} fill={color} />
        </>
      ) : (
        <>
          <Circle cx={12} cy={12} r={10.5} fill="#FFFFFF" stroke={color} strokeWidth={3} />
          <Circle cx={12} cy={12} r={5.2} fill={color} />
        </>
      )}
    </Svg>
  );
}
