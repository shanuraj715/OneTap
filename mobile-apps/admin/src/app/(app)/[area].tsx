import { useLocalSearchParams } from "expo-router";
import { AreaScreen } from "@/screens/AreaScreen";

export default function Area() {
  const { area } = useLocalSearchParams<{ area: string }>();
  return <AreaScreen id={String(area)} />;
}
