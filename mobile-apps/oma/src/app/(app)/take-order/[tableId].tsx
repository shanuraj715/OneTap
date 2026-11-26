import { useLocalSearchParams, useRouter } from "expo-router";
import { TakeOrderScreen } from "@/screens/TakeOrderScreen";

export default function TakeOrderRoute() {
  const { tableId } = useLocalSearchParams<{ tableId: string }>();
  const router = useRouter();
  return <TakeOrderScreen tableId={String(tableId)} onDone={() => (router.canGoBack() ? router.back() : router.replace("/"))} />;
}
